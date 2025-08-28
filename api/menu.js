// Este arquivo é uma função Serverless para o Vercel.
// Ele foi atualizado para ler a nova coluna "preço 10 fatias" da planilha.

import fetch from 'node-fetch';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Suas credenciais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB9LJ-7bOvHGYyFE_H2Qd7XFcyjmSPq_ro",
  authDomain: "samia-cardapio.firebaseapp.com",
  projectId: "samia-cardapio",
  storageBucket: "samia-cardapio.firebasestorage.app",
  messagingSenderId: "223260436641",
  appId: "1:223260436641:web:adf78e77a0267f66f1e8e0"
};

// Inicializa o Firebase de forma segura (evita reinicialização)
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}
const db = getFirestore(app);

// URL do Google Sheets (planilha de cardápio)
const CARDAPIO_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUmJgK9fI5_0Fp-iQf8u_H_gI8yTq9J5uC0sYy0T1J7w/pub?gid=324234&single=true&output=csv';
const PROMOCOES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUmJgK9fI5_0Fp-iQf8u_H_gI8yTq9J5uC0sYy0T1J7w/pub?gid=1815933614&single=true&output=csv';
const DELIVERY_FEES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUmJgK9fI5_0Fp-iQf8u_H_gI8yTq9J5uC0sYy0T1J7w/pub?gid=942557438&single=true&output=csv';
const INGREDIENTES_HAMBURGUER_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUmJgK9fI5_0Fp-iQf8u_H_gI8yTq9J5uC0sYy0T1J7w/pub?gid=2040523035&single=true&output=csv';
const CONTACT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUmJgK9fI5_0Fp-iQf8u_H_gI8yTq9J5uC0sYy0T1J7w/pub?gid=1827677815&single=true&output=csv';


// Função para analisar os dados CSV
function parseCsvData(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(';').map(header => header.trim().replace(/"/g, ''));
    const data = lines.slice(1).map(line => {
        const values = line.split(';').map(value => value.trim().replace(/"/g, ''));
        const item = {};
        headers.forEach((header, i) => {
            item[header] = values[i];
        });
        return item;
    });
    return data;
}

export default async (req, res) => {
    try {
        const fetchData = async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Falha ao buscar dados de ${url}`);
            return response.text();
        };

        const [
            cardapioCsv,
            promocoesCsv,
            deliveryFeesCsv,
            ingredientesHamburguerCsv,
            contactCsv
        ] = await Promise.all([
            fetchData(CARDAPIO_CSV_URL),
            fetchData(PROMOCOES_CSV_URL),
            fetchData(DELIVERY_FEES_CSV_URL),
            fetchData(INGREDIENTES_HAMBURGUER_CSV_URL),
            fetchData(CONTACT_CSV_URL)
        ]);

        let cardapioJson = parseCsvData(cardapioCsv);

        const itemStatusRef = doc(db, "config", "item_status");
        const itemStatusSnap = await getDoc(itemStatusRef);
        const unavailableItems = itemStatusSnap.exists() ? itemStatusSnap.data() : {};

        cardapioJson = cardapioJson.map(item => {
            const status = unavailableItems[item.id] || {};
            // Adiciona o status de 'meiaMeiaEnabled' ao objeto do item, com valor padrão 'true' se não existir
            return {
                ...item,
                available: status.available !== undefined ? status.available : true,
                meiaMeiaEnabled: status.meiaMeiaEnabled !== undefined ? status.meiaMeiaEnabled : true,
                visible: status.visible !== undefined ? status.visible : true,
            };
        });

        res.status(200).json({
            cardapio: cardapioJson,
            promocoes: parseCsvData(promocoesCsv),
            deliveryFees: parseCsvData(deliveryFeesCsv),
            ingredientesHamburguer: parseCsvData(ingredientesHamburguerCsv),
            contact: parseCsvData(contactCsv)
        });

    } catch (error) {
        console.error('Vercel Function: Erro fatal:', error.message);
        res.status(500).json({ error: 'Erro ao buscar os dados do cardápio.' });
    }
};

