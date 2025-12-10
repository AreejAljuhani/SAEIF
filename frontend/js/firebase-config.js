// frontend/js/firebase-config.js

// 1) Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDeoQPiTnqRcYktVQ8KZfkfwRrpe7RM5QE",
  authDomain: "saeif-9eceb.firebaseapp.com",
  projectId: "saeif-9eceb",
  storageBucket: "saeif-9eceb.firebasestorage.app",
  messagingSenderId: "432650335208",
  appId: "1:432650335208:web:81a04042e6ed74be8d2a5d",
  measurementId: "G-4223D38RGJ"
};

// 2) Initialize Firebase
firebase.initializeApp(firebaseConfig);

// 3) Firestore Reference
const db = firebase.firestore();

// 4) Make db global
window.db = db;
