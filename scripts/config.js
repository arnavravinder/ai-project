const firebaseConfig = {
  apiKey: "AIzaSyCMF36GhBxsMpbl1c8BYdcAN_7PwLclVVs", // KEEP YOUR ACTUAL KEY HERE
  authDomain: "super-tails.firebaseapp.com",
  databaseURL: "https://super-tails-default-rtdb.firebaseio.com",
  projectId: "super-tails",
  storageBucket: "super-tails.firebasestorage.app",
  messagingSenderId: "210460279486",
  appId: "1:210460279486:web:e98a0775f4e32268c894ef",
  measurementId: "G-HFM274BKGV"
};

let db = null;
let firebaseInitializationPromise = null;

function initializeFirebase() {
  if (firebaseInitializationPromise) {
      return firebaseInitializationPromise;
  }

  firebaseInitializationPromise = new Promise((resolve, reject) => {
      try {
          if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
               if (firebase.apps.length === 0) {
                  firebase.initializeApp(firebaseConfig);
                  console.log("Firebase app initialized.");
               } else {
                  console.log("Firebase app already initialized.");
               }
              db = firebase.database();
              window.db = db;
              console.log("Firebase Realtime Database instance obtained.");
              resolve(db);
          } else {
              console.error("Firebase library not loaded correctly.");
              reject(new Error("Firebase library failed to load. Cannot connect to database."));
          }
      } catch (error) {
          console.error("Firebase initialization error:", error);
          reject(new Error(`Firebase initialization failed: ${error.message}`));
      }
  });

  return firebaseInitializationPromise;
}

initializeFirebase().catch(error => {
  console.error("Initial Firebase setup failed:", error);
  // Optionally display a persistent error message to the user here
  // e.g., document.body.innerHTML = '<h1>Error connecting to database. Please refresh.</h1>';
});
