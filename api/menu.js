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


// URLs das suas planhas Google Sheets publicadas como CSV.
const CARDAPIO_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDOVxav8wiNNTL5Jt1Cq3F3fBD7yLyHLGi2c_0r1abHVZRY2W7RbW3h4FX_poEdCXE8Tl85KGAU28v/pub?gid=1575270352&single=true&output=csv'; 
const PROMOCOES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDOVxav8wiNNTL5Jt1Cq3F3fBD7yLyHLGi2c_0r1abHVZRY2W7RbW3h4FX_poEdCXE8Tl85KGAU28v/pub?gid=1622604495&single=true&output=csv'; 
const DELIVERY_FEES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDOVxav8wiNNTL5Jt1Cq3F3fBD7yLyHLGi2c_0r1abHVZRY2W7RbW3h4FX_poEdCXE8Tl85KGAU28v/pub?gid=1298581759&single=true&output=csv';
const INGREDIENTES_HAMBURGUER_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDOVxav8wiNNTL5Jt1Cq3F3fBD7yLyHLGi2c_0r1abHVZRY2W7RbW3h4FX_poEdCXE8Tl85KGAU28v/pub?gid=679334079&single=true&output=csv';
const CONTACT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDOVxav8wiNNTL5Jt1Cq3F3fBD7yLyHLGi2c_0r1abHVZRY2W7RbW3h4FX_poEdCXE8Tl85KGAU28v/pub?gid=1298581759&single=true&output=csv';

// Leitor de linha CSV robusto que lida com vírgulas dentro de aspas
function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Pula a próxima aspa (escapada)
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            // Ignora o caractere de retorno de carro
            if (char !== '\r') {
               current += char;
            }
        }
    }
    values.push(current.trim());
    return values;
}

// Função principal para converter texto CSV em um array de objetos JSON
function parseCsvData(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headersRaw = parseCsvLine(lines[0]);
    const mappedHeaders = headersRaw.map(header => {
        const headerMapping = {
            'id item (único)': 'id', 'nome do item': 'name', 'descrição': 'description',
            'preço 4 fatias': 'price4Slices', 'preço 6 fatias': 'price6Slices',
            'preço 8 fatias': 'basePrice', 'preço 10 fatias': 'price10Slices', // <-- NOVA COLUNA ADICIONADA
            'categoria': 'category', 'é pizza? (sim/não)': 'isPizza', 'é montável? (sim/não)': 'isCustomizable',
            'disponível (sim/não)': 'available', 'imagem': 'imageUrl', 'id promocao': 'id',
            'nome da promocao': 'name', 'preco promocional': 'promoPrice', 'id item aplicavel': 'itemId',
            'ativo (sim/nao)': 'active', 'bairros': 'neighborhood', 'valor frete': 'deliveryFee',
            'id intem': 'id', 'ingredientes': 'name', 'preço': 'price', 'seleção única': 'isSingleChoice',
            'limite': 'limit', 'limite ingrediente': 'ingredientLimit',
            'é obrigatório?(sim/não)': 'isRequired', 'disponível': 'available',
            'dados': 'data', 'valor': 'value'
        };
        const cleanHeader = header.trim().toLowerCase();
        return headerMapping[cleanHeader] || cleanHeader.replace(/\s/g, '').replace(/[^a-z0-9]/g, '');
    });

    const parsedData = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length === mappedHeaders.length) {
            let item = {};
            mappedHeaders.forEach((headerKey, j) => {
                let value = values[j];
                // <-- NOVA COLUNA ADICIONADA À LISTA DE PREÇOS
                if (['basePrice', 'price6Slices', 'price4Slices', 'price10Slices', 'promoPrice', 'deliveryFee', 'price'].includes(headerKey)) {
                    item[headerKey] = parseFloat(String(value).replace(',', '.')) || 0;
                } else if (headerKey === 'limit') {
                    const parsedValue = parseInt(value, 10);
                    item[headerKey] = isNaN(parsedValue) ? Infinity : parsedValue;
                } else if (headerKey === 'ingredientLimit') {
                    const parsedValue = parseInt(value, 10);
                    item[headerKey] = isNaN(parsedValue) ? 1 : parsedValue;
                } else if (['isPizza', 'available', 'active', 'isCustomizable', 'isSingleChoice', 'isRequired'].includes(headerKey)) {
                    item[headerKey] = value.toUpperCase() === 'SIM';
                } else {
                    item[headerKey] = value;
                }
            });
            parsedData.push(item);
        }
    }
    return parsedData;
}

export default async (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate'); 

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
            if (unavailableItems[item.id] === false) {
                return { ...item, available: false };
            }
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
        res.status(500).json({ error: `Erro interno no servidor: ${error.message}` });
    }
};
