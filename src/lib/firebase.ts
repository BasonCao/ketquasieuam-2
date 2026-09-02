import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCqgaKSpQoFRfXKL24eDXSttNZ6dUe74cA",
  authDomain: "linen-drake-nn96h.firebaseapp.com",
  projectId: "linen-drake-nn96h",
  storageBucket: "linen-drake-nn96h.firebasestorage.app",
  messagingSenderId: "476466335521",
  appId: "1:476466335521:web:1681b6dc060ecdffff3860",
  databaseId: "ai-studio-ultraformai-4b48847c-9740-4b82-b7c9-35bbdae9ffac"
};

let app;
let db: any = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, "ai-studio-ultraformai-4b48847c-9740-4b82-b7c9-35bbdae9ffac");
} catch (e) {
  console.error("Firebase init error:", e);
}

export { db };
