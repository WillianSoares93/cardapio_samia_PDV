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
        'adicionais': 'name', 'limite adicionais': 'limit', 'limite categoria': 'categoryLimit'
    };
    
    // Garante que a coluna de ID dos ingredientes e adicionais seja mapeada corretamente
    if (type === 'pizza_ingredients' || type === 'burger_ingredients') {
        headerMapping['id item (único)'] = 'id';
        headerMapping['id intem'] = 'id';
    }


    const mappedHeaders = headersRaw.map(header => {
        const cleanHeader = header.trim().toLowerCase();
        return headerMapping[cleanHeader] || cleanHeader.replace(/\s/g, '').replace(/[^a-z0-9]/g, '');
    });

    const parsedData = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        let item = {};
        mappedHeaders.forEach((headerKey, j) => {
            const value = values[j] || ''; 
            
            if (['basePrice', 'price6Slices', 'price4Slices', 'price10Slices', 'promoPrice', 'deliveryFee', 'price'].includes(headerKey)) {
                item[headerKey] = parseFloat(String(value).replace(',', '.')) || 0;
            } else if (['limit', 'categoryLimit', 'ingredientLimit'].includes(headerKey)) {
                const parsedValue = parseInt(value, 10);
                item[headerKey] = isNaN(parsedValue) ? Infinity : parsedValue;
            } else if (['isPizza', 'available', 'active', 'isCustomizable', 'isSingleChoice', 'isRequired'].includes(headerKey)) {
                item[headerKey] = String(value).toUpperCase() === 'SIM';
            } else {
                item[headerKey] = value;
            }
        });
        
        // MELHORIA: Se não houver ID, gera um a partir do nome do item.
        if (!item.id && item.name) {
            item.id = item.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
        }

        // Adiciona apenas se o item tiver um ID e um nome válidos.
        if (item.id && String(item.id).trim() !== '' && item.name && String(item.name).trim() !== '') {
            parsedData.push(item);
        }
    }
    return parsedData;
}

export default async (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate'); 

    try {
        const fetchData = async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn(`Aviso: Falha ao buscar dados de ${url}, status: ${response.status}. Usando dados vazios.`);
                    return '';
                }
                return response.text();
            } catch (error) {
                console.warn(`Aviso: Erro de rede ao buscar ${url}: ${error.message}. Usando dados vazios.`);
                return '';
            }
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
        
        const safeParse = (csv, type) => {
            if (!csv) return [];
            try {
                return parseCsvData(csv, type);
            } catch (e) {
                console.error(`Erro ao processar o CSV do tipo "${type}":`, e.message);
                return [];
            }
        };

        let cardapioJson = safeParse(cardapioCsv, 'cardapio');
        
        let unavailableItems = {}, hiddenItems = {}, itemExtrasStatus = {}, pizzaHalfStatus = {};
        try {
            const itemStatusRef = doc(db, "config", "item_status");
            const itemVisibilityRef = doc(db, "config", "item_visibility");
            const itemExtrasRef = doc(db, "config", "item_extras_status");
            const pizzaHalfStatusRef = doc(db, "config", "pizza_half_status");
            
            const [
                itemStatusSnap, 
                itemVisibilitySnap,
                itemExtrasSnap, 
                pizzaHalfStatusSnap
            ] = await Promise.all([
                 getDoc(itemStatusRef),
                 getDoc(itemVisibilityRef),
                 getDoc(itemExtrasRef),
                 getDoc(pizzaHalfStatusRef)
            ]);
            
            unavailableItems = itemStatusSnap.exists() ? itemStatusSnap.data() : {};
            hiddenItems = itemVisibilitySnap.exists() ? itemVisibilitySnap.data() : {};
            itemExtrasStatus = itemExtrasSnap.exists() ? itemExtrasSnap.data() : {};
            pizzaHalfStatus = pizzaHalfStatusSnap.exists() ? pizzaHalfStatusSnap.data() : {};
        } catch (firebaseError) {
            console.error("Vercel Function: Erro ao buscar dados do Firebase. Continuando sem os status em tempo real.", firebaseError.message);
        }

        cardapioJson = cardapioJson
            .filter(item => item.id && hiddenItems[item.id] !== false)
            .map(item => {
                const isAvailable = unavailableItems[item.id] !== false;
                
                const acceptsExtrasDefault = item.isPizza; 
                const acceptsExtras = itemExtrasStatus[item.id] === undefined ? acceptsExtrasDefault : itemExtrasStatus[item.id];

                const allowsHalf = item.isPizza ? (pizzaHalfStatus[item.id] === undefined ? true : pizzaHalfStatus[item.id]) : false;

                return { ...item, available: isAvailable, acceptsExtras, allowHalf: allowsHalf };
            });

        res.status(200).json({
            cardapio: cardapioJson,
            promocoes: safeParse(promocoesCsv, 'promocoes'),
            deliveryFees: safeParse(deliveryFeesCsv, 'delivery'),
            ingredientesHamburguer: safeParse(ingredientesHamburguerCsv, 'burger_ingredients'),
            ingredientesPizza: safeParse(ingredientesPizzaCsv, 'pizza_ingredients'),
            contact: safeParse(contactCsv, 'contact')
        });

    } catch (error) {
        console.error('Vercel Function: Erro fatal inesperado:', error.message);
        res.status(500).json({ error: `Erro interno no servidor: ${error.message}` });
    }
};

