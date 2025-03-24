AOS.init({
  duration: 800,
  easing: 'ease-in-out',
  once: true
});

const app = Vue.createApp({
  data() {
    return {
      elements: {},
      defaultTranscript: "This is a sample transcript. It contains information about various topics that you can ask about. Feel free to ask questions related to this content and our AI will analyze it for you.",
      currentTranscript: "",
      isSpecialPromptActive: false,
      activeSpecialPromptButton: null,
      currentAudioFile: null,
      transcriptData: null,
      currentView: 'chat'
    };
  },
  
  mounted() {
    this.initChat();
    this.registerEventListeners();
  },
  
  methods: {
    initChat() {
      this.elements = {
        uploadSection: document.getElementById('upload-section'),
        loadingSection: document.getElementById('loading-section'),
        chatSection: document.getElementById('chat-section'),
        chatMessages: document.getElementById('chatMessages'),
        userInput: document.getElementById('userInput'),
        sendButton: document.getElementById('sendMessage'),
        newTranscriptButton: document.getElementById('newTranscript'),
        fileInput: document.getElementById('fileInput'),
        dropArea: document.getElementById('dropArea'),
        fileName: document.getElementById('fileName'),
        fileFeedback: document.getElementById('fileFeedback'),
        chatFooter: document.querySelector('.chat-footer'),
        transcriptOptions: document.getElementById('transcriptOptions'),
        audioContainer: document.getElementById('audioContainer'),
        audioPlayer: document.getElementById('audioPlayer'),
        transcriptInput: document.getElementById('transcriptInput'),
        processWithTranscriptBtn: document.getElementById('processWithTranscriptBtn'),
        processWithoutTranscriptBtn: document.getElementById('processWithoutTranscriptBtn'),
        specialPromptButtons: document.getElementById('specialPromptButtons')
      };
      
      this.currentTranscript = this.defaultTranscript;
      this.addSpecialPromptButtons();
    },
    
    // Add the missing scrollChatToBottom function
    scrollChatToBottom() {
      if (this.elements.chatMessages) {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
      }
    },
    
    registerEventListeners() {
      const viewButtons = document.querySelectorAll('.view-toggle-btn');
      viewButtons.forEach(button => {
        button.addEventListener('click', () => {
          viewButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          
          const viewType = button.dataset.view;
          this.toggleView(viewType);
        });
      });
      
      this.elements.sendButton?.addEventListener('click', () => this.sendMessage());
      
      this.elements.userInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendMessage();
      });
      
      this.elements.newTranscriptButton?.addEventListener('click', () => this.resetToUpload());
      
      this.elements.fileInput?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
      
      this.elements.processWithTranscriptBtn?.addEventListener('click', () => {
        const transcriptText = this.elements.transcriptInput.value.trim();
        if (transcriptText) {
          this.currentTranscript = transcriptText;
          this.processTranscript();
        } else if (this.currentAudioFile) {
          this.showFileFeedback('error', 'Please enter a transcript or click "No Transcript Available"');
        } else {
          this.showFileFeedback('error', 'Please enter a transcript or upload an audio file');
        }
      });
      
      this.elements.processWithoutTranscriptBtn?.addEventListener('click', () => {
        if (this.currentAudioFile) {
          this.showFileFeedback('info', 'Transcribing audio...');
          this.transcribeAudioFileForChat(this.currentAudioFile);
        } else {
          this.showFileFeedback('error', 'Please upload an audio file first');
        }
      });
      
      if (this.elements.dropArea) {
        this.setupDropArea(this.elements.dropArea, this.elements.fileInput);
      }
    },
    
    setupDropArea(dropArea) {
      dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--primary)';
        dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.1)';
      });
      
      dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--primary-light)';
        dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
      });
      
      dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--primary-light)';
        dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFileUpload(e.dataTransfer.files[0]);
        }
      });
    },
    
    toggleView(viewType) {
      this.currentView = viewType;
      const chatView = document.getElementById('main-chat-view');
      const analyticsView = document.getElementById('analytics-view');
      
      if (viewType === 'chat') {
        chatView.style.display = 'flex';
        analyticsView.style.display = 'none';
      } else if (viewType === 'analytics') {
        chatView.style.display = 'none';
        analyticsView.style.display = 'flex';
        if (window.updateAnalytics) {
          window.updateAnalytics();
        }
      }
    },
    
    showFileFeedback(type, message) {
      if (this.elements.fileFeedback) {
        this.elements.fileFeedback.textContent = message;
        this.elements.fileFeedback.className = `file-feedback ${type}`;
        this.elements.fileFeedback.style.display = 'block';
      }
    },
    
    handleFileUpload(file) {
      if (!file) return;
      
      const fileName = file.name.toLowerCase();
      const isTextFile = fileName.endsWith('.txt');
      const isPdfFile = fileName.endsWith('.pdf');
      const isDocFile = fileName.endsWith('.doc') || fileName.endsWith('.docx');
      const isMp3File = fileName.endsWith('.mp3');
      
      if (!(isTextFile || isPdfFile || isDocFile || isMp3File)) {
        this.showFileFeedback('error', 'Please upload a valid transcript file (.txt, .doc, .docx, .pdf, .mp3)');
        return;
      }
      
      if (file.size > 15 * 1024 * 1024) {
        this.showFileFeedback('error', 'File size should be less than 15MB');
        return;
      }
      
      this.elements.fileName.textContent = file.name;
      
      if (isMp3File) {
        this.currentAudioFile = file;
        
        if (this.elements.audioPlayer && this.elements.audioContainer && this.elements.transcriptOptions) {
          const audioUrl = URL.createObjectURL(file);
          this.elements.audioPlayer.src = audioUrl;
          this.elements.audioContainer.style.display = 'block';
          this.elements.transcriptOptions.style.display = 'block';
        }
        
        this.showFileFeedback('info', 'Audio file uploaded. You can enter a transcript or let us transcribe it for you.');
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (isTextFile) {
            this.currentTranscript = e.target.result || this.defaultTranscript;
            
            if (this.elements.transcriptInput && this.elements.transcriptOptions) {
              this.elements.transcriptInput.value = this.currentTranscript;
              this.elements.transcriptOptions.style.display = 'block';
            }
          } else {
            this.currentTranscript = `[Binary content from ${file.name}]`;
          }
          this.showFileFeedback('success', 'File uploaded successfully. Click to process.');
        };
        
        reader.onerror = () => {
          this.currentTranscript = this.defaultTranscript;
          this.showFileFeedback('error', 'Error reading file. Please try again.');
        };
        
        if (isTextFile) {
          reader.readAsText(file);
        } else {
          reader.readAsArrayBuffer(file);
          this.currentTranscript = `[Binary content from ${file.name}]`;
          this.showFileFeedback('success', 'File uploaded successfully. Click to process.');
        }
      }
    },
    
    transcribeAudioFileForChat(file) {
      if (!file) return;
      
      const loader = this.elements.loadingSection;
      if (loader) loader.style.display = 'flex';
      
      this.showFileFeedback('info', 'Transcribing audio... This may take a moment.');
      
      const formData = new FormData();
      formData.append('file', file);
      
      const languageSelect = document.getElementById('languageSelect');
      const languageValue = languageSelect ? languageSelect.value : 'auto';
      formData.append('language', languageValue);
      
      fetch("https://supertails.vercel.app/api/transcribe", {
        method: 'POST',
        body: formData
      })
        .then(response => {
          if (!response.ok) {
            throw new Error("Transcription API returned an error");
          }
          return response.text();
        })
        .then(transcriptText => {
          this.currentTranscript = transcriptText;
          this.showFileFeedback('success', 'Audio transcribed successfully! Processing...');
          
          if (loader) loader.style.display = 'none';
          this.processTranscript();
        })
        .catch(error => {
          this.showFileFeedback('error', 'Error transcribing audio. Using default transcript.');
          this.currentTranscript = this.defaultTranscript;
          if (loader) loader.style.display = 'none';
        });
    },
    
    processTranscript() {
      if (!this.currentTranscript) {
        this.showFileFeedback('error', 'Please upload a transcript file first');
        return;
      }
      
      this.elements.uploadSection.style.display = 'none';
      this.elements.loadingSection.style.display = 'flex';
      
      setTimeout(() => {
        this.analyzeTranscriptData();
        this.elements.loadingSection.style.display = 'none';
        this.elements.chatSection.style.display = 'flex';
        this.scrollChatToBottom();
      }, 1000);
    },
    
    analyzeTranscriptData() {
      let transcriptText = this.currentTranscript;
      
      this.transcriptData = {
        text: transcriptText,
        petType: this.detectPetType(transcriptText),
        petName: this.extractPetName(transcriptText),
        lifeStage: this.detectLifeStage(transcriptText),
        knowledgeLevel: this.assessKnowledgeLevel(transcriptText),
        keyIssues: this.extractKeyIssues(transcriptText),
        customerCategory: this.detectCustomerCategory(transcriptText),
        clinicPitched: this.detectClinicPitch(transcriptText),
        timestamp: new Date().toISOString()
      };
      
      try {
        if (window.db) {
          this.saveTranscriptToDatabase(this.transcriptData);
        }
      } catch (error) {
        // Silent catch
      }
    },
    
    detectPetType(text) {
      const dogKeywords = ['dog', 'puppy', 'canine', 'doggie', 'pooch'];
      const catKeywords = ['cat', 'kitten', 'feline', 'kitty'];
      
      const dogCount = dogKeywords.reduce((count, keyword) => {
        return count + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
      }, 0);
      
      const catCount = catKeywords.reduce((count, keyword) => {
        return count + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
      }, 0);
      
      if (dogCount > catCount) {
        return 'dog';
      } else if (catCount > dogCount) {
        return 'cat';
      } else if (dogCount > 0 || catCount > 0) {
        return 'both';
      }
      
      return 'unknown';
    },
    
    extractPetName(text) {
      const namePatterns = [
        /my (dog|cat|pet)(?:'s| is| named)? (\w+)/i,
        /(\w+) is my (dog|cat|pet)/i,
        /I have a (dog|cat|pet) named (\w+)/i,
        /our (dog|cat|pet)(?:'s| is| named)? (\w+)/i,
        /(\w+) has been (having|experiencing)/i,
        /about (\w+), (he|she|it|they) (is|are|has|have)/i
      ];
      
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match) {
          if (match[1].toLowerCase() === 'dog' || match[1].toLowerCase() === 'cat' || match[1].toLowerCase() === 'pet') {
            return match[2];
          } else {
            return match[1];
          }
        }
      }
      
      const words = text.split(/\s+/);
      for (let i =.0; i < words.length; i++) {
        const word = words[i];
        if (word.length >= 3 && word.length <= 12 && /^[A-Z][a-z]+$/.test(word) && 
            !['The', 'And', 'But', 'For', 'With', 'About'].includes(word)) {
          return word;
        }
      }
      
      return 'Unknown';
    },
    
    detectLifeStage(text) {
      const puppyKittenKeywords = ['puppy', 'kitten', 'young', 'baby', 'newborn', 'month old', 'weeks old'];
      const adultKeywords = ['adult', 'year old', 'mature'];
      const seniorKeywords = ['senior', 'older', 'elderly', 'aging', 'geriatric', 'old dog', 'old cat'];
      
      const isPuppyKitten = puppyKittenKeywords.some(keyword => text.toLowerCase().includes(keyword));
      const isSenior = seniorKeywords.some(keyword => text.toLowerCase().includes(keyword));
      const isAdult = adultKeywords.some(keyword => text.toLowerCase().includes(keyword));
      
      if (isPuppyKitten) return 'puppy';
      if (isSenior) return 'senior';
      if (isAdult) return 'adult';
      
      return 'unknown';
    },
    
    assessKnowledgeLevel(text) {
      const lowKnowledgePatterns = [
        /I don't know/i,
        /not sure/i,
        /confused about/i,
        /what should I/i,
        /is it okay to/i,
        /first-time/i,
        /never had a/i,
        /how do I/i
      ];
      
      const highKnowledgePatterns = [
        /I've researched/i,
        /I read that/i,
        /according to/i,
        /I understand that/i,
        /I know that/i,
        /I've been feeding/i,
        /I've been giving/i,
        /the vet recommended/i,
        /I've had pets for/i
      ];
      
      const lowMatches = lowKnowledgePatterns.filter(pattern => pattern.test(text)).length;
      const highMatches = highKnowledgePatterns.filter(pattern => pattern.test(text)).length;
      
      const score = highMatches - lowMatches;
      
      if (score >= 2) return 'high';
      if (score <= -2) return 'low';
      return 'medium';
    },
    
    extractKeyIssues(text) {
      const issueCategories = {
        diet: ['food', 'feed', 'diet', 'eating', 'nutrition', 'meal', 'appetite'],
        health: ['sick', 'pain', 'hurt', 'vet', 'medicine', 'symptoms', 'treatment', 'disease', 'condition'],
        behavior: ['behavior', 'training', 'aggressive', 'anxiety', 'scared', 'barking', 'biting', 'chewing'],
        grooming: ['groom', 'bath', 'fur', 'hair', 'brush', 'nail', 'coat', 'shedding']
      };
      
      const issues = [];
      
      for (const [category, keywords] of Object.entries(issueCategories)) {
        for (const keyword of keywords) {
          if (text.toLowerCase().includes(keyword)) {
            issues.push(category);
            break;
          }
        }
      }
      
      return issues.length > 0 ? issues.join(', ') : 'general';
    },
    
    detectCustomerCategory(text) {
      const foodKeywords = ['food', 'diet', 'feeding', 'nutrition', 'meal', 'kibble', 'wet food', 'dry food', 'treats'];
      const pharmacyKeywords = ['medicine', 'medication', 'prescription', 'tablets', 'pills', 'treatment', 'therapy'];
      
      const foodScore = foodKeywords.reduce((score, keyword) => {
        return score + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
      }, 0);
      
      const pharmacyScore = pharmacyKeywords.reduce((score, keyword) => {
        return score + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
      }, 0);
      
      if (foodScore > pharmacyScore) return 'food';
      if (pharmacyScore > foodScore) return 'pharmacy';
      return 'both';
    },
    
    detectClinicPitch(text) {
      const clinicKeywords = [
        'vet visit', 'veterinary clinic', 'check-up', 'examination', 
        'schedule an appointment', 'visit the vet', 'bring in your pet',
        'veterinary care', 'clinic', 'veterinarian'
      ];
      
      return clinicKeywords.some(keyword => text.toLowerCase().includes(keyword));
    },
    
    saveTranscriptToDatabase(transcriptData) {
      try {
        if (window.db) {
          const transcriptsRef = window.db.ref('transcripts');
          const newTranscriptRef = transcriptsRef.push();
          newTranscriptRef.set(transcriptData);
        }
      } catch (error) {
        // Silent catch
      }
    },
    
    resetToUpload() {
      if (this.elements.chatSection) this.elements.chatSection.style.display = 'none';
      if (this.elements.uploadSection) this.elements.uploadSection.style.display = 'block';
      
      if (this.elements.fileInput) this.elements.fileInput.value = '';
      if (this.elements.fileName) this.elements.fileName.textContent = '';
      if (this.elements.fileFeedback) this.elements.fileFeedback.style.display = 'none';
      
      if (this.elements.audioPlayer) this.elements.audioPlayer.src = '';
      if (this.elements.audioContainer) this.elements.audioContainer.style.display = 'none';
      if (this.elements.transcriptOptions) this.elements.transcriptOptions.style.display = 'none';
      if (this.elements.transcriptInput) this.elements.transcriptInput.value = '';
      
      this.currentTranscript = this.defaultTranscript;
      this.currentAudioFile = null;
      
      const firstMessage = this.elements.chatMessages?.firstElementChild;
      if (this.elements.chatMessages) {
        this.elements.chatMessages.innerHTML = '';
        if (firstMessage) {
          this.elements.chatMessages.appendChild(firstMessage);
        }
      }
      
      this.isSpecialPromptActive = false;
      this.activeSpecialPromptButton = null;
      
      const allButtons = document.querySelectorAll('.special-prompt-btn');
      allButtons.forEach(btn => {
        btn.style.backgroundColor = 'var(--secondary)';
        btn.classList.remove('active-special-prompt');
        btn.classList.remove('moving-border');
      });
    },
    
    sendMessage() {
      if (!this.elements.userInput) return;
      
      const userMessage = this.elements.userInput.value.trim();
      
      if (!userMessage) return;
      
      this.addMessageToChat('user', userMessage);
      this.elements.userInput.value = '';
      this.addTypingIndicator();
      this.sendToGeminiAPI(userMessage, this.currentTranscript);
    },
    
    formatMarkdown(text) {
      if (!text) return text;
      
      let formattedText = text;
      
      formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
      formattedText = formattedText.replace(/__(.*?)__/g, '<u>$1</u>');
      formattedText = formattedText.replace(/~~(.*?)~~/g, '<del>$1</del>');
      formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
      formattedText = formattedText.replace(/\n/g, '<br>');
      
      return formattedText;
    },
    
    addMessageToChat(type, text, isSpecialPrompt = false) {
      if (!this.elements.chatMessages) return;
      
      const messageDiv = document.createElement('div');
      messageDiv.className = type === 'user' ? 'message user-message' : 'message';
      
      const avatarDiv = document.createElement('div');
      avatarDiv.className = type === 'user' ? 'avatar user-avatar' : 'avatar bot-avatar';
      
      const icon = document.createElement('i');
      icon.className = type === 'user' ? 'fas fa-user' : 'fas fa-robot';
      avatarDiv.appendChild(icon);
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      
      if (type === 'bot' && this.isSpecialPromptActive && isSpecialPrompt) {
        contentDiv.classList.add('special-response');
        this.isSpecialPromptActive = false;
        
        if (this.activeSpecialPromptButton) {
          setTimeout(() => {
            this.activeSpecialPromptButton.classList.remove('moving-border');
          }, 1000);
        }
      }
      
      const textDiv = document.createElement('div');
      textDiv.className = 'message-text';
      
      if (type === 'bot') {
        textDiv.innerHTML = this.formatMarkdown(text);
      } else {
        textDiv.textContent = text;
      }
      
      contentDiv.appendChild(textDiv);
      messageDiv.appendChild(avatarDiv);
      messageDiv.appendChild(contentDiv);
      
      this.elements.chatMessages.appendChild(messageDiv);
      this.scrollChatToBottom();
    },
    
    addTypingIndicator() {
      if (!this.elements.chatMessages) return;
      
      const typingIndicator = document.createElement('div');
      typingIndicator.className = 'message';
      typingIndicator.id = 'typingIndicator';
      
      typingIndicator.innerHTML = `
        <div class="avatar bot-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      `;
      
      this.elements.chatMessages.appendChild(typingIndicator);
      this.scrollChatToBottom();
    },
    
    removeTypingIndicator() {
      const typingIndicator = document.getElementById('typingIndicator');
      if (typingIndicator) {
        typingIndicator.remove();
      }
    },
    
    async sendToGeminiAPI(userMessage, transcriptContent, isSpecialPrompt = false) {
      const prompt = `You are analyzing a transcript of a conversation. The transcript may contain spelling mistakes or unclear text due to AI transcription, but please ignore these issues and don't mention them.

IMPORTANT: Focus only on answering the user's question based on information found in the transcript.

Transcript:
${transcriptContent}

User question: ${userMessage}

Answer the question based ONLY on information found in the transcript. If you cannot find relevant information in the transcript to answer the question, simply state "I don't see that information in the transcript." DO NOT make up information or provide general knowledge that isn't in the transcript. You must answer in the same language the question is asked in, regardless of the original language of the transcript. Spell check your answers before sending, eg we're talking about pets, so 'vet' is what ill be used mostly, not 'wet'. The company's name is SuperTails, autocorrect that even if the transcript has a mistake. If asked for the entire transcript, you may provide it, but please autocorrect any issues with the transcript eg spellings grammar etc. Remember that MOSTLY, pet names will be in english, and these words will mean something, so please make sure you are providing smart well thought-out responses.`;
      
      try {
        const response = await fetch("https://solvr-api.vercel.app/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const rawText = await response.text();
        
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          data = { text: rawText };
        }
        
        this.removeTypingIndicator();
        
        let botResponse;
        
        try {
          if (data.data && data.data.candidates && 
              data.data.candidates[0] && 
              data.data.candidates[0].content && 
              data.data.candidates[0].content.parts && 
              data.data.candidates[0].content.parts[0] && 
              data.data.candidates[0].content.parts[0].text) {
            
            botResponse = data.data.candidates[0].content.parts[0].text;
          }
          else if (data.response) {
            botResponse = data.response;
          } else if (data.data && data.data.response) {
            botResponse = data.data.response;
          } else if (data.data && data.data.text) {
            botResponse = data.data.text;
          } else if (data.text) {
            botResponse = data.text;
          } else if (typeof data === 'string') {
            botResponse = data;
          } else {
            botResponse = "I'm sorry, but I couldn't process the information from the transcript.";
          }
        } catch (error) {
          botResponse = "Error processing response. Please try again.";
        }
        
        this.addMessageToChat('bot', botResponse, isSpecialPrompt);
        
      } catch (error) {
        this.removeTypingIndicator();
        this.addMessageToChat('bot', "I'm sorry, there was an error processing your request. Please try again.", isSpecialPrompt);
      }
    },
    
    addSpecialPromptButtons() {
      if (!this.elements.specialPromptButtons) return;
      
      const specialPrompts = [
        {
          label: 'Pet Knowledge',
          prompt: 'Based on the transcript, rate the pet parent\'s knowledge level about pet care on a scale of 1-10. Explain why you gave this rating with specific examples from the transcript.'
        },
        {
          label: 'Pet Diet',
          prompt: 'Based on the transcript, analyze the pet\'s diet. What are they currently feeding their pet? Are there any concerns or issues with the diet mentioned? Provide specific recommendations if appropriate.'
        },
        {
          label: 'Health Issues',
          prompt: 'Based on the transcript, identify any health issues or concerns mentioned. What symptoms or problems is the pet experiencing? What treatments or solutions have been tried or suggested?'
        },
        {
          label: 'Behavior Analysis',
          prompt: 'Based on the transcript, analyze any behavioral issues or concerns mentioned about the pet. What behaviors are problematic and what might be causing them?'
        }
      ];
      
      this.elements.specialPromptButtons.innerHTML = '';
      
      specialPrompts.forEach(item => {
        const button = this.createSpecialPromptButton(item.label, item.prompt);
        this.elements.specialPromptButtons.appendChild(button);
      });
    },
    
    createSpecialPromptButton(label, prompt) {
      const button = document.createElement('button');
      button.textContent = label;
      button.className = 'special-prompt-btn';
      
      button.addEventListener('click', () => {
        this.isSpecialPromptActive = true;
        this.activeSpecialPromptButton = button;
        this.sendSpecialPrompt(prompt);
        
        const allButtons = document.querySelectorAll('.special-prompt-btn');
        allButtons.forEach(btn => {
          btn.style.backgroundColor = 'var(--secondary)';
          btn.classList.remove('active-special-prompt');
          btn.classList.remove('moving-border');
        });
        
        button.style.backgroundColor = 'rgba(140, 82, 255, 0.2)';
        button.classList.add('active-special-prompt');
        
        this.addMovingBorder(button);
      });
      
      return button;
    },
    
    addMovingBorder(element) {
      if (!element) return;
      
      element.classList.add('moving-border');
    },
    
    sendSpecialPrompt(promptText) {
      if (!this.elements.userInput) return;
      
      this.elements.userInput.value = '';
      this.addMessageToChat('user', `🔍 ${promptText}`, true);
      
      this.addTypingIndicator();
      this.sendToGeminiAPI(promptText, this.currentTranscript, true);
    }
  }
}).mount('#app');