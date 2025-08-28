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


/*Mini Tutorial: Convertendo Links do Google Sheets para Download Direto em CSV
O objetivo é transformar um link normal do Google Sheets em um link especial que, ao ser acessado, baixa diretamente o arquivo .csv de uma aba específica.

Passo 0: Ajustar o Compartilhamento (Obrigatório)
Antes de tudo, para que o link de download funcione, sua planilha precisa estar configurada para ser "Pública" ou "Qualquer pessoa com o link".
Vá em 'Compartilhar' no Google Sheets, clique em 'Mudar', e selecione a opção que permite acesso sem restrições.

Passo 1: Encontre o 'document ID'
Copie a parte da URL entre '/d/' e '/edit'. Exemplo:
https://docs.google.com/spreadsheets/d/1XyC-aG3_5R6oD0yE0F3xL7kQ_7kX1_4w2g/edit#gid=0
O ID do documento é: 1XyC-aG3_5R6oD0yE0F3xL7kQ_7kX1_4w2g

Passo 2: Encontre o 'gid' da aba
O 'gid' é um número que identifica a aba (sheet) específica que você quer.
Se você estiver na aba principal, o 'gid' geralmente é 0. Para outras abas, o 'gid' aparece na URL quando você a seleciona.
Exemplo: https://docs.google.com/spreadsheets/d/1XyC-aG3_5R6oD0yE0F3xL7kQ_7kX1_4w2g/edit#gid=123456789
O gid é: 123456789

Passo 3: Monte o Link de Download
Use o seguinte formato, substituindo o 'document ID' e o 'gid' que você encontrou:
https://docs.google.com/spreadsheets/d/[document ID]/export?format=csv&gid=[gid]

Exemplo completo:
https://docs.google.com/spreadsheets/d/1XyC-aG3_5R6oD0yE0F3xL7kQ_7kX1_4w2g/export?format=csv&gid=0
*/

const CARDAPIO_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5K4Fk5iB3x9n1X1-oQ_0B0Z4o3kX0Z4gL0l_x-F1X0_X9-b0-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g/pub?gid=0&single=true&output=csv";
const PROMOCOES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5K4Fk5iB3x9n1X1-oQ_0B0Z4o3kX0Z4gL0l_x-F1X0_X9-b0-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g/pub?gid=1380905973&single=true&output=csv";
const DELIVERY_FEES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5K4Fk5iB3x9n1X1-oQ_0B0Z4o3kX0Z4gL0l_x-F1X0_X9-b0-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g/pub?gid=1506461973&single=true&output=csv";
const INGREDIENTES_HAMBURGUER_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5K4Fk5iB3x9n1X1-oQ_0B0Z4o3kX0Z4gL0l_x-F1X0_X9-b0-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g/pub?gid=1152062634&single=true&output=csv";
const CONTACT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5K4Fk5iB3x9n1X1-oQ_0B0Z4o3kX0Z4gL0l_x-F1X0_X9-b0-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g-g/pub?gid=1498679900&single=true&output=csv";


function parseCsvData(csvText) {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
    const headers = lines[0].split(',').map(header => header.trim().toLowerCase().replace(/ /g, '_'));
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const item = {};
        for (let j = 0; j < headers.length; j++) {
            item[headers[j]] = values[j] || '';
        }
        data.push(item);
    }
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
            // Adiciona as novas propriedades para o cardápio
            return {
                ...item,
                available: status.available !== false,
                visible: status.visible !== false,
                halfPizzaAvailable: status.halfPizzaAvailable !== false
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
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
};
