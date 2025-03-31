const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      currentView: 'dashboard',
      firebaseApp: null,
      db: null,
      loading: true,
      error: null,
      dashboardComponent: null,
      chatComponent: null,
      analyticsComponent: null,
      transcriptChatModalInstance: null,
      transcriptChatController: null,
    };
  },
  methods: {
    changeView(viewName) {
      this.currentView = viewName;
      this.scrollToTop();
      if (viewName === 'analytics' && this.analyticsComponent) {
         this.analyticsComponent.loadDataAndAnalyze();
      }
    },
    initializeFirebase() {
      try {
        if (typeof firebase !== 'undefined' && firebaseConfig) {
          this.firebaseApp = firebase.initializeApp(firebaseConfig);
          this.db = firebase.database();
          console.log("Firebase initialized successfully.");
        } else {
          throw new Error("Firebase configuration or library not found.");
        }
      } catch (err) {
        console.error("Firebase initialization error:", err);
        this.error = "Could not connect to the database. Some features might be unavailable.";
      }
    },
    scrollToTop() {
      const mainArea = this.$el.querySelector('.app-main > div');
      if (mainArea) {
        mainArea.scrollTop = 0;
      }
    },
    async loadComponents() {
        try {
            const dashboardModule = await import('./dashboard.js');
            const chatModule = await import('./dashboard.js');
            const analyticsModule = await import('./analytics.js');

            this.dashboardComponent = dashboardModule.dashboardComponent(this);
            this.chatComponent = chatModule.chatComponent(this);
            this.analyticsComponent = analyticsModule.analyticsComponent(this);

            this.dashboardComponent.mount('#dashboard-view');
            this.chatComponent.mount('#chat-view');
            this.analyticsComponent.mount('#analytics-view');

            const transcriptChatModule = await import('./transcriptChat.js');
            this.transcriptChatController = transcriptChatModule.createTranscriptChatController();


        } catch (error) {
            console.error("Error loading components:", error);
            this.error = "Failed to load application components.";
        }
    },
    showTranscriptChatModal(transcriptId, transcriptText) {
        if (!this.transcriptChatModalInstance) {
            const modalElement = document.getElementById('transcriptChatModal');
            if(modalElement) {
                this.transcriptChatModalInstance = new bootstrap.Modal(modalElement);
                modalElement.addEventListener('hidden.bs.modal', () => {
                    if(this.transcriptChatController) {
                        this.transcriptChatController.resetChat();
                    }
                });
            }
        }
        if(this.transcriptChatController && this.transcriptChatModalInstance) {
            this.transcriptChatController.startChat(transcriptId, transcriptText);
            this.transcriptChatModalInstance.show();
        } else {
            console.error("Modal or chat controller not initialized.");
        }
    },
     async callGeminiAPI(prompt) {
        try {
            const response = await fetch(GEMINI_API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 console.error("Gemini API Error Response:", errorText);
                 throw new Error(`API request failed with status ${response.status}`);
            }

            const rawData = await response.json();


            if (rawData.error) {
                 throw new Error(`API returned an error: ${rawData.error}`);
            }

            if (rawData.data && rawData.data.candidates && rawData.data.candidates[0] && rawData.data.candidates[0].content && rawData.data.candidates[0].content.parts && rawData.data.candidates[0].content.parts[0] && rawData.data.candidates[0].content.parts[0].text) {
                return rawData.data.candidates[0].content.parts[0].text;
            } else if (rawData.data && rawData.data.error) {
                 throw new Error(`Gemini API Error: ${rawData.data.error.message}`);
            }
            else {

                console.warn("Unexpected Gemini API response structure:", rawData);
                return "Sorry, I received an unexpected response. Please try again.";
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            return `An error occurred: ${error.message}. Please check the console for details.`;
        }
    }
  },
  async mounted() {
    this.initializeFirebase();
    await this.loadComponents();
    this.loading = false;
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      offset: 50
    });
     console.log("Main app mounted and components loaded.");

  }
});

window.app = app.mount('#app');