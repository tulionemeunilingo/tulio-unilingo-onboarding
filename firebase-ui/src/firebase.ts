// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBvx6Ws-QqYcmeVldIqbfBJoNRKZhESwXs",
  authDomain: "unilingo-onboarding.firebaseapp.com",
  projectId: "unilingo-onboarding",
  storageBucket: "unilingo-onboarding.firebasestorage.app",
  messagingSenderId: "118158972944",
  appId: "1:118158972944:web:7086ac8ee6bf24ca129295",
  measurementId: "G-KDMV9WVC3J",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
