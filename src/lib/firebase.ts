// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAazS8f8-G0Wigt46j5vj7HTZjplcajFRY",
  authDomain: "stock-inventory-918cc.firebaseapp.com",
  projectId: "stock-inventory-918cc",
  storageBucket: "stock-inventory-918cc.firebasestorage.app",
  messagingSenderId: "364811359425",
  appId: "1:364811359425:web:5c253ec19bef838e39f040",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
