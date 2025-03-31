const chatApp = Vue.createApp({
    data() {
      return {
        elements: {},
        defaultTranscript: "No transcript loaded. Please upload a file or paste text.",
        currentTranscript: "",
        currentAudioFile: null,
        currentUniqueId: "",
        isProcessing: false,
        chatHistory: [],
        geminiApiUrl: "https://supertails.vercel.app/api/gemini",
        transcribeApiUrl: "https://supertails.vercel.app/api/transcribe",
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
          userInput: document.getElementById('userInput'),
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
        };
      },
  
      registerEventListeners() {
        this.elements.sendButton?.addEventListener('click', () => this.sendMessage());
        this.elements.userInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMessage(); });
        this.elements.newTranscriptButton?.addEventListener('click', () => this.resetChatView());
        this.elements.fileInput?.addEventListener('change', (e) => { if (e.target.files?.length > 0) this.handleFileUpload(e.target.files[0]); });
        this.elements.processWithTranscriptBtn?.addEventListener('click', () => this.processWithTranscript());
        this.elements.processWithoutTranscriptBtn?.addEventListener('click', () => this.processWithoutTranscript());
        this.elements.dropArea?.addEventListener('dragover', this.handleDragOver);
        this.elements.dropArea?.addEventListener('dragleave', this.handleDragLeave);
        this.elements.dropArea?.addEventListener('drop', this.handleDrop);
      },
  
      handleDragOver(e) {
          e.preventDefault();
          e.stopPropagation();
          this.elements.dropArea.style.borderColor = 'var(--primary)';
          this.elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.1)';
      },
  
      handleDragLeave(e) {
          e.preventDefault();
          e.stopPropagation();
          this.elements.dropArea.style.borderColor = 'var(--primary-light)';
          this.elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
      },
  
      handleDrop(e) {
          e.preventDefault();
          e.stopPropagation();
          this.elements.dropArea.style.borderColor = 'var(--primary-light)';
          this.elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
          if (e.dataTransfer.files?.length > 0) {
              this.elements.fileInput.files = e.dataTransfer.files;
              this.handleFileUpload(e.dataTransfer.files[0]);
          }
      },
  
      resetChatView() {
        this.currentTranscript = "";
        this.currentAudioFile = null;
        this.currentUniqueId = "";
        this.isProcessing = false;
        this.chatHistory = [{ type: 'bot', text: 'Hi there! Upload a transcript or audio file, or paste text to begin. Then, ask me questions about it.' }];
  
        this.elements.uploadSection.style.display = 'flex';
        this.elements.loadingSection.style.display = 'none';
        this.elements.chatSection.classList.add('d-none');
  
        this.elements.fileInput.value = '';
        this.elements.fileName.textContent = '';
        this.elements.fileFeedback.style.display = 'none';
        this.elements.fileFeedback.textContent = '';
        this.elements.transcriptOptions.style.display = 'none';
        this.elements.audioContainer.style.display = 'none';
        this.elements.audioPlayer.src = '';
        this.elements.transcriptInput.value = '';
        this.elements.uniqueIdInput.value = '';
        this.scrollChatToBottom();
      },
  
       showFileFeedback(type, message) {
          this.elements.fileFeedback.textContent = message;
          this.elements.fileFeedback.className = `file-feedback ${type}`;
          this.elements.fileFeedback.style.display = 'block';
      },
  
      handleFileUpload(file) {
        if (!file) return;
        const allowedTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'];
        const maxFileSize = 25 * 1024 * 1024;
  
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
        this.elements.processWithoutTranscriptBtn.disabled = true; // Disable by default
  
        if (file.type.startsWith('audio/')) {
          this.currentAudioFile = file;
          const audioUrl = URL.createObjectURL(file);
          this.elements.audioPlayer.src = audioUrl;
          this.elements.audioContainer.style.display = 'block';
          this.elements.processWithoutTranscriptBtn.disabled = false; // Enable for audio
          this.showFileFeedback('info', 'Audio ready. Provide transcript or click Transcribe.');
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
          const transcriptText = this.elements.transcriptInput.value.trim();
          if (!transcriptText) {
              this.showFileFeedback('error', 'Please paste or load transcript text.');
              return;
          }
          this.currentTranscript = transcriptText;
          this.startChatSession();
          this.saveTranscriptIfApplicable(); // Save after starting session
      },
  
      processWithoutTranscript() {
          if (!this.currentAudioFile) {
              this.showFileFeedback('error', 'No audio file uploaded for transcription.');
              return;
          }
          this.transcribeAudio(this.currentAudioFile);
      },
  
      transcribeAudio(file) {
          this.isProcessing = true;
          this.elements.uploadSection.style.display = 'none';
          this.elements.loadingSection.style.display = 'flex';
          this.showFileFeedback('info', 'Transcribing audio... This may take a moment.');
  
          const formData = new FormData();
          formData.append('file', file);
          // --- FIX: Read selected language value correctly ---
          const selectedLanguage = this.elements.languageSelect.value;
          formData.append('language', selectedLanguage);
          console.log("Sending language to transcribe API:", selectedLanguage); // Debugging log
          // --- END FIX ---
  
          fetch(this.transcribeApiUrl, { method: 'POST', body: formData })
              .then(response => {
                  if (!response.ok) {
                      return response.text().then(text => { throw new Error(`Transcription failed: ${text || response.statusText}`) });
                  }
                  return response.text();
              })
              .then(transcriptText => {
                  this.currentTranscript = transcriptText;
                  this.showFileFeedback('success', 'Audio transcribed successfully!');
                  this.startChatSession();
                  this.saveTranscriptIfApplicable(); // Save after successful transcription
              })
              .catch(error => {
                  console.error("Transcription error:", error);
                  this.showFileFeedback('error', `Transcription failed: ${error.message}. Cannot proceed with chat.`);
                  // Don't proceed to chat if transcription fails and is required
                  this.resetChatView(); // Go back to upload state
                  this.isProcessing = false;
                  this.elements.loadingSection.style.display = 'none';
              });
               // .finally() removed as resetChatView handles UI cleanup on error
      },
  
       startChatSession() {
           this.isProcessing = true;
           this.elements.uploadSection.style.display = 'none';
           this.elements.loadingSection.style.display = 'flex';
  
           setTimeout(() => {
               this.chatHistory = [{ type: 'bot', text: "I've processed the transcript. Ask me anything about it." }];
               this.elements.loadingSection.style.display = 'none';
               this.elements.chatSection.classList.remove('d-none');
               this.isProcessing = false;
               this.scrollChatToBottom();
           }, 500);
      },
  
       async saveTranscriptIfApplicable() {
          if (!this.currentTranscript || this.currentTranscript === this.defaultTranscript) {
              return;
          }
  
          try {
              const db = await initializeFirebase(); // Wait for DB connection
              if (!db) throw new Error("Database not available for saving.");
  
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
               // Optionally inform the user saving failed, but chat can continue
               this.addMessageToChat('bot', "(Note: Failed to save this transcript to the database.)");
           }
      },
  
       analyzeTranscriptText(text) {
          if (!text) return {};
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
  
      detectPetType(text) {
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
  
      extractPetName(text) {
         const patterns = [ /my (?:dog|cat|pet)\s(?:is\s)?(?:called|named)\s(\w+)/i, /(\w+)\s(?:is\s)?my (?:dog|cat|pet)/i, /have a (?:dog|cat|pet)\s(?:called|named)\s(\w+)/i, /pet's name is\s(\w+)/i ];
          for (const pattern of patterns) {
              const match = text.match(pattern);
              if (match && match[1]) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
          }
          const words = text.split(/\s+/);
          const petKeywords = ['dog', 'cat', 'pet', 'puppy', 'kitten'];
          for (let i = 0; i < words.length; i++) {
               if (/^[A-Z][a-z]{2,}$/.test(words[i]) && !['I', 'He', 'She', 'They', 'My', 'The'].includes(words[i])) {
                   if (i > 0 && petKeywords.includes(words[i-1].toLowerCase().replace(/[.,!?]/g, ''))) return words[i];
                   if (i < words.length - 1 && petKeywords.includes(words[i+1].toLowerCase().replace(/[.,!?]/g, ''))) return words[i];
              }
          }
         return 'Unknown';
      },
  
      detectLifeStage(text) {
        const lowerText = text.toLowerCase();
        if (/\b(puppy|kitten|young|baby|newborn|\d+\s+months? old|\d+\s+weeks? old)\b/.test(lowerText)) return 'puppy';
        if (/\b(senior|older|elderly|aging|geriatric|old dog|old cat)\b/.test(lowerText)) return 'senior';
        if (/\b(adult|\d+\s+years? old|mature)\b/.test(lowerText)) return 'adult';
        return 'unknown';
      },
  
       assessKnowledgeLevel(text) {
          const lowPatterns = [/don't know/i, /not sure/i, /confused/i, /what should i/i, /how do i/i, /first-time/i];
          const highPatterns = [/i've researched/i, /i read that/i, /according to/i, /understand that/i, /the vet recommended/i, /i've been (feeding|giving)/i];
          const lowMatches = lowPatterns.filter(p => p.test(text)).length;
          const highMatches = highPatterns.filter(p => p.test(text)).length;
          const score = highMatches - lowMatches;
          if (score >= 1) return 'high';
          if (score <= -1) return 'low';
          return 'medium';
      },
  
       extractKeyIssues(text) {
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
  
      detectCustomerCategory(text) {
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
  
      detectClinicPitch(text) {
          const clinicKeywords = ['vet visit', 'veterinary clinic', 'check-up', 'examination', 'schedule an appointment', 'visit the vet', 'bring (him|her|them|your pet) in', 'veterinary care', 'clinic', 'veterinarian', 'vet appointment'];
          return clinicKeywords.some(keyword => text.toLowerCase().match(new RegExp(keyword.replace(/\s/g, '\\s*'), 'i')));
      },
  
      sendMessage() {
        const userMessage = this.elements.userInput.value.trim();
        if (!userMessage || this.isProcessing) return;
  
        if (!this.currentTranscript) {
            this.addMessageToChat('bot', "Please load a transcript first before asking questions.");
            return;
        }
  
        this.addMessageToChat('user', userMessage);
        this.elements.userInput.value = '';
        this.addTypingIndicator();
        this.sendToGeminiAPI(userMessage);
      },
  
      addMessageToChat(type, text) {
          this.chatHistory.push({ type, text });
          this.scrollChatToBottom();
      },
  
      addTypingIndicator() {
          this.isProcessing = true;
          this.scrollChatToBottom();
      },
  
      removeTypingIndicator() {
         this.isProcessing = false;
      },
  
       scrollChatToBottom() {
           this.$nextTick(() => {
              const chatMessages = this.elements.chatMessages;
              if (chatMessages) {
                  chatMessages.scrollTop = chatMessages.scrollHeight;
              }
           });
      },
  
      formatMarkdown(text) {
          if (!text) return '';
          let html = text;
          html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
          html = html.replace(/`(.*?)`/g, '<code>$1</code>');
          html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
          html = html.replace(/^\s*[-*+]\s+(.*)/gm, '<li>$1</li>');
          html = html.replace(/(<li>.*<\/li>\s*)+/g, (match) => `<ul>${match}</ul>`);
          html = html.replace(/\n/g, '<br>');
          return html;
      },
  
      async sendToGeminiAPI(userMessage) {
         const prompt = `You are SupertailsAI, an assistant analyzing a customer interaction transcript.
  The transcript may have transcription errors; ignore them and focus on the content.
  Your answers MUST be based *only* on the provided transcript text. Do not add external knowledge or opinions.
  If the information is not in the transcript, state that clearly (e.g., "The transcript doesn't mention...").
  Answer in the same language as the user's question. Keep answers concise and relevant to the question.
  
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
            throw new Error(`API Error: ${response.statusText}`);
          }
  
          const data = await response.json();
          let botResponse = "Sorry, I couldn't get a response.";
  
          if (data?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
              botResponse = data.data.candidates[0].content.parts[0].text;
          } else if (data?.text) {
              botResponse = data.text;
          } else if (typeof data === 'string') {
               botResponse = data;
          }
  
          this.removeTypingIndicator();
          this.addMessageToChat('bot', botResponse);
  
        } catch (error) {
          console.error("Gemini API Error:", error);
          this.removeTypingIndicator();
          this.addMessageToChat('bot', `Sorry, I encountered an error: ${error.message}. Please try again.`);
        }
      }
    }
  }).mount('#chat-app');
  
  window.chatApp = chatApp;