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
  
  // Ensure these are accessible globally IF needed by non-module scripts,
  // otherwise keep them scoped if only used within modules.
  // Since script.js is a module and imports others, they can access these via the mainAppInterface if passed.
  const GEMINI_API_ENDPOINT = "https://supertails.vercel.app/api/gemini";
  const TRANSCRIBE_API_ENDPOINT = "https://supertails.vercel.app/api/transcribe";
  
  // Make firebaseConfig globally available for initializeFirebase in script.js
  window.firebaseConfig = firebaseConfig;
  