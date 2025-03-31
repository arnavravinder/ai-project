const chatApp = Vue.createApp({
    data() {
      return {
        elements: {},
        defaultTranscript: "No transcript loaded. Please upload a file or paste text.",
        currentTranscript: "",
        currentAudioFile: null,
        currentUniqueId: "",
        isProcessing: false, // Used for general loading/API calls
        chatHistory: [], // This is reactive
        userInputText: '', // Separate model for user input
        geminiApiUrl: "https://supertails.vercel.app/api/gemini",
        transcribeApiUrl: "https://supertails.vercel.app/api/transcribe",
        // Rate Limiting for Gemini
        geminiRequestQueue: [],
        isGeminiProcessing: false,
        geminiApiDelay: 5500, // Slightly over 5 seconds to be safe (12 req/min = 5s/req)
        lastGeminiRequestTime: 0,
      };
    },
  
    mounted() {
      this.initChatElements();
      this.registerEventListeners();
      this.resetChatView();
    },
  
    methods: {
      initChatElements() {
        this.elements = {
          uploadSection: document.getElementById('upload-section'),
          loadingSection: document.getElementById('loading-section'),
          chatSection: document.getElementById('chat-section'),
          chatMessages: document.getElementById('chatMessages'),
          userInput: document.getElementById('userInput'), // Keep ref if needed elsewhere
          sendButton: document.getElementById('sendMessageBtn'),
          newTranscriptButton: document.getElementById('newTranscriptBtn'),
          fileInput: document.getElementById('fileInput'),
          dropArea: document.getElementById('dropArea'),
          fileName: document.getElementById('fileName'),
          fileFeedback: document.getElementById('fileFeedback'),
          transcriptOptions: document.getElementById('transcriptOptions'),
          audioContainer: document.getElementById('audioContainer'),
          audioPlayer: document.getElementById('audioPlayer'),
          transcriptInput: document.getElementById('transcriptInput'),
          processWithTranscriptBtn: document.getElementById('processWithTranscriptBtn'),
          processWithoutTranscriptBtn: document.getElementById('processWithoutTranscriptBtn'),
          languageSelect: document.getElementById('languageSelect'),
          uniqueIdInput: document.getElementById('uniqueIdInput'),
          // chatHistoryContainer: document.getElementById('chatMessages') // Reference for scrolling
        };
      },
  
      registerEventListeners() {
        this.elements.sendButton?.addEventListener('click', () => this.sendMessage());
        // User input is now handled by v-model and @keypress
        this.elements.newTranscriptButton?.addEventListener('click', () => this.resetChatView());
        this.elements.fileInput?.addEventListener('change', (e) => { if (e.target.files?.length > 0) this.handleFileUpload(e.target.files[0]); });
        this.elements.processWithTranscriptBtn?.addEventListener('click', () => this.processWithTranscript());
        this.elements.processWithoutTranscriptBtn?.addEventListener('click', () => this.processWithoutTranscript());
        this.elements.dropArea?.addEventListener('dragover', this.handleDragOver);
        this.elements.dropArea?.addEventListener('dragleave', this.handleDragLeave);
        this.elements.dropArea?.addEventListener('drop', this.handleDrop);
      },
  
      // handleDragOver, handleDragLeave, handleDrop remain the same
  
      resetChatView() {
        this.currentTranscript = "";
        this.currentAudioFile = null;
        this.currentUniqueId = "";
        this.isProcessing = false; // Reset general processing state
        this.userInputText = ''; // Clear input field model
        this.chatHistory = [{ type: 'bot', text: 'Hi there! Upload a transcript or audio file, or paste text to begin. Then, ask me questions about it.' }];
  
         // Reset Gemini queue
         this.geminiRequestQueue = [];
         this.isGeminiProcessing = false;
         this.lastGeminiRequestTime = 0;
  
  
        if (this.elements.uploadSection) this.elements.uploadSection.style.display = 'flex';
        if (this.elements.loadingSection) this.elements.loadingSection.style.display = 'none';
        if (this.elements.chatSection) this.elements.chatSection.classList.add('d-none');
  
        if (this.elements.fileInput) this.elements.fileInput.value = '';
        if (this.elements.fileName) this.elements.fileName.textContent = '';
        if (this.elements.fileFeedback) this.elements.fileFeedback.style.display = 'none';
        if (this.elements.fileFeedback) this.elements.fileFeedback.textContent = '';
        if (this.elements.transcriptOptions) this.elements.transcriptOptions.style.display = 'none';
        if (this.elements.audioContainer) this.elements.audioContainer.style.display = 'none';
        if (this.elements.audioPlayer) this.elements.audioPlayer.src = '';
        if (this.elements.transcriptInput) this.elements.transcriptInput.value = '';
        if (this.elements.uniqueIdInput) this.elements.uniqueIdInput.value = '';
  
        this.scrollChatToBottom();
      },
  
      // showFileFeedback, handleFileUpload remain the same
       showFileFeedback(type, message) {
          if (!this.elements.fileFeedback) return;
          this.elements.fileFeedback.textContent = message;
          this.elements.fileFeedback.className = `file-feedback ${type}`;
          this.elements.fileFeedback.style.display = 'block';
      },
  
      handleFileUpload(file) {
        if (!file) return;
        const allowedTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'];
        const maxFileSize = 25 * 1024 * 1024;
  
        if (!this.elements.fileInput || !this.elements.fileName || !this.elements.transcriptOptions ||
            !this.elements.audioContainer || !this.elements.audioPlayer || !this.elements.transcriptInput ||
            !this.elements.processWithoutTranscriptBtn || !this.elements.uniqueIdInput) {
            console.error("One or more chat UI elements are missing.");
            return;
        }
  
  
        if (!allowedTypes.some(type => file.type.startsWith(type.split('/')[0]))) {
          this.showFileFeedback('error', 'Invalid file type. Allowed: .txt, .pdf, .doc(x), audio files.');
          this.elements.fileInput.value = '';
          return;
        }
  
        if (file.size > maxFileSize) {
          this.showFileFeedback('error', `File size exceeds ${maxFileSize / 1024 / 1024}MB limit.`);
          this.elements.fileInput.value = '';
          return;
        }
  
        this.elements.fileName.textContent = file.name;
        this.elements.transcriptOptions.style.display = 'block';
        this.currentAudioFile = null;
        this.elements.audioContainer.style.display = 'none';
        this.elements.transcriptInput.value = '';
        this.elements.processWithoutTranscriptBtn.disabled = true;
  
        if (file.type.startsWith('audio/')) {
          this.currentAudioFile = file;
          try {
              const audioUrl = URL.createObjectURL(file);
              this.elements.audioPlayer.src = audioUrl;
              this.elements.audioContainer.style.display = 'block';
              this.elements.processWithoutTranscriptBtn.disabled = false;
              this.showFileFeedback('info', 'Audio ready. Provide transcript or click Transcribe.');
          } catch (error) {
               console.error("Error creating object URL for audio:", error);
               this.showFileFeedback('error', 'Could not load audio preview.');
               this.currentAudioFile = null;
               this.elements.processWithoutTranscriptBtn.disabled = true;
          }
        } else if (file.type === 'text/plain') {
          const reader = new FileReader();
          reader.onload = (e) => {
            this.elements.transcriptInput.value = e.target.result;
            this.showFileFeedback('success', 'Text file loaded. Click Process.');
          };
          reader.onerror = () => this.showFileFeedback('error', 'Error reading text file.');
          reader.readAsText(file);
        } else {
             this.showFileFeedback('info', `${file.type.split('/')[1].toUpperCase()} file uploaded. Provide transcript manually if needed.`);
        }
  
         this.currentUniqueId = this.elements.uniqueIdInput.value.trim();
      },
  
      processWithTranscript() {
          if (!this.elements.transcriptInput) return;
          const transcriptText = this.elements.transcriptInput.value.trim();
          if (!transcriptText) {
              this.showFileFeedback('error', 'Please paste or load transcript text.');
              return;
          }
          this.currentTranscript = transcriptText;
          this.startChatSession();
          this.saveTranscriptIfApplicable();
      },
  
      processWithoutTranscript() {
          if (!this.currentAudioFile) {
              this.showFileFeedback('error', 'No audio file uploaded for transcription.');
              return;
          }
          this.transcribeAudio(this.currentAudioFile);
      },
  
      transcribeAudio(file) {
          if (!this.elements.uploadSection || !this.elements.loadingSection || !this.elements.languageSelect) {
               console.error("Cannot transcribe: Missing required UI elements.");
               return;
          }
          this.isProcessing = true; // Use general processing flag for transcription
          this.elements.uploadSection.style.display = 'none';
          this.elements.loadingSection.style.display = 'flex';
          this.showFileFeedback('info', 'Transcribing audio... This may take a moment.');
  
          const formData = new FormData();
          formData.append('file', file);
          const selectedLanguage = this.elements.languageSelect.value;
          if (!selectedLanguage) {
              console.error("Could not read selected language value.");
               this.showFileFeedback('error', `Transcription failed: Could not get language selection.`);
               this.resetChatView();
               this.isProcessing = false;
               if (this.elements.loadingSection) this.elements.loadingSection.style.display = 'none';
               return;
          }
          formData.append('language', selectedLanguage);
          console.log("Sending language to transcribe API:", selectedLanguage);
  
          fetch(this.transcribeApiUrl, { method: 'POST', body: formData })
              .then(response => {
                  if (!response.ok) {
                      return response.text().then(text => {
                          let errorDetail = text;
                          try {
                              const jsonError = JSON.parse(text);
                              if (jsonError && jsonError.error) { errorDetail = jsonError.error; }
                          } catch(e) { /* Ignore */ }
                          throw new Error(`Transcription failed (${response.status}): ${errorDetail}`)
                      });
                  }
                  return response.text();
              })
              .then(transcriptText => {
                  this.currentTranscript = transcriptText;
                  this.showFileFeedback('success', 'Audio transcribed successfully!');
                  this.startChatSession();
                  this.saveTranscriptIfApplicable();
                  // isProcessing will be turned off by startChatSession's timeout
              })
              .catch(error => {
                  console.error("Transcription error:", error);
                  this.showFileFeedback('error', `${error.message}. Cannot proceed with chat.`);
                  this.resetChatView();
                  this.isProcessing = false; // Ensure processing stops on error
                  if (this.elements.loadingSection) this.elements.loadingSection.style.display = 'none';
              });
      },
  
       startChatSession() {
           if (!this.elements.uploadSection || !this.elements.loadingSection || !this.elements.chatSection) return;
  
           this.isProcessing = true; // Use general flag
           this.elements.uploadSection.style.display = 'none';
           this.elements.loadingSection.style.display = 'flex';
  
           setTimeout(() => {
               this.chatHistory = [{ type: 'bot', text: "I've processed the transcript. Ask me anything about it." }];
               this.elements.loadingSection.style.display = 'none';
               this.elements.chatSection.classList.remove('d-none');
               this.isProcessing = false; // Turn off general processing
               this.scrollChatToBottom();
           }, 500);
      },
  
      async saveTranscriptIfApplicable() {
          if (!this.currentTranscript || this.currentTranscript === this.defaultTranscript) return;
          try {
              const db = await initializeFirebase();
              if (!db || !db.ref) throw new Error("Database not available for saving.");
               const analysisData = this.analyzeTranscriptText(this.currentTranscript);
               const transcriptData = {
                   text: this.currentTranscript,
                   uniqueId: this.currentUniqueId || `chat_${Date.now()}@anon.com`,
                   timestamp: new Date().toISOString(),
                   ...analysisData
               };
              const newTranscriptRef = db.ref('transcripts').push();
              await newTranscriptRef.set(transcriptData);
              console.log("Transcript saved from chat view:", newTranscriptRef.key);
           } catch(err) {
               console.error("Failed to save transcript from chat:", err);
               this.addMessageToChat('bot', "(Note: Failed to save this transcript to the database.)");
           }
      },
  
      // analyzeTranscriptText, detectPetType, extractPetName, detectLifeStage,
      // assessKnowledgeLevel, extractKeyIssues, detectCustomerCategory, detectClinicPitch
      // remain the same as previous correct version
  
      analyzeTranscriptText(text) {
          if (!text || typeof text !== 'string') return {};
          return {
              petType: this.detectPetType(text),
              petName: this.extractPetName(text),
              lifeStage: this.detectLifeStage(text),
              knowledgeLevel: this.assessKnowledgeLevel(text),
              keyIssues: this.extractKeyIssues(text),
              customerCategory: this.detectCustomerCategory(text),
              clinicPitched: this.detectClinicPitch(text)
          };
      },
  
      detectPetType(text = '') {
        const lowerText = text.toLowerCase();
        const dogKeywords = ['dog', 'puppy', 'canine', 'doggie', 'pooch'];
        const catKeywords = ['cat', 'kitten', 'feline', 'kitty'];
        const dogCount = dogKeywords.reduce((n, k) => n + (lowerText.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length, 0);
        const catCount = catKeywords.reduce((n, k) => n + (lowerText.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length, 0);
        if (dogCount > catCount) return 'dog';
        if (catCount > dogCount) return 'cat';
        if (dogCount > 0 || catCount > 0) return 'other';
        return 'unknown';
      },
  
      extractPetName(text = '') {
         const patterns = [ /my (?:dog|cat|pet)\s(?:is\s)?(?:called|named)\s(\w+)/i, /(\w+)\s(?:is\s)?my (?:dog|cat|pet)/i, /have a (?:dog|cat|pet)\s(?:called|named)\s(\w+)/i, /pet's name is\s(\w+)/i ];
          for (const pattern of patterns) {
              const match = text.match(pattern);
              if (match && match[1]) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
          }
          const words = text.split(/\s+/);
          const petKeywords = ['dog', 'cat', 'pet', 'puppy', 'kitten'];
          for (let i = 0; i < words.length; i++) {
               if (/^[A-Z][a-z]{2,}$/.test(words[i]) && !['I', 'He', 'She', 'They', 'My', 'The'].includes(words[i])) {
                  if (i > 0 && petKeywords.includes(words[i-1]?.toLowerCase().replace(/[.,!?]/g, ''))) return words[i];
                  if (i < words.length - 1 && petKeywords.includes(words[i+1]?.toLowerCase().replace(/[.,!?]/g, ''))) return words[i];
              }
          }
         return 'Unknown';
      },
  
      detectLifeStage(text = '') {
        const lowerText = text.toLowerCase();
        if (/\b(puppy|kitten|young|baby|newborn|\d+\s+months? old|\d+\s+weeks? old)\b/.test(lowerText)) return 'puppy';
        if (/\b(senior|older|elderly|aging|geriatric|old dog|old cat)\b/.test(lowerText)) return 'senior';
        if (/\b(adult|\d+\s+years? old|mature)\b/.test(lowerText)) return 'adult';
        return 'unknown';
      },
  
       assessKnowledgeLevel(text = '') {
          const lowPatterns = [/don't know/i, /not sure/i, /confused/i, /what should i/i, /how do i/i, /first-time/i];
          const highPatterns = [/i've researched/i, /i read that/i, /according to/i, /understand that/i, /the vet recommended/i, /i've been (feeding|giving)/i];
          const lowMatches = lowPatterns.filter(p => p.test(text)).length;
          const highMatches = highPatterns.filter(p => p.test(text)).length;
          const score = highMatches - lowMatches;
          if (score >= 1) return 'high';
          if (score <= -1) return 'low';
          return 'medium';
      },
  
       extractKeyIssues(text = '') {
          const issues = new Set();
          const categories = {
              diet: ['food', 'feed', 'diet', 'eating', 'nutrition', 'meal', 'appetite', 'kibble', 'treats'],
              health: ['sick', 'pain', 'hurt', 'vet', 'medicine', 'symptom', 'treatment', 'disease', 'condition', 'vaccination', 'pills', 'arthritis', 'check-up', 'ill', 'vomit', 'diarrhea'],
              behavior: ['behavior', 'training', 'aggressive', 'anxiety', 'scared', 'barking', 'biting', 'chewing', 'house-trained', 'litter box', 'destructive'],
              grooming: ['groom', 'bath', 'fur', 'hair', 'brush', 'nail', 'coat', 'shedding', 'matting']
          };
          const lowerText = text.toLowerCase();
          for (const [category, keywords] of Object.entries(categories)) {
              if (keywords.some(kw => lowerText.includes(kw))) {
                  issues.add(category);
              }
          }
          return issues.size > 0 ? Array.from(issues).join(', ') : 'general';
      },
  
      detectCustomerCategory(text = '') {
          const lowerText = text.toLowerCase();
          const foodKeywords = ['food', 'diet', 'feeding', 'nutrition', 'meal', 'kibble', 'wet food', 'dry food', 'treats'];
          const pharmacyKeywords = ['medicine', 'medication', 'prescription', 'tablets', 'pills', 'treatment', 'therapy', 'arthritis', 'vaccination', 'supplement', 'flea', 'tick', 'worm'];
          const foodScore = foodKeywords.reduce((n, k) => n + (lowerText.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length, 0);
          const pharmacyScore = pharmacyKeywords.reduce((n, k) => n + (lowerText.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length, 0);
          if (foodScore > 0 && pharmacyScore > 0) return 'both';
          if (foodScore > pharmacyScore) return 'food';
          if (pharmacyScore > foodScore) return 'pharmacy';
          return 'general';
      },
  
      detectClinicPitch(text = '') {
          const clinicKeywords = ['vet visit', 'veterinary clinic', 'check-up', 'examination', 'schedule an appointment', 'visit the vet', 'bring (him|her|them|your pet) in', 'veterinary care', 'clinic', 'veterinarian', 'vet appointment'];
          return clinicKeywords.some(keyword => text.toLowerCase().match(new RegExp(keyword.replace(/\s/g, '\\s*'), 'i')));
      },
  
      sendMessage() {
        const userMessage = this.userInputText.trim(); // Use v-model variable
        if (!userMessage || this.isGeminiProcessing || this.isProcessing) return; // Check both flags
  
        if (!this.currentTranscript) {
            this.addMessageToChat('bot', "Please load a transcript first before asking questions.");
            return;
        }
  
        this.addMessageToChat('user', userMessage);
        this.userInputText = ''; // Clear the input field model
        this.addTypingIndicator();
        this.enqueueGeminiRequest(userMessage); // Enqueue instead of sending directly
      },
  
      // --- Predefined Prompts ---
      sendPredefinedPrompt(type) {
          if (!this.currentTranscript || this.isGeminiProcessing || this.isProcessing) return;
  
          let userMessage = "";
          let systemPrompt = ""; // Store the text for the user message bubble
  
          switch(type) {
              case 'knowledge':
                  systemPrompt = "Assess Pet Parent Knowledge Score";
                  userMessage = `Based *only* on the provided SuperTails transcript, assess the pet parent's knowledge level about pet care. Give a score from 1 (very low) to 10 (expert) and provide 1-2 brief examples from the text to justify the score.`;
                  break;
              case 'diet':
                  systemPrompt = "Analyze Pet Diet";
                  userMessage = `Based *only* on the provided SuperTails transcript, analyze the pet's diet. What are they being fed? Are any concerns mentioned? Are any specific SuperTails products mentioned or relevant?`;
                  break;
              case 'summary':
                  systemPrompt = "Summarize Call";
                  userMessage = `Provide a concise summary (3-4 bullet points) of the key topics discussed in this SuperTails transcript. Focus on the main issues and outcomes, if mentioned.`;
                  break;
              default:
                  return; // Unknown type
          }
  
           this.addMessageToChat('user', `[Action: ${systemPrompt}]`); // Show the action taken
           this.addTypingIndicator();
           this.enqueueGeminiRequest(userMessage); // Enqueue the actual prompt
      },
      // --- End Predefined Prompts ---
  
  
      addMessageToChat(type, text) {
          this.chatHistory.push({ type, text });
          this.scrollChatToBottom(); // Let scroll handle nextTick
      },
  
      addTypingIndicator() {
          // This is now handled reactively by v-if="isGeminiProcessing" in the template
          this.scrollChatToBottom();
      },
  
      removeTypingIndicator() {
         // This is now handled reactively by v-if="isGeminiProcessing" in the template
      },
  
       scrollChatToBottom() {
           // Use nextTick to wait for DOM update after chatHistory changes
           this.$nextTick(() => {
              const chatMessagesEl = this.$el.querySelector('#chatMessages'); // More reliable query
              if (chatMessagesEl) {
                  // A small delay helps if CSS transitions are involved
                  setTimeout(() => {
                      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
                  }, 100);
              }
           });
      },
  
      formatMarkdown(text) {
           if (!text) return '';
          let html = text;
          // Basic HTML escaping first for safety
          html = html.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
          // Markdown conversions
          html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
          html = html.replace(/`(.*?)`/g, '<code>$1</code>');
          html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
          // More robust list handling
          html = html.replace(/^[\s]*([-*+])\s+(.*)/gm, '<li>$2</li>'); // Capture list item content
          html = html.replace(/^(<br\s*\/?>)*(<li>.*<\/li>)(<br\s*\/?>)*/gm, '$2'); // Remove breaks around LIs
          html = html.replace(/(<ul>\s*)?(<li>.*?<\/li>\s*)+(<\/ul>\s*)?/g, (match, p1, p2, p3) => { // Wrap consecutive LIs
              return `<ul>${match.replace(/<\/?ul>\s*/g, '')}</ul>`; // Ensure only one UL wrapper
          });
          html = html.replace(/<br>\s*<ul>/g, '<ul>'); // Clean breaks before list
          html = html.replace(/<\/ul>\s*<br>/g, '</ul>'); // Clean breaks after list
          html = html.replace(/\n/g, '<br>'); // Remaining newlines
          return html;
      },
  
       // --- Gemini Rate Limiting Logic ---
      enqueueGeminiRequest(userMessage) {
          const request = { userMessage };
          this.geminiRequestQueue.push(request);
          this.processGeminiQueue(); // Start processing if not already doing so
      },
  
      async processGeminiQueue() {
          if (this.isGeminiProcessing || this.geminiRequestQueue.length === 0) {
              return; // Don't process if already busy or queue is empty
          }
  
          this.isGeminiProcessing = true; // Set busy flag
          this.isProcessing = true; // Also set general processing for typing indicator
  
          const request = this.geminiRequestQueue.shift(); // Get the next request
  
          // Calculate delay needed since last request
          const now = Date.now();
          const timeSinceLast = now - this.lastGeminiRequestTime;
          const delayNeeded = Math.max(0, this.geminiApiDelay - timeSinceLast);
  
          if (delayNeeded > 0) {
              console.log(`Rate limiting: Waiting ${delayNeeded}ms...`);
              await new Promise(resolve => setTimeout(resolve, delayNeeded));
          }
  
          this.lastGeminiRequestTime = Date.now(); // Record time *before* making the call
          await this.sendToGeminiAPI(request.userMessage); // Await the actual API call
  
          this.isGeminiProcessing = false; // Clear busy flag
          this.isProcessing = false; // Clear general processing flag
  
          // Process next item in queue if any
          if (this.geminiRequestQueue.length > 0) {
              // Use setTimeout to yield control briefly before next check
              setTimeout(() => this.processGeminiQueue(), 100);
          }
      },
      // --- End Gemini Rate Limiting ---
  
  
      async sendToGeminiAPI(userMessage) {
         // isProcessing and typing indicator are now handled by processGeminiQueue
  
         const prompt = `You are SupertailsAI, an assistant analyzing a customer interaction transcript for the company SuperTails.
  The transcript may have transcription errors; ignore them and focus on the content.
  Your answers MUST be based *only* on the provided transcript text. Do not add external knowledge or opinions.
  If the information is not in the transcript, state that clearly (e.g., "The SuperTails transcript doesn't mention...").
  Answer in the same language as the user's question. Keep answers concise and relevant. Always refer to the company as SuperTails.
  
  Transcript:
  ---
  ${this.currentTranscript}
  ---
  
  User Question: ${userMessage}
  
  Answer:`;
  
        try {
          const response = await fetch(this.geminiApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
          });
  
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
          }
  
          const data = await response.json();
          let botResponse = "Sorry, I couldn't get a response from the AI.";
  
          if (data?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
              botResponse = data.data.candidates[0].content.parts[0].text;
          } else if (data?.text) { // Fallback for different potential structures
              botResponse = data.text;
          } else if (typeof data === 'string') {
               botResponse = data; // If the API just returns a string
          }
  
          // Message is added reactively, no manual DOM manipulation needed
          this.addMessageToChat('bot', botResponse);
  
        } catch (error) {
          console.error("Gemini API Error:", error);
          // Add error message to chat
          this.addMessageToChat('bot', `Sorry, SuperTailsAI encountered an error: ${error.message}. Please try again.`);
        } finally {
           // Rate limiting flags are cleared in processGeminiQueue
           // No need to remove typing indicator here manually
        }
      }
    }
  }).mount('#chat-app');
  
  window.chatApp = chatApp;