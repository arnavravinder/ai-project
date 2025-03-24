// Firebase configuration
const firebaseConfig = {
    // Use hardcoded values for development, replace these with your own Firebase project details
    apiKey: "AIzaSyCMF36GhBxsMpbl1c8BYdcAN_7PwLclVVs",
    authDomain: "super-tails.firebaseapp.com",
    databaseURL: "https://super-tails-default-rtdb.firebaseio.com",
    projectId: "super-tails",
    storageBucket: "super-tails.firebasestorage.app",
    messagingSenderId: "210460279486",
    appId: "1:210460279486:web:e98a0775f4e32268c894ef",
    measurementId: "G-HFM274BKGV"  };
  
  // Initialize Firebase
  let db = null;
  
  function initializeFirebase() {
    try {
      if (firebase) {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        console.log("Firebase initialized successfully");
        return db;
      }
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      // Create a mock database for local development if Firebase fails to initialize
      db = createMockDatabase();
    }
    return db;
  }
  
  // Create a mock database for local development
  function createMockDatabase() {
    console.log("Creating mock database");
    
    const mockData = {
      transcripts: {}
    };
    
    let nextId = 1;
    
    return {
      ref: function(path) {
        return {
          on: function(event, callback) {
            if (event === 'value') {
              callback({
                val: function() {
                  return path === 'transcripts' ? mockData.transcripts : null;
                }
              });
            }
          },
          push: function() {
            const id = `mock-id-${nextId++}`;
            return {
              set: function(data) {
                mockData.transcripts[id] = data;
                return Promise.resolve();
              }
            };
          }
        };
      }
    };
  }
  
  // Initialize Firebase on script load
  document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
  });