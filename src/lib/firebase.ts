
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "studio-8867609365-e1454",
  "appId": "1:606856816045:web:b74c33836dfe99597b2d24",
  "storageBucket": "studio-8867609365-e1454.appspot.com",
  "apiKey": "AIzaSyBllYuCJ_7e7QXzWkmStlTZOACnKPMMYkc",
  "authDomain": "studio-8867609365-e1454.firebaseapp.com",
  "messagingSenderId": "606856816045"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
