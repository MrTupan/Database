/* --- STEP 1: DEFINE FIREBASE KEYS --- */
// These are the exact credentials from your original Workshop Tracker project
var firebaseConfig = {
  apiKey: "AIzaSyDtBnX_4rYKcRcfux0tGiPo9SH1dCU9Y9I",
  authDomain: "workshoptracker-b5342.firebaseapp.com",
  projectId: "workshoptracker-b5342",
  storageBucket: "workshoptracker-b5342.firebasestorage.app",
  messagingSenderId: "428031818196",
  appId: "1:428031818196:web:0e2ec9fb79e21be487be41",
  databaseURL: "https://workshoptracker-b5342-default-rtdb.firebaseio.com"
};

/* --- STEP 2: INITIALIZE APP --- */
// This starts the connection to Google Firebase
firebase.initializeApp(firebaseConfig);

/* --- STEP 3: EXPOSE DATABASE GLOBALLY --- */
// We define 'db' globally so that all our separate logic files 
// (transactions.js, workers.js, etc.) can save data to the cloud.
window.db = firebase.database();

console.log("Firebase Engine: Connected to Workshop Tracker Cloud ☁️");