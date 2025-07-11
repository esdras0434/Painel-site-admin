import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCuCbBesvbrOvdzdv1cmCF7M2uaaUfWRU0",
  authDomain: "meupontoapp-d5d3b.firebaseapp.com",
  databaseURL: "https://meupontoapp-d5d3b-default-rtdb.firebaseio.com",
  projectId: "meupontoapp-d5d3b",
  storageBucket: "meupontoapp-d5d3b.firebasestorage.app",
  messagingSenderId: "700159340275",
  appId: "1:700159340275:web:51094e94b4159521cf5186",
  measurementId: "G-1TX8XYMSVK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
