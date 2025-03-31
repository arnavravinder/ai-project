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
        userInputText: '',
        geminiApiUrl: "https://supertails.vercel.app/api/gemini",
        transcribeApiUrl: "https://supertails.vercel.app/api/transcribe",
        geminiRequestQueue: [],
        isGeminiProcessing: false,
        geminiApiDelay: 5500,
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
        this.elements.newTranscriptButton?.addEventListener('click', () => this.resetChatView());
        this.elements.fileInput?.addEventListener('change', (e) => { if (e.target.files?.length > 0) this.handleFileUpload(e.target.files[0]); });
        this.elements.processWithTranscriptBtn?.addEventListener('click', () => this.processWithTranscript());
        this.elements.processWithoutTranscriptBtn?.addEventListener('click', () => this.processWithoutTranscript());
        this.elements.dropArea?.addEventListener('dragover', this.handleDragOver);
        this.elements.dropArea?.addEventListener('dragleave', this.handleDragLeave);
        this.elements.dropArea?.addEventListener('drop', this.handleDrop);
      },
  
      handleDragOver(e) {
          e.preventDefault(); e.stopPropagation();
          if (this.elements.dropArea) {
              this.elements.dropArea.style.borderColor = 'var(--primary)';
              this.elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.1)';
          }
      },
      handleDragLeave(e) {
          e.preventDefault(); e.stopPropagation();
          if (this.elements.dropArea) {
              this.elements.dropArea.style.borderColor = 'var(--primary-light)';
              this.elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
          }
      },
      handleDrop(e) {
          e.preventDefault(); e.stopPropagation();
           if (this.elements.dropArea) {
              this.elements.dropArea.style.borderColor = 'var(--primary-light)';
              this.elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
          }
          if (e.dataTransfer.files?.length > 0 && this.elements.fileInput) {
               this.elements.fileInput.files = e.dataTransfer.files;
               this.handleFileUpload(e.dataTransfer.files[0]);
          }
      },
  
      resetChatView() {
        this.currentTranscript = "";
        this.currentAudioFile = null;
        this.currentUniqueId = "";
        this.isProcessing = false;
        this.isGeminiProcessing = false;
        this.userInputText = '';
        this.chatHistory = [{ type: 'bot', text: 'Hi there! Upload a transcript or audio file, or paste text to begin. Then, ask me questions about it.' }];
        this.geminiRequestQueue = [];
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
          this.isProcessing = true;
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
                          try { const jsonError = JSON.parse(text); if (jsonError && jsonError.error) { errorDetail = jsonError.error; }} catch(e) { }
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
              })
              .catch(error => {
                  console.error("Transcription error:", error);
                  this.showFileFeedback('error', `${error.message}. Cannot proceed with chat.`);
                  this.resetChatView();
                  this.isProcessing = false;
                  if (this.elements.loadingSection) this.elements.loadingSection.style.display = 'none';
              });
      },
  
       startChatSession() {
           if (!this.elements.uploadSection || !this.elements.loadingSection || !this.elements.chatSection) return;
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
        const lt = text.toLowerCase(); const dk=['dog','puppy','canine']; const ck =['cat','kitten','feline'];
        const dc =dk.reduce((n, k)=>n+(lt.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length,0); const cc =ck.reduce((n, k)=>n+(lt.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length,0);
        if(dc>cc) return 'dog'; if(cc>dc) return 'cat'; if(dc>0||cc>0) return 'other'; return 'unknown';
      },
      extractPetName(text = '') {
         const pts = [/my (?:dog|cat|pet)\s(?:is\s)?(?:called|named)\s(\w+)/i,/(\w+)\s(?:is\s)?my (?:dog|cat|pet)/i,/have a (?:dog|cat|pet)\s(?:called|named)\s(\w+)/i,/pet's name is\s(\w+)/i ];
          for(const p of pts){ const m=text.match(p); if(m&&m[1]) return m[1].charAt(0).toUpperCase()+m[1].slice(1); }
          const w=text.split(/\s+/); const pk=['dog','cat','pet','puppy','kitten'];
          for(let i=0;i<w.length;i++){ if(/^[A-Z][a-z]{2,}$/.test(w[i])&&!['I','He','She','They','My','The'].includes(w[i])){ if(i>0&&pk.includes(w[i-1]?.toLowerCase().replace(/[.,!?]/g,''))) return w[i]; if(i<w.length-1&&pk.includes(w[i+1]?.toLowerCase().replace(/[.,!?]/g,''))) return w[i]; }} return 'Unknown';
      },
      detectLifeStage(text = '') {
        const lt=text.toLowerCase(); if(/\b(puppy|kitten|young|baby|newborn|\d+\s+months? old|\d+\s+weeks? old)\b/.test(lt)) return 'puppy'; if(/\b(senior|older|elderly|aging|geriatric|old dog|old cat)\b/.test(lt)) return 'senior'; if(/\b(adult|\d+\s+years? old|mature)\b/.test(lt)) return 'adult'; return 'unknown';
      },
       assessKnowledgeLevel(text = '') {
          const lp=[/don't know/i,/not sure/i,/confused/i,/what should i/i,/how do i/i,/first-time/i]; const hp=[/i've researched/i,/i read that/i,/according to/i,/understand that/i,/the vet recommended/i,/i've been (feeding|giving)/i];
          const lm=lp.filter(p=>p.test(text)).length; const hm=hp.filter(p=>p.test(text)).length; const s=hm-lm; if(s>=1) return 'high'; if(s<=-1) return 'low'; return 'medium';
      },
       extractKeyIssues(text = '') {
          const iss=new Set(); const cats={diet:['food','feed','diet','eat','nutrition','meal','appetite','kibble','treats'],health:['sick','pain','hurt','vet','medic','symptom','treat','disease','condition','vaccin','pills','arthritis','check-up','ill','vomit','diarrhea'],behavior:['behav','train','aggress','anxiety','scared','bark','bit','chew','house-trained','litter box','destruct'],grooming:['groom','bath','fur','hair','brush','nail','coat','shed','mat']};
          const lt=text.toLowerCase(); for(const[cat,kws] of Object.entries(cats)){ if(kws.some(kw=>lt.includes(kw))) iss.add(cat); } return iss.size>0?Array.from(iss).join(', '):'general';
      },
      detectCustomerCategory(text = '') {
          const lt=text.toLowerCase(); const fk=['food','diet','feeding','nutrition','meal','kibble','wet food','dry food','treats']; const pk=['medicine','medication','prescription','tablets','pills','treatment','therapy','arthritis','vaccination','supplement','flea','tick','worm'];
          const fs=fk.reduce((n,k)=>n+(lt.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length,0); const ps=pk.reduce((n,k)=>n+(lt.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length,0);
          if(fs>0&&ps>0) return 'both'; if(fs>ps) return 'food'; if(ps>fs) return 'pharmacy'; return 'general';
      },
      detectClinicPitch(text = '') {
          const ck=['vet visit','veterinary clinic','check-up','examination','schedule an appointment','visit the vet','bring (him|her|them|your pet) in','veterinary care','clinic','veterinarian','vet appointment'];
          return ck.some(k=>text.toLowerCase().match(new RegExp(k.replace(/\s/g,'\\s*'),'i')));
      },
  
      sendMessage() {
        const userMessage = this.userInputText.trim();
        if (!userMessage || this.isProcessing || this.isGeminiProcessing) return;
        if (!this.currentTranscript) { this.addMessageToChat('bot', "Please load a transcript first."); return; }
        this.addMessageToChat('user', userMessage);
        this.userInputText = '';
        this.addTypingIndicator();
        this.enqueueGeminiRequest(userMessage);
      },
  
      sendPredefinedPrompt(type) {
          if (!this.currentTranscript || this.isProcessing || this.isGeminiProcessing) return;
          let userMessage = "";
          let systemPrompt = "";
          switch(type) {
              case 'knowledge':
                  systemPrompt = "Assess Knowledge Score";
                  userMessage = `Based *only* on the provided SuperTails transcript, assess the pet parent's knowledge level about pet care. Give a score from 1 (very low) to 10 (expert) and provide 1-2 brief examples from the text to justify the score. Refer to SuperTails where appropriate.`;
                  break;
              case 'diet':
                  systemPrompt = "Analyze Pet Diet";
                  userMessage = `Based *only* on the provided SuperTails transcript, analyze the pet's diet. What are they being fed? Are any concerns mentioned? Are any specific SuperTails products mentioned or relevant? Refer to SuperTails where appropriate.`;
                  break;
              case 'summary':
                  systemPrompt = "Summarize Call";
                  userMessage = `Provide a concise summary (3-4 bullet points) of the key topics discussed in this SuperTails transcript. Focus on the main issues and outcomes, if mentioned. Refer to SuperTails where appropriate.`;
                  break;
              default: return;
          }
           this.addMessageToChat('user', `[Action: ${systemPrompt}]`);
           this.addTypingIndicator();
           this.enqueueGeminiRequest(userMessage);
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
          // This is handled by the queue processor now
      },
  
       scrollChatToBottom() {
           // FIX: Target the specific DOM element directly by ID
           this.$nextTick(() => {
              const chatMessagesEl = document.getElementById('chatMessages'); // Use direct ID query
              if (chatMessagesEl) {
                  setTimeout(() => {
                      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
                  }, 50);
              } else {
                  console.warn("Chat messages element not found for scrolling.");
              }
           });
      },
  
      formatMarkdown(text) {
           if (!text) return ''; let html = text;
           html = html.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
           html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); html = html.replace(/`(.*?)`/g, '<code>$1</code>');
           html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
           html = html.replace(/^[\s]*([-*+])\s+(.*)/gm, '<li>$2</li>'); html = html.replace(/^(<br\s*\/?>)*(<li>.*<\/li>)(<br\s*\/?>)*/gm, '$2');
           html = html.replace(/(<ul>\s*)?(<li>.*?<\/li>\s*)+(<\/ul>\s*)?/g, (match) => `<ul>${match.replace(/<\/?ul>\s*/g, '')}</ul>`);
           html = html.replace(/<br>\s*<ul>/g, '<ul>'); html = html.replace(/<\/ul>\s*<br>/g, '</ul>'); html = html.replace(/\n/g, '<br>');
           return html;
      },
  
      enqueueGeminiRequest(userMessage) {
          const request = { userMessage };
          this.geminiRequestQueue.push(request);
          if (!this.isGeminiProcessing) {
              this.isProcessing = true;
          }
          this.processGeminiQueue();
      },
  
      async processGeminiQueue() {
          if (this.isGeminiProcessing || this.geminiRequestQueue.length === 0) return;
          this.isGeminiProcessing = true;
          this.isProcessing = true;
          const request = this.geminiRequestQueue.shift();
          const now = Date.now();
          const timeSinceLast = now - this.lastGeminiRequestTime;
          const delayNeeded = Math.max(0, this.geminiApiDelay - timeSinceLast);
          if (delayNeeded > 0) {
              console.log(`Rate limiting: Waiting ${delayNeeded}ms...`);
              await new Promise(resolve => setTimeout(resolve, delayNeeded));
          }
          this.lastGeminiRequestTime = Date.now();
          await this.sendToGeminiAPI(request.userMessage);
          this.isGeminiProcessing = false;
          if (this.geminiRequestQueue.length === 0) {
               this.isProcessing = false;
          }
          if (this.geminiRequestQueue.length > 0) {
              setTimeout(() => this.processGeminiQueue(), 100);
          }
      },
  
      async sendToGeminiAPI(userMessage) {
         const prompt = `You are SupertailsAI, an assistant analyzing a customer interaction transcript for the company SuperTails.
  The transcript may have transcription errors; ignore them and focus on the content.
  Your answers MUST be based *only* on the provided transcript text. Do not add external knowledge or opinions.
  If the information is not in the transcript, state that clearly (e.g., "The SuperTails transcript doesn't mention...").
  Answer in the same language as the user's question. Keep answers concise and relevant. Always refer to the company as SuperTails.
  
  Transcript:
  ---
  ${this.currentTranscript || '[No Transcript Loaded]'}
  ---
  
  User Question: ${userMessage}
  
  Answer:`;
        try {
          const response = await fetch(this.geminiApiUrl, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt })
          });
          if (!response.ok) { const errorText = await response.text(); throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`); }
          const data = await response.json();
          let botResponse = "Sorry, I couldn't get a response from the AI.";
          if (data?.data?.candidates?.[0]?.content?.parts?.[0]?.text) { botResponse = data.data.candidates[0].content.parts[0].text; }
          else if (data?.text) { botResponse = data.text; }
          else if (typeof data === 'string') { botResponse = data; }
          this.addMessageToChat('bot', botResponse);
        } catch (error) {
          console.error("Gemini API Error:", error);
          this.addMessageToChat('bot', `Sorry, SuperTailsAI encountered an error: ${error.message}. Please try again.`);
        }
      }
    }
  }).mount('#chat-app');
  
  window.chatApp = chatApp;