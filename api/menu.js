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

// URL da sua planilha de cardápio no Google Sheets
// Certifique-se de que a planilha está publicada na web
const CARDAPIO_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn3TzLgP78zF62H2S-q9fM0385_12345/pub?gid=0&single=true&output=csv";
const PROMOCOES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn3TzLgP78zF62H2S-q9fM0385_12345/pub?gid=587877543&single=true&output=csv";
const DELIVERY_FEES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn3TzLgP78zF62H2S-q9fM0385_12345/pub?gid=1527029562&single=true&output=csv";
const INGREDIENTES_HAMBURGUER_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn3TzLgP78zF62H2S-q9fM0385_12345/pub?gid=1980894080&single=true&output=csv";
const CONTACT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn3TzLgP78zF62H2S-q9fM0385_12345/pub?gid=1520144445&single=true&output=csv";

// Função para converter CSV em JSON
const parseCsvData = (csvText) => {
    const [headerLine, ...bodyLines] = csvText.trim().split('\n');
    const headers = headerLine.split(',').map(header => header.trim().replace(/"/g, ''));
    return bodyLines.map(line => {
        const values = line.split(',').map(val => val.trim().replace(/"/g, ''));
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
        }, {});
    });
};

export default async (req, res) => {
    // Garantir que é uma requisição GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

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
        const itemConfig = itemStatusSnap.exists() ? itemStatusSnap.data() : {};

        cardapioJson = cardapioJson.map(item => {
            const config = itemConfig[item.id] || {}; // Pega a configuração específica do item
            
            // NOVO: Adiciona o status de 'meia a meia' ao objeto do item
            item.allowHalfAndHalf = config.allowHalfAndHalf !== undefined ? config.allowHalfAndHalf : true;

            // Código existente para a disponibilidade 'available'
            item.available = config.available !== undefined ? config.available : true;
            
            // NOVO: Adiciona o status de visibilidade
            item.visible = config.visible !== undefined ? config.visible : true;
            
            return item;
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
        res.status(500).json({ error: 'Falha interna do servidor.' });
    }
};
