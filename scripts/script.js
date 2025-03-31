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
            // GEMINI_API_ENDPOINT is global via config.js now
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

            // Check the specific structure returned by *your* API endpoint
            if (rawData.data && rawData.data.candidates && rawData.data.candidates[0] && rawData.data.candidates[0].content && rawData.data.candidates[0].content.parts && rawData.data.candidates[0].content.parts[0] && rawData.data.candidates[0].content.parts[0].text) {
                return rawData.data.candidates[0].content.parts[0].text;
            } else if (rawData.data && rawData.data.error) { // Handle errors reported within the 'data' object
                 throw new Error(`Gemini API Error: ${rawData.data.error.message}`);
            } else {
                console.warn("Unexpected Gemini API response structure:", rawData);
                // Attempt to find text in other possible locations if needed, or return default
                return rawData?.data?.text || rawData?.text || "Sorry, I received an unexpected response. Please try again.";
            }
        } catch (err) {
            console.error("Error calling Gemini API:", err);
            error.value = `Failed to communicate with AI: ${err.message}`; // Update UI error
            return `An error occurred: ${err.message}. Please check the console for details.`;
        }
    };

    // Define showTranscriptChatModal within setup scope
    const showTranscriptChatModal = (transcriptId, transcriptText) => {
        if (!transcriptChatController.value) {
             console.error("Transcript chat controller not initialized yet.");
             error.value = "Chat feature is not ready."; // Inform user
             return;
        }

        if (!transcriptChatModalInstance.value) {
            const modalElement = document.getElementById('transcriptChatModal');
            if(modalElement) {
                // Create new modal instance if it doesn't exist
                transcriptChatModalInstance.value = new bootstrap.Modal(modalElement);
                // Add event listener only once
                modalElement.addEventListener('hidden.bs.modal', () => {
                    if(transcriptChatController.value) {
                        transcriptChatController.value.resetChat();
                    }
                });
            } else {
                 console.error("Modal element #transcriptChatModal not found.");
                 error.value = "Cannot open chat modal: UI element missing.";
                 return;
            }
        }

        if(transcriptChatModalInstance.value) {
             transcriptChatController.value.startChat(transcriptId, transcriptText);
             transcriptChatModalInstance.value.show(); // Show the modal
        } else {
            console.error("Modal instance could not be created or retrieved.");
            error.value = "Failed to initialize chat modal.";
        }
    };


    // Interface object passed to child components
    const mainAppInterface = {
        // Pass refs directly; child components use .value if needed inside their setup
        db: db,
        callGeminiAPI: callGeminiAPI,
        showTranscriptChatModal: showTranscriptChatModal,
        // No need to pass changeView if only parent handles navigation
        getFirebaseDb: () => db.value // Provide a getter function if direct ref is problematic
    };


    const changeView = (viewName) => {
      currentView.value = viewName;
      scrollToTop();
      // Trigger data loading on analytics view activation
      if (viewName === 'analytics' && analyticsComponentInstance.value) {
         // Check if the function exists on the mounted component's proxy
         if (analyticsComponentInstance.value && typeof analyticsComponentInstance.value.loadDataAndAnalyze === 'function') {
             analyticsComponentInstance.value.loadDataAndAnalyze();
         } else {
            console.warn("loadDataAndAnalyze method not found on analytics component instance.", analyticsComponentInstance.value);
         }
      }
    };

    const initializeFirebase = () => {
      try {
        // Use the globally available firebaseConfig from config.js
        if (typeof firebase !== 'undefined' && typeof window.firebaseConfig !== 'undefined') {
          const appInstance = firebase.initializeApp(window.firebaseConfig);
          firebaseApp.value = appInstance;
          db.value = firebase.database();
          console.log("Firebase initialized successfully.");
        } else {
          throw new Error("Firebase configuration or library not found. Make sure config.js is loaded correctly.");
        }
      } catch (err) {
        console.error("Firebase initialization error:", err);
        error.value = `Could not connect to the database: ${err.message}`; // More specific error
      }
    };

    const scrollToTop = () => {
        nextTick(() => {
           if (mainScrollContainer.value) {
               mainScrollContainer.value.scrollTop = 0;
           } else {
               // This might happen briefly during initial load, usually not critical
               console.warn("mainScrollContainer ref not yet available for scrolling.");
           }
        });
    };

    const loadComponents = async () => {
        try {
            console.log("Attempting to load components...");
            const dashboardModule = await import('./dashboard.js');
            console.log("Imported dashboardModule:", dashboardModule);
             if (!dashboardModule || typeof dashboardModule.dashboardComponent !== 'function') {
                 throw new Error("dashboard.js did not export dashboardComponent function correctly.");
             }

            const chatModule = await import('./chat.js');
            console.log("Imported chatModule:", chatModule);
             if (!chatModule || typeof chatModule.chatComponent !== 'function') {
                 console.error("chat.js structure issue:", chatModule);
                 throw new Error("Failed to load chat component structure from chat.js.");
             }

            const analyticsModule = await import('./analytics.js');
             console.log("Imported analyticsModule:", analyticsModule);
             if (!analyticsModule || typeof analyticsModule.analyticsComponent !== 'function') {
                 throw new Error("analytics.js did not export analyticsComponent function correctly.");
             }

            const transcriptChatModule = await import('./transcriptChat.js');
            console.log("Imported transcriptChatModule:", transcriptChatModule);
             if (!transcriptChatModule || typeof transcriptChatModule.createTranscriptChatController !== 'function') {
                 throw new Error("transcriptChat.js did not export createTranscriptChatController function correctly.");
             }

            // Create component applications, passing the interface
            const dashboardApp = dashboardModule.dashboardComponent(mainAppInterface);
            const chatApp = chatModule.chatComponent(mainAppInterface);
            const analyticsApp = analyticsModule.analyticsComponent(mainAppInterface);

             // Mount components and store their instance proxies
            dashboardComponentInstance.value = dashboardApp.mount('#dashboard-view');
            chatComponentInstance.value = chatApp.mount('#chat-view');
            analyticsComponentInstance.value = analyticsApp.mount('#analytics-view');

            // Initialize controller separately, passing the interface
            transcriptChatController.value = transcriptChatModule.createTranscriptChatController(mainAppInterface);

            console.log("Components mounted successfully.");

        } catch (err) {
            console.error("Error loading or mounting components:", err);
            error.value = `Failed to load application components: ${err.message}`; // Display error in UI
        }
    };

    onMounted(async () => {
        console.log("Main app 'onMounted' starting...");
        initializeFirebase();
        // Only proceed to load components if Firebase init didn't set an error
        if (!error.value) {
             await loadComponents();
        }
        loading.value = false; // Set loading false AFTER attempts
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
        mainScrollContainer // Expose the ref for the template
    };
  } // End of setup()
});

// Mount the app
window.app = app.mount('#app'); // Assign to window if needed globally, otherwise just mount
