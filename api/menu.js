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
const CARDAPIO_CSV_URL = 'https://docs.google.com/spreadsheets/d/1RERYG8TDuibOadfLJAHAoc8I64hMrLkDmoIcnVOdJZ0/export?format=csv&gid=1575270352'; 
const PROMOCOES_CSV_URL = 'https://docs.google.com/spreadsheets/d/1RERYG8TDuibOadfLJAHAoc8I64hMrLkDmoIcnVOdJZ0/export?format=csv&gid=1622604495'; 
const DELIVERY_FEES_CSV_URL = 'https://docs.google.com/spreadsheets/d/1RERYG8TDuibOadfLJAHAoc8I64hMrLkDmoIcnVOdJZ0/export?format=csv&gid=1298581759';
const INGREDIENTES_HAMBURGUER_CSV_URL = 'https://docs.google.com/spreadsheets/d/1RERYG8TDuibOadfLJAHAoc8I64hMrLkDmoIcnVOdJZ0/export?format=csv&gid=679334079';
const CONTACT_CSV_URL = 'https://docs.google.com/spreadsheets/d/1RERYG8TDuibOadfLJAHAoc8I64hMrLkDmoIcnVOdJZ0/export?format=csv&gid=1022597597';
const INGREDIENTES_PIZZA_CSV_URL = 'https://docs.google.com/spreadsheets/d/1RERYG8TDuibOadfLJAHAoc8I64hMrLkDmoIcnVOdJZ0/export?format=csv&gid=793391272';


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
function parseCsvData(csvText, type) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headersRaw = parseCsvLine(lines[0]);
    const headerMapping = {
        'id item (único)': 'id', 'nome do item': 'name', 'descrição': 'description',
        'preço 4 fatias': 'price4Slices', 'preço 6 fatias': 'price6Slices',
        'preço 8 fatias': 'basePrice', 'preço 10 fatias': 'price10Slices',
        'categoria': 'category', 'é pizza? (sim/não)': 'isPizza', 'é montável? (sim/não)': 'isCustomizable',
        'disponível (sim/não)': 'available', 'imagem': 'imageUrl',
        'id promocao': 'id', 'nome da promocao': 'name', 'preco promocional': 'promoPrice',
        'id item aplicavel': 'itemId', 'ativo (sim/nao)': 'active',
        'bairros': 'neighborhood', 'valor frete': 'deliveryFee',
        'id intem': 'id', 'ingredientes': 'name', 'preço': 'price', 'seleção única': 'isSingleChoice',
        'limite': 'limit', 'limite ingrediente': 'ingredientLimit',
        'é obrigatório?(sim/não)': 'isRequired', 'disponível': 'available',
        'dados': 'data', 'valor': 'value',
        // Mapeamento para Ingredientes da Pizza
        'adicionais': 'name', 'limite adicionais': 'limit', 'limite categoria': 'categoryLimit'
    };
    if (type === 'pizza_ingredients' || type === 'burger_ingredients') {
        headerMapping['id intem'] = 'id';
        headerMapping['id item (único)'] = 'id';
    }


    const mappedHeaders = headersRaw.map(header => {
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
                if (['basePrice', 'price6Slices', 'price4Slices', 'price10Slices', 'promoPrice', 'deliveryFee', 'price'].includes(headerKey)) {
                    item[headerKey] = parseFloat(String(value).replace(',', '.')) || 0;
                } else if (['limit', 'categoryLimit', 'ingredientLimit'].includes(headerKey)) {
                    const parsedValue = parseInt(value, 10);
                    item[headerKey] = isNaN(parsedValue) ? Infinity : parsedValue;
                } else if (['isPizza', 'available', 'active', 'isCustomizable', 'isSingleChoice', 'isRequired'].includes(headerKey)) {
                    item[headerKey] = value.toUpperCase() === 'SIM';
                } else {
                    item[headerKey] = value;
                }
            });
            
            // CORREÇÃO: Adiciona prefixo para garantir IDs únicos
            if (type === 'burger_ingredients' && item.id) {
                item.id = `ing-${item.id}`;
            } else if (type === 'pizza_ingredients' && item.id) {
                item.id = `extra-${item.id}`;
            }

            parsedData.push(item);
        }
    }
    return parsedData;
}

export default async (req, res) => {
    // Cache removido para garantir que as alterações de status sejam sempre as mais recentes
    res.setHeader('Cache-Control', 'no-cache');

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
            ingredientesPizzaCsv,
            contactCsv
        ] = await Promise.all([
            fetchData(CARDAPIO_CSV_URL),
            fetchData(PROMOCOES_CSV_URL),
            fetchData(DELIVERY_FEES_CSV_URL),
            fetchData(INGREDIENTES_HAMBURGUER_CSV_URL),
            fetchData(INGREDIENTES_PIZZA_CSV_URL),
            fetchData(CONTACT_CSV_URL)
        ]);
        
        // Processa os dados das planilhas
        let cardapioJson = parseCsvData(cardapioCsv, 'cardapio');
        let promocoesJson = parseCsvData(promocoesCsv, 'promocoes');
        let deliveryFeesJson = parseCsvData(deliveryFeesCsv, 'delivery');
        let ingredientesHamburguerJson = parseCsvData(ingredientesHamburguerCsv, 'burger_ingredients');
        let ingredientesPizzaJson = parseCsvData(ingredientesPizzaCsv, 'pizza_ingredients');
        let contactJson = parseCsvData(contactCsv, 'contact');

        // Busca todos os documentos de status do Firestore
        const [
            itemStatusSnap, 
            itemVisibilitySnap,
            itemExtrasSnap, 
            pizzaHalfStatusSnap,
            ingredientStatusSnap,
            ingredientVisibilitySnap,
            extraStatusSnap,
            extraVisibilitySnap
        ] = await Promise.all([
             getDoc(doc(db, "config", "item_status")),
             getDoc(doc(db, "config", "item_visibility")),
             getDoc(doc(db, "config", "item_extras_status")),
             getDoc(doc(db, "config", "pizza_half_status")),
             getDoc(doc(db, "config", "ingredient_status")),
             getDoc(doc(db, "config", "ingredient_visibility")),
             getDoc(doc(db, "config", "extra_status")),
             getDoc(doc(db, "config", "extra_visibility"))
        ]);
        
        const itemStatus = itemStatusSnap.exists() ? itemStatusSnap.data() : {};
        const itemVisibility = itemVisibilitySnap.exists() ? itemVisibilitySnap.data() : {};
        const itemExtrasStatus = itemExtrasSnap.exists() ? itemExtrasSnap.data() : {};
        const pizzaHalfStatus = pizzaHalfStatusSnap.exists() ? pizzaHalfStatusSnap.data() : {};
        const ingredientStatus = ingredientStatusSnap.exists() ? ingredientStatusSnap.data() : {};
        const ingredientVisibility = ingredientVisibilitySnap.exists() ? ingredientVisibilitySnap.data() : {};
        const extraStatus = extraStatusSnap.exists() ? extraStatusSnap.data() : {};
        const extraVisibility = extraVisibilitySnap.exists() ? extraVisibilitySnap.data() : {};
        
        // Filtra e atualiza os itens principais do cardápio
        cardapioJson = cardapioJson
            .filter(item => itemVisibility[item.id] !== false) 
            .map(item => ({
                ...item, 
                available: itemStatus[item.id] !== false,
                acceptsExtras: itemExtrasStatus[item.id] === undefined ? item.isPizza : itemExtrasStatus[item.id],
                allowHalf: item.isPizza ? (pizzaHalfStatus[item.id] !== false) : false
            }));

        // Filtra e atualiza os ingredientes de hambúrguer
        ingredientesHamburguerJson = ingredientesHamburguerJson
            .filter(item => ingredientVisibility[item.id] !== false)
            .map(item => ({ ...item, available: ingredientStatus[item.id] !== false }));

        // Filtra e atualiza os adicionais de pizza
        ingredientesPizzaJson = ingredientesPizzaJson
            .filter(item => extraVisibility[item.id] !== false)
            .map(item => ({ ...item, available: extraStatus[item.id] !== false }));

        res.status(200).json({
            cardapio: cardapioJson,
            promocoes: promocoesJson,
            deliveryFees: deliveryFeesJson,
            ingredientesHamburguer: ingredientesHamburguerJson,
            ingredientesPizza: ingredientesPizzaJson,
            contact: contactJson
        });

    } catch (error) {
        console.error('Vercel Function: Erro fatal:', error.message);
        res.status(500).json({ error: `Erro interno no servidor: ${error.message}` });
    }
};

