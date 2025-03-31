const { createApp, ref, onMounted, nextTick } = Vue; // Import nextTick

const app = createApp({
  setup() { // Use setup() for Composition API
    const currentView = ref('dashboard');
    const firebaseApp = ref(null);
    const db = ref(null);
    const loading = ref(true);
    const error = ref(null);
    const dashboardComponentInstance = ref(null); // Store mounted instance
    const chatComponentInstance = ref(null);     // Store mounted instance
    const analyticsComponentInstance = ref(null); // Store mounted instance
    const transcriptChatModalInstance = ref(null);
    const transcriptChatController = ref(null);

    // Template Ref for scrolling
    const mainScrollContainer = ref(null);

     // Define callGeminiAPI within setup scope
    const callGeminiAPI = async (prompt) => {
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
            } else {
                console.warn("Unexpected Gemini API response structure:", rawData);
                return "Sorry, I received an unexpected response. Please try again.";
            }
        } catch (err) { // Renamed error variable to avoid conflict
            console.error("Error calling Gemini API:", err);
            // Use the ref 'error' to display UI error if needed: error.value = ...
            return `An error occurred: ${err.message}. Please check the console for details.`;
        }
    };

    // Define showTranscriptChatModal within setup scope
    const showTranscriptChatModal = (transcriptId, transcriptText) => {
        // Ensure controller is initialized before trying to use it
        if (!transcriptChatController.value) {
             console.error("Transcript chat controller not initialized yet.");
             return;
        }

        if (!transcriptChatModalInstance.value) {
            const modalElement = document.getElementById('transcriptChatModal');
            if(modalElement) {
                transcriptChatModalInstance.value = new bootstrap.Modal(modalElement);
                modalElement.addEventListener('hidden.bs.modal', () => {
                    if(transcriptChatController.value) {
                        transcriptChatController.value.resetChat();
                    }
                });
            } else {
                 console.error("Modal element #transcriptChatModal not found.");
                 return; // Can't proceed without modal element
            }
        }

        // Check if instance was successfully created
        if(transcriptChatModalInstance.value) {
             transcriptChatController.value.startChat(transcriptId, transcriptText);
             transcriptChatModalInstance.value.show();
        } else {
            console.error("Modal instance could not be created.");
        }
    };


    // Interface to pass to child components
    const mainAppInterface = {
        db: db, // Pass the ref directly, components will access .value
        callGeminiAPI: callGeminiAPI,
        showTranscriptChatModal: showTranscriptChatModal,
        // Add changeView if components need to navigate
        changeView: (viewName) => { currentView.value = viewName; scrollToTop(); }
    };


    const changeView = (viewName) => {
      currentView.value = viewName;
      scrollToTop(); // Call the fixed scrollToTop
      // Trigger data loading on analytics view activation
      if (viewName === 'analytics' && analyticsComponentInstance.value) {
         // Assuming analyticsComponent setup returns loadDataAndAnalyze
         if (typeof analyticsComponentInstance.value.loadDataAndAnalyze === 'function') {
             analyticsComponentInstance.value.loadDataAndAnalyze();
         } else {
            console.warn("loadDataAndAnalyze method not found on analytics component instance.");
         }
      }
    };

    const initializeFirebase = () => {
      try {
        // firebaseConfig should be global from config.js
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
          const appInstance = firebase.initializeApp(firebaseConfig);
          firebaseApp.value = appInstance;
          db.value = firebase.database();
          console.log("Firebase initialized successfully.");
        } else {
          throw new Error("Firebase configuration or library not found.");
        }
      } catch (err) { // Renamed error variable
        console.error("Firebase initialization error:", err);
        error.value = "Could not connect to the database. Some features might be unavailable.";
      }
    };

    const scrollToTop = () => {
        // Use Template Ref and nextTick
        nextTick(() => {
           if (mainScrollContainer.value) {
               mainScrollContainer.value.scrollTop = 0;
           } else {
               console.warn("mainScrollContainer ref not found for scrolling.");
           }
        });
    };

    const loadComponents = async () => {
        try {
            console.log("Attempting to load components...");
            // Dynamic imports work with setup()
            const dashboardModule = await import('./dashboard.js');
            console.log("Imported dashboardModule:", dashboardModule);
             if (!dashboardModule || typeof dashboardModule.dashboardComponent !== 'function') {
                 throw new Error("dashboard.js did not export dashboardComponent correctly.");
             }

            const chatModule = await import('./chat.js');
            console.log("Imported chatModule:", chatModule); // Check this log carefully
             if (!chatModule || typeof chatModule.chatComponent !== 'function') {
                 // This is where the error likely originates
                 console.error("chat.js did not export chatComponent function correctly.", chatModule);
                 throw new Error("Failed to load chat component structure from chat.js.");
             }

            const analyticsModule = await import('./analytics.js');
             console.log("Imported analyticsModule:", analyticsModule);
             if (!analyticsModule || typeof analyticsModule.analyticsComponent !== 'function') {
                 throw new Error("analytics.js did not export analyticsComponent correctly.");
             }

            const transcriptChatModule = await import('./transcriptChat.js');
            console.log("Imported transcriptChatModule:", transcriptChatModule);
             if (!transcriptChatModule || typeof transcriptChatModule.createTranscriptChatController !== 'function') {
                 throw new Error("transcriptChat.js did not export createTranscriptChatController correctly.");
             }

            // Create component applications
            const dashboardApp = dashboardModule.dashboardComponent(mainAppInterface);
            const chatApp = chatModule.chatComponent(mainAppInterface);
            const analyticsApp = analyticsModule.analyticsComponent(mainAppInterface);

             // Mount components and store instance proxies
            dashboardComponentInstance.value = dashboardApp.mount('#dashboard-view');
            chatComponentInstance.value = chatApp.mount('#chat-view');
            analyticsComponentInstance.value = analyticsApp.mount('#analytics-view');

            // Initialize controller separately
            transcriptChatController.value = transcriptChatModule.createTranscriptChatController(mainAppInterface);

            console.log("Components mounted successfully.");

        } catch (err) { // Renamed error variable
            console.error("Error loading or mounting components:", err);
            error.value = `Failed to load application components: ${err.message}`; // Show specific error
        }
    };

    onMounted(async () => {
        console.log("Main app 'onMounted' starting...");
        initializeFirebase();
        await loadComponents(); // Wait for components load attempt
        loading.value = false; // Set loading false AFTER load attempt
        AOS.init({
          duration: 600,
          easing: 'ease-in-out',
          once: true,
          offset: 50
        });
         console.log("Main app 'onMounted' finished.");
    });

    // Return reactive state and methods needed by the template
    return {
        currentView,
        loading,
        error,
        changeView,
        mainScrollContainer // Expose the ref for the template '<div ref="mainScrollContainer">...'
    };
  } // End of setup()
});

// Mount the app
window.app = app.mount('#app');