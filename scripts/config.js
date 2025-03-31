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
  
  function initializeFirebase() {
    try {
      if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        window.db = db;
        return db;
      }
    } catch (error) {
      console.error("Firebase initialization error:", error);
      db = createMockDatabase();
      window.db = db;
    }
    return db;
  }
  
  function createMockDatabase() {
    const mockData = {
      transcripts: {
        "sample1": {
          text: "My dog Max is having some issues with his diet. He's about 3 years old and I've been feeding him regular kibble, but he seems to have less energy lately. The vet recommended a higher protein diet. Should I switch brands?",
          petType: "dog",
          petName: "Max",
          lifeStage: "adult",
          knowledgeLevel: "medium",
          keyIssues: "diet, health",
          customerCategory: "food",
          clinicPitched: true,
          timestamp: new Date().toISOString()
        },
        "sample2": {
          text: "I have a new kitten named Luna, she's just 3 months old. I'm a first-time cat owner and I'm not sure how often to feed her. Also, when should I schedule her next vaccination?",
          petType: "cat",
          petName: "Luna",
          lifeStage: "puppy",
          knowledgeLevel: "low",
          keyIssues: "diet, health",
          customerCategory: "food",
          clinicPitched: false,
          timestamp: new Date().toISOString()
        },
        "sample3": {
          text: "My senior dog Bailey needs medication for arthritis. I've been giving him the pills the vet prescribed but he's having trouble swallowing them. Is there a different form I can get?",
          petType: "dog",
          petName: "Bailey",
          lifeStage: "senior",
          knowledgeLevel: "high",
          keyIssues: "health",
          customerCategory: "pharmacy",
          clinicPitched: true,
          timestamp: new Date().toISOString()
        }
      }
    };
    
    let nextId = 1;
    
    return {
      ref: function(path) {
        return {
          on: function(event, callback) {
            if (event === 'value') {
              setTimeout(() => {
                callback({
                  val: function() {
                    return path === 'transcripts' ? mockData.transcripts : null;
                  }
                });
              }, 500);
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
  
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      initializeFirebase();
    }, 200);
  });