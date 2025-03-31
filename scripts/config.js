const firebaseConfig = {
  apiKey: "AIzaSyCMF36GhBxsMpbl1c8BYdcAN_7PwLclVVs",
  authDomain: "super-tails.firebaseapp.com",
  databaseURL: "https://super-tails-default-rtdb.firebaseio.com",
  projectId: "super-tails",
  storageBucket: "super-tails.firebasestorage.app",
  messagingSenderId: "210460279486",
  appId: "1:210460279486:web:e98a0775f4e32268c894ef",
  measurementId: "G-HFM274BKGV"
};

let db = null;
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return db;
  try {
      if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
          firebase.initializeApp(firebaseConfig);
          db = firebase.database();
          window.db = db;
          firebaseInitialized = true;
          console.log("Firebase initialized successfully.");
          return db;
      } else {
         console.error("Firebase library not loaded correctly.");
         db = createMockDatabase();
         window.db = db;
         firebaseInitialized = true; // Mark as initialized to avoid retries
         return db;
      }
  } catch (error) {
      console.error("Firebase initialization error:", error);
      db = createMockDatabase();
      window.db = db;
      firebaseInitialized = true; // Mark as initialized to avoid retries
      return db;
  }
}

function createMockDatabase() {
  console.log("Creating Mock Database.");
  const mockData = {
      transcripts: {
          "mock_sample1": {
              text: "My dog Max is having some issues with his diet. He's about 3 years old and I've been feeding him regular kibble, but he seems to have less energy lately. The vet recommended a higher protein diet. Should I switch brands?",
              petType: "dog", petName: "Max", lifeStage: "adult", knowledgeLevel: "medium", keyIssues: "diet, health", customerCategory: "food", clinicPitched: true, uniqueId: "user1@example.com", timestamp: new Date(Date.now() - 86400000).toISOString(), firebaseId: "mock_sample1" // Yesterday
          },
          "mock_sample2": {
              text: "I have a new kitten named Luna, she's just 3 months old. I'm a first-time cat owner and I'm not sure how often to feed her. Also, when should I schedule her next vaccination?",
              petType: "cat", petName: "Luna", lifeStage: "puppy", knowledgeLevel: "low", keyIssues: "diet, health", customerCategory: "food", clinicPitched: false, uniqueId: "user2@example.com", timestamp: new Date(Date.now() - 172800000).toISOString(), firebaseId: "mock_sample2" // 2 days ago
          },
          "mock_sample3": {
              text: "My senior dog Bailey needs medication for arthritis. I've been giving him the pills the vet prescribed but he's having trouble swallowing them. Is there a different form I can get?",
              petType: "dog", petName: "Bailey", lifeStage: "senior", knowledgeLevel: "high", keyIssues: "health", customerCategory: "pharmacy", clinicPitched: true, uniqueId: "user3@example.com", timestamp: new Date().toISOString(), firebaseId: "mock_sample3" // Today
          }
      }
  };
  let nextId = 4;

  return {
      ref: function(path) {
          return {
              on: function(event, callback, errorCallback) {
                  if (event === 'value') {
                      console.log(`Mock DB: Subscribing to ${path}`);
                      setTimeout(() => {
                          const dataSnapshot = {
                              val: function() {
                                  return path === 'transcripts' ? mockData.transcripts : null;
                              },
                              exists: function() {
                                  return path === 'transcripts' && mockData.transcripts && Object.keys(mockData.transcripts).length > 0;
                              }
                          };
                          callback(dataSnapshot);
                      }, 300);
                  } else {
                       console.log(`Mock DB: Unsupported event type '${event}' for path '${path}'`);
                       if (errorCallback) setTimeout(() => errorCallback(new Error("Mock DB doesn't support this event type")), 10);
                  }
              },
              push: function() {
                  const id = `mock-id-${nextId++}`;
                  return {
                      key: id,
                      set: function(data) {
                           console.log(`Mock DB: Pushing data to transcripts/${id}`);
                           const dataWithTimestamp = {
                              ...data,
                              timestamp: data.timestamp || new Date().toISOString(),
                              firebaseId: id
                           };
                          mockData.transcripts[id] = dataWithTimestamp;
                          return Promise.resolve();
                      }
                  };
              },
               off: function() {
                  console.log(`Mock DB: Unsubscribing from ${path}`);
                  // No-op in mock
              }
          };
      }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
      initializeFirebase();
  }, 200);
});
