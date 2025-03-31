export function chatComponent(mainApp) {
    const { createApp, ref, onMounted, computed } = Vue;

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
            const chatBodyRef = ref(null);

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
                // Use nextTick to wait for DOM update
                Vue.nextTick(() => {
                    const chatBody = chatBodyRef.value;
                    if (chatBody) {
                        chatBody.scrollTop = chatBody.scrollHeight;
                    }
                });
            };

             const formatMarkdown = (text) => {
                 if (!text) return '';
                 let formattedText = text;
                 formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
                 formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');     // Italics
                 formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');   // Inline code
                 formattedText = formattedText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>'); // Code blocks
                 formattedText = formattedText.replace(/^\s*-\s+(.*)/gm, '<li>$1</li>'); // Basic lists (needs wrapping ul) - simplified
                 formattedText = formattedText.replace(/\n/g, '<br>'); // Newlines
                 return formattedText;
            };

            const handleFileUpload = async (file) => {
                if (!file) return;

                const allowedTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'audio/mpeg', 'audio/mp3'];
                const maxSize = 15 * 1024 * 1024; // 15MB

                if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.mp3') ) {
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
                messages.value = []; // Clear previous chat

                try {
                    if (file.type.startsWith('audio/')) {
                        await transcribeAndProcess(file);
                    } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            currentTranscript.value = e.target.result;
                            finishProcessing();
                        };
                        reader.onerror = () => throw new Error("Error reading text file.");
                        reader.readAsText(file);
                    } else {
                        currentTranscript.value = `[Content of file '${file.name}' (${file.type}) - analysis will focus on metadata and user queries.]`;
                         finishProcessing("File type non-text; basic analysis available.");
                    }
                } catch (error) {
                    console.error("Error handling file upload:", error);
                    setFileFeedback('error', `Error processing file: ${error.message}`);
                    resetChatState();
                } finally {
                    // isLoading is set to false within finishProcessing or transcribeAndProcess error handling
                }
            };

            const transcribeAndProcess = async (file) => {
                 setFileFeedback('info', 'Transcribing audio... This may take a moment.');
                 const formData = new FormData();
                 formData.append('file', file);
                 formData.append('language', 'auto');

                 try {
                    const response = await fetch(TRANSCRIBE_API_ENDPOINT, {
                        method: 'POST',
                        body: formData
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Transcription failed: ${response.status} ${errorText}`);
                    }
                    const transcript = await response.text();
                    currentTranscript.value = transcript;
                    finishProcessing('Audio transcribed successfully!');

                 } catch (error) {
                     console.error("Transcription error:", error);
                     setFileFeedback('error', `Transcription failed: ${error.message}`);
                     resetChatState(); // Keep upload state active on transcription failure
                 }
            };


             const finishProcessing = (successMessage = 'Transcript ready!') => {
                setFileFeedback('success', successMessage);
                isUploading.value = false;
                isLoading.value = false;
                addMessage('bot', `Hi there! I've processed '${currentFileName.value}'. Ask me anything about its content.`);
            };

            const setFileFeedback = (type, message) => {
                fileFeedback.value = { type, message };
            };

             const sendMessage = async () => {
                const messageText = userInput.value.trim();
                if (!messageText || isLoading.value) return;

                addMessage('user', messageText);
                userInput.value = '';
                isLoading.value = true;
                addTypingIndicator();

                const prompt = `You are SupertailsAI, an assistant analyzing a customer service transcript.
                Transcript File: ${currentFileName.value || 'Unknown'}
                Transcript Content (use this as primary context):
                ---
                ${currentTranscript.value}
                ---
                User's Question: ${messageText}

                Please answer the user's question based *only* on the provided transcript content.
                - If the information is present, provide a concise and accurate answer.
                - If the information is not in the transcript, clearly state that (e.g., "I couldn't find that specific information in this transcript.").
                - Do not make assumptions or provide general knowledge outside the transcript's scope.
                - Address the user directly and maintain a helpful, professional tone.
                - Format your response clearly (e.g., use bullet points for lists if appropriate).`;

                try {
                    const botResponse = await mainApp.callGeminiAPI(prompt);
                    removeTypingIndicator();
                    addMessage('bot', formatMarkdown(botResponse));
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
                isUploading.value = true;
                setFileFeedback('', ''); // Clear feedback
                const fileInput = document.getElementById('chatFileInput');
                if(fileInput) fileInput.value = ''; // Reset file input
            }

            const handleFileChange = (event) => {
                 const file = event.target.files[0];
                 handleFileUpload(file);
            };

            const handleDrop = (event) => {
                 event.preventDefault();
                 event.currentTarget.classList.remove('drag-over');
                 const file = event.dataTransfer.files[0];
                 handleFileUpload(file);
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
                formatMarkdown
            };
        },
        template: `
            <div class="card chat-card h-100">
              <div class="chat-area">
                 <div v-if="isUploading" class="upload-overlay"
                      @drop.prevent="handleDrop"
                      @dragover.prevent="handleDragOver"
                      @dragleave.prevent="handleDragLeave">
                   <div class="upload-container">
                     <div class="upload-icon"><i class="fas fa-cloud-upload-alt"></i></div>
                     <h5>Upload Transcript or Audio</h5>
                     <p>Drag & drop your file here (.txt, .pdf, .doc, .docx, .mp3) or click below.</p>
                     <label for="chatFileInput" class="btn btn-primary-custom file-input-label">
                       <i class="fas fa-file-alt me-2"></i> Choose File
                     </label>
                     <input type="file" id="chatFileInput" @change="handleFileChange" class="d-none" accept=".txt,.pdf,.doc,.docx,.mp3,audio/mpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain">
                      <div class="file-info">{{ currentFileName || 'Max 15MB' }}</div>
                       <div v-if="fileFeedback.message" :class="['file-feedback', fileFeedback.type]">
                         {{ fileFeedback.message }}
                         <div v-if="isLoading && fileFeedback.type === 'info'" class="spinner-border spinner-border-sm ms-2" role="status"></div>
                       </div>
                   </div>
                 </div>

                 <div v-else class="d-flex flex-column h-100">
                    <div class="chat-header">
                        <h5>Transcript Assistant: {{ currentFileName }}</h5>
                        <button @click="resetChatState" class="btn btn-sm btn-outline-custom">
                            <i class="fas fa-plus me-1"></i> New Transcript
                        </button>
                    </div>
                    <div class="chat-body" ref="chatBodyRef">
                        <div v-for="message in messages" :key="message.id" :class="['message', message.sender === 'user' ? 'user-message' : '']">
                            <div v-if="message.type === 'typing'" class="d-flex align-items-center">
                                <div class="avatar bot-avatar"><i class="fas fa-robot"></i></div>
                                <div class="message-content typing-indicator">
                                    <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                                </div>
                            </div>
                            <template v-else>
                                <div :class="['avatar', message.sender === 'user' ? 'user-avatar' : 'bot-avatar']">
                                    <i :class="['fas', message.sender === 'user' ? 'fa-user' : 'fa-robot']"></i>
                                </div>
                                <div class="message-content">
                                    <div class="message-text" v-html="message.sender === 'bot' ? formatMarkdown(message.text) : message.text"></div>
                                </div>
                            </template>
                        </div>
                    </div>
                    <div class="chat-footer">
                        <div class="chat-input-container">
                        <input type="text" class="chat-input" v-model="userInput" @keyup.enter="sendMessage" placeholder="Ask about your transcript..." :disabled="isLoading">
                        <button @click="sendMessage" class="chat-submit" :disabled="isLoading || !userInput.trim()">
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