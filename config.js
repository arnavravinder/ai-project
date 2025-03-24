const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };
  
  function initializeFirebase() {
    if (firebase && firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
      return firebase.database();
    } else if (firebase) {
      return firebase.database();
    }
    return null;
  }
  
  const db = initializeFirebase();