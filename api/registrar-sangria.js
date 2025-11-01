// /api/registrar-sangria.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase/firestore";

// Suas credenciais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB9LJ-7bOvHGYyFE_H2Qd7XFcyjmSPq_ro",
  authDomain: "samia-cardapio.firebaseapp.com",
  projectId: "samia-cardapio",
  storageBucket: "samia-cardapio.firebasestorage.app",
  messagingSenderId: "223260436641",
  appId: "1:223260436641:web:adf78e77a0267f66f1e8e0"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- FUNÇÃO PRINCIPAL ---
export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { amount, reason, userEmail, cashRegisterId } = req.body;

        if (!amount || !reason || !userEmail || !cashRegisterId) {
            return res.status(400).json({ error: 'Dados da sangria incompletos.' });
        }

        const timestamp = new Date();

        // Salva a sangria no Firestore, dentro do documento do caixa atual
        const cashRegisterRef = doc(db, "caixas", cashRegisterId);
        const sangriaData = {
            amount,
            reason,
            userEmail,
            timestamp
        };
        await updateDoc(cashRegisterRef, {
            sangrias: arrayUnion(sangriaData)
        });

        res.status(200).json({ success: true, message: 'Sangria registrada com sucesso!' });

    } catch (error) {
        console.error('Erro ao registrar sangria:', error);
        res.status(500).json({ error: 'Erro interno no servidor.', details: error.message });
    }
};
