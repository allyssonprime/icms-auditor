import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDNiGe2t47HQWoGrsRGFRM7Yvc0aKf8rL8',
  authDomain: 'auditor-nfs.firebaseapp.com',
  projectId: 'auditor-nfs',
  storageBucket: 'auditor-nfs.firebasestorage.app',
  messagingSenderId: '394397767750',
  appId: '1:394397767750:web:d4d8483299c32b343a5247',
  measurementId: 'G-QNPEL5GHRR',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
