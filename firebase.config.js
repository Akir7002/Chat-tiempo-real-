 // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import  {getFirestore}  from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration

const firebaseConfig = {
    apiKey: "AIzaSyDnMswtZ3BPS8WTT7-QNEHtUGRjf9v14_0",
    authDomain: "chat-18fba.firebaseapp.com",
    projectId: "chat-18fba",
    storageBucket: "chat-18fba.firebasestorage.app",
    messagingSenderId: "972854388055",
    appId: "1:972854388055:web:2be997a1f0b434844c4a12"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);