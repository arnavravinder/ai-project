export function chatComponent(mainAppInterface) { // Receive interface
    const { createApp, ref, onMounted, computed, nextTick } = Vue; // Use nextTick

    return createApp({
        setup() {
            const messages = ref([]);
            const userInput = ref('');
            const currentTranscript = ref('');
            const currentFileName = ref('');
            const currentFile = ref(null);
            const isLoading = ref(false);
            const isUploading = ref(true);
            const fileFeedback = ref({ type: '', message: '' });
            const chatBodyRef = ref(null); // Template ref for scrolling

            // Access functions from interface
            const callGeminiAPI = mainAppInterface.callGeminiAPI;
            // Access TRANSCRIBE_API_ENDPOINT globally if needed, or pass via interface
            // Assuming TRANSCRIBE_API_ENDPOINT is global from config.js

            const addMessage = (sender, text) => {
                messages.value.push({ sender, text, id: Date.now() + Math.random() });
                scrollToBottom();
            };

            const addTypingIndicator = () => {
                messages.value.push({ sender: 'bot', type: 'typing', id: 'typing-indicator' });
                scrollToBottom();
            }

            const removeTypingIndicator = () => {
                 messages.value = messages.value.filter(m => m.id !== 'typing-indicator');
            }

            const scrollToBottom = () => {
                nextTick(() => { // Use nextTick
                    const chatBody = chatBodyRef.value;
                    if (chatBody) {
                        chatBody.scrollTop = chatBody.scrollHeight;
                    }
                });
            };

             const formatMarkdown = (text) => {
                 if (!text) return '';
                 let formattedText = text;
                 // Basic Markdown replacements
                 formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
                 formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');     // Italics
                 formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');   // Inline code
                 // Basic list handling (requires wrapping logic later or ensure input format)
                 formattedText = formattedText.replace(/^\s*-\s+(.*)/gm, '<li>$1</li>');
                 formattedText = formattedText.replace(/^\s*\*\s+(.*)/gm, '<li>$1</li>'); // Also handle '*' lists
                 // Attempt to wrap consecutive LIs (might need refinement)
                 formattedText = formattedText.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => `<ul class="list-unstyled ps-3 mt-2">${match.replace(/<\/li>\s*<li>/g, '</li><li>')}</ul>`);
                 formattedText = formattedText.replace(/\n/g, '<br>'); // Newlines
                 return formattedText;
            };

            const handleFileUpload = async (file) => {
                if (!file) return;

                const allowedTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'audio/mpeg', 'audio/mp3'];
                const maxSize = 15 * 1024 * 1024; // 15MB

                // More robust type checking
                const fileExtension = file.name.split('.').pop().toLowerCase();
                const isAllowedExtension = ['txt', 'pdf', 'doc', 'docx', 'mp3'].includes(fileExtension);
                const isAllowedMime = allowedTypes.includes(file.type);

                // Allow if either MIME type matches or extension matches (for cases where MIME might be generic)
                if (!isAllowedMime && !isAllowedExtension) {
                   setFileFeedback('error', 'Invalid file type. Please upload .txt, .pdf, .doc, .docx, or .mp3');
                    return;
                }
                 if (file.size > maxSize) {
                    setFileFeedback('error', 'File size exceeds 15MB limit.');
                    return;
                }

                currentFile.value = file;
                currentFileName.value = file.name;
                setFileFeedback('info', `Processing ${file.name}...`);
                isLoading.value = true;
                isUploading.value = true; // Keep overlay until success/failure is certain
                messages.value = []; // Clear previous chat

                try {
                    if (file.type.startsWith('audio/') || fileExtension === 'mp3') {
                        await transcribeAndProcess(file);
                    } else if (file.type === 'text/plain' || fileExtension === 'txt') {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            currentTranscript.value = e.target.result;
                            finishProcessing();
                        };
                        reader.onerror = (e) => {
                            console.error("FileReader error:", e);
                            throw new Error("Error reading text file.");
                        };
                        reader.readAsText(file);
                    } else {
                        // Handle non-text, non-audio files (like PDF, DOCX)
                        currentTranscript.value = `[File: ${file.name}, Type: ${file.type || fileExtension}. Content not directly readable in browser. Analysis based on metadata and queries.]`;
                        finishProcessing("File type requires server-side processing for full content analysis (basic chat available).");
                    }
                } catch (error) {
                    console.error("Error handling file upload:", error);
                    setFileFeedback('error', `Error processing file: ${error.message}`);
                    // Reset state but keep upload UI visible
                    isLoading.value = false;
                    isUploading.value = true;
                    currentFile.value = null;
                    currentFileName.value = '';
                    // Don't clear feedback here
                }
            };

            const transcribeAndProcess = async (file) => {
                 setFileFeedback('info', 'Transcribing audio... This may take a moment.');
                 const formData = new FormData();
                 formData.append('file', file);
                 formData.append('language', 'auto');

                 try {
                    // TRANSCRIBE_API_ENDPOINT global from config.js
                    const response = await fetch(TRANSCRIBE_API_ENDPOINT, {
                        method: 'POST',
                        body: formData
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Transcription API Error (${response.status}): ${errorText}`);
                        // Try to parse error from AssemblyAI if possible
                         let detail = errorText;
                         try {
                            const errJson = JSON.parse(errorText);
                            detail = errJson.error || errorText;
                         } catch (e) {/* ignore parse error */}
                        throw new Error(`Transcription failed: ${detail}`);
                    }
                    const transcript = await response.text();
                    currentTranscript.value = transcript;
                    finishProcessing('Audio transcribed successfully!');

                 } catch (error) {
                     console.error("Transcription error:", error);
                     setFileFeedback('error', `Transcription failed: ${error.message}`);
                     // Reset state on transcription failure, keep upload UI
                     isLoading.value = false;
                     isUploading.value = true;
                     currentFile.value = null;
                     currentFileName.value = '';
                 }
            };


             const finishProcessing = (successMessage = 'Transcript ready!') => {
                setFileFeedback('success', successMessage);
                isUploading.value = false; // Hide overlay
                isLoading.value = false;
                addMessage('bot', `Hi there! I've processed '${currentFileName.value}'. Ask me anything about its content.`);
            };

            const setFileFeedback = (type, message) => {
                fileFeedback.value = { type, message };
            };

             const sendMessage = async () => {
                const messageText = userInput.value.trim();
                if (!messageText || isLoading.value || isUploading.value) return; // Don't send if uploading

                addMessage('user', messageText);
                userInput.value = '';
                isLoading.value = true;
                addTypingIndicator();

                const prompt = `You are SupertailsAI, an assistant analyzing a customer service transcript.
                Transcript File: ${currentFileName.value || 'Unknown'}
                Transcript Content (use this as primary context):
                ---
                ${currentTranscript.value || '[No transcript content loaded]'}
                ---
                User's Question: ${messageText}

                Please answer the user's question based *only* on the provided transcript content.
                - If the information is present, provide a concise and accurate answer.
                - If the information is not in the transcript, clearly state that (e.g., "I couldn't find that specific information in this transcript.").
                - Do not make assumptions or provide general knowledge outside the transcript's scope.
                - Address the user directly and maintain a helpful, professional tone.
                - Format your response clearly (e.g., use bullet points for lists if appropriate).`;

                try {
                    const botResponse = await callGeminiAPI(prompt); // Use interface function
                    removeTypingIndicator();
                    addMessage('bot', botResponse); // Let formatMarkdown handle formatting in template
                } catch (error) {
                     removeTypingIndicator();
                     addMessage('bot', `Sorry, I encountered an error trying to process your request: ${error.message}`);
                     console.error("Error sending message:", error);
                } finally {
                    isLoading.value = false;
                }
            };

            const resetChatState = () => {
                messages.value = [];
                userInput.value = '';
                currentTranscript.value = '';
                currentFileName.value = '';
                currentFile.value = null;
                isLoading.value = false;
                isUploading.value = true; // Go back to upload state
                setFileFeedback('', ''); // Clear feedback
                const fileInput = document.getElementById('chatFileInput');
                if(fileInput) fileInput.value = ''; // Reset file input visually
            }

            const handleFileChange = (event) => {
                 const file = event.target.files[0];
                 handleFileUpload(file);
            };

            const handleDrop = (event) => {
                 event.preventDefault();
                 event.currentTarget.classList.remove('drag-over');
                 if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                    handleFileUpload(event.dataTransfer.files[0]);
                 }
            };

            const handleDragOver = (event) => {
                 event.preventDefault();
                 event.currentTarget.classList.add('drag-over');
            };

            const handleDragLeave = (event) => {
                 event.currentTarget.classList.remove('drag-over');
            };


            return {
                messages,
                userInput,
                isLoading,
                isUploading,
                currentFileName,
                fileFeedback,
                sendMessage,
                handleFileChange,
                handleDrop,
                handleDragOver,
                handleDragLeave,
                resetChatState,
                chatBodyRef,
                formatMarkdown // Return for use in template
            };
        },
        template: `
            <div class="card chat-card h-100">
              <div class="chat-area">
                 <div v-if="isUploading" class="upload-overlay"
                      @drop="handleDrop"
                      @dragover="handleDragOver"
                      @dragleave="handleDragLeave">
                   <div class="upload-container">
                     <div class="upload-icon"><i class="fas fa-cloud-upload-alt"></i></div>
                     <h5>Upload Transcript or Audio</h5>
                     <p>Drag & drop your file here (.txt, .pdf, .doc, .docx, .mp3) or click below.</p>
                     <label for="chatFileInput" class="btn btn-primary-custom file-input-label">
                       <i class="fas fa-file-alt me-2"></i> Choose File
                     </label>
                     <input type="file" id="chatFileInput" @change="handleFileChange" class="d-none" accept=".txt,.pdf,.doc,.docx,.mp3,audio/mpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain">
                      <div class="file-info">{{ currentFileName || 'Max 15MB' }}</div>
                       <!-- Feedback Area -->
                       <div v-if="fileFeedback.message" :class="['file-feedback', fileFeedback.type, 'mt-3']">
                         {{ fileFeedback.message }}
                         <div v-if="isLoading && fileFeedback.type === 'info'" class="spinner-border spinner-border-sm ms-2" role="status"></div>
                       </div>
                   </div>
                 </div>

                 <!-- Chat Interface (shown when not uploading) -->
                 <div v-else class="d-flex flex-column h-100">
                    <div class="chat-header">
                        <h5>Transcript Assistant: {{ currentFileName }}</h5>
                        <button @click="resetChatState" class="btn btn-sm btn-outline-custom">
                            <i class="fas fa-plus me-1"></i> New Transcript
                        </button>
                    </div>
                    <div class="chat-body" ref="chatBodyRef">
                        <!-- Messages -->
                        <div v-for="message in messages" :key="message.id" :class="['message', message.sender === 'user' ? 'user-message' : '']">
                            <!-- Typing Indicator -->
                            <div v-if="message.type === 'typing'" class="d-flex align-items-center w-100">
                                <div class="avatar bot-avatar"><i class="fas fa-robot"></i></div>
                                <div class="message-content typing-indicator ms-2">
                                    <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                                </div>
                            </div>
                            <!-- Regular Message -->
                            <template v-else>
                                <div :class="['avatar', message.sender === 'user' ? 'user-avatar' : 'bot-avatar']">
                                    <i :class="['fas', message.sender === 'user' ? 'fa-user' : 'fa-robot']"></i>
                                </div>
                                <div class="message-content">
                                    <!-- Use v-html for formatted bot messages -->
                                    <div class="message-text" v-if="message.sender === 'bot'" v-html="formatMarkdown(message.text)"></div>
                                    <!-- Display user messages directly (avoids potential XSS if user input had HTML) -->
                                    <div class="message-text" v-else>{{ message.text }}</div>
                                </div>
                            </template>
                        </div>
                         <!-- Show feedback in chat area if processing failed AFTER upload screen -->
                        <div v-if="!isUploading && fileFeedback.type === 'error'" :class="['file-feedback', fileFeedback.type, 'mt-auto', 'mx-auto', 'p-2', 'mb-2']" style="max-width: 80%;">
                            {{ fileFeedback.message }}
                        </div>
                    </div>
                    <div class="chat-footer">
                        <div class="chat-input-container">
                        <input type="text" class="chat-input" v-model="userInput" @keyup.enter="sendMessage" placeholder="Ask about your transcript..." :disabled="isLoading || isUploading">
                        <button @click="sendMessage" class="chat-submit" :disabled="isLoading || isUploading || !userInput.trim()">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                        </div>
                    </div>
                 </div>

              </div>
            </div>
        `
    });
}
