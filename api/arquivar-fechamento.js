// /api/arquivar-fechamento.js
import { google } from 'googleapis';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

// --- CONFIGURAÇÃO FIREBASE ---
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

// --- CONFIGURAÇÃO GOOGLE SHEETS (REVERTIDO) ---
// Revertendo para o método de E-mail/Chave, conforme sua solicitação.
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.CASH_CLOSURES_SHEET_NAME || 'fechamentos_caixa';

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, // Usa a variável de e-mail
        private_key: GOOGLE_PRIVATE_KEY, // Usa a variável de chave
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// --- FUNÇÃO PRINCIPAL ---
export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Validação extra para garantir que as credenciais carregaram
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        console.error("Erro em /api/arquivar-fechamento: GOOGLE_SERVICE_ACCOUNT_EMAIL ou GOOGLE_PRIVATE_KEY não foram carregadas.");
        return res.status(500).json({ error: 'Erro interno no servidor: Falha ao carregar credenciais da API do Sheets.' });
    }

    try {
        const { cashRegisterData } = req.body;
        if (!cashRegisterData || !cashRegisterData.id) {
            return res.status(400).json({ error: 'Dados do fechamento de caixa não fornecidos.' });
        }

        const formatToBrazilTime = (date) => {
            if (!date) return '';
            return new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        }
        
        // CORREÇÃO: Combina o total e os detalhes da sangria em uma única string.
        const sangriaInfo = `Total: R$${(cashRegisterData.totalSangrias || 0).toFixed(2).replace('.', ',')} (${cashRegisterData.sangrias || 'Nenhuma sangria registrada'})`;

        const newRow = [
            cashRegisterData.id,
            formatToBrazilTime(cashRegisterData.dataAbertura),
            cashRegisterData.usuarioAbertura,
            String((cashRegisterData.valorInicial || 0).toFixed(2)).replace('.', ','),
            formatToBrazilTime(new Date()),
            cashRegisterData.usuarioFechamento,
            String((cashRegisterData.valorFinalContado || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.diferenca || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.totalVendas || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.totalVendasDelivery || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.totalVendasRetirada || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.totalVendasMesas || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.totalTaxasEntrega || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.totalDinheiro || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.totalCartao || 0).toFixed(2)).replace('.', ','),
            String((cashRegisterData.totalPix || 0).toFixed(2)).replace('.', ','),
            sangriaInfo // Usa a string combinada para uma única coluna.
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:A`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [newRow],
            },
        });

        // Apaga o registro do caixa do Firestore após arquivar na planilha.
        const cashRegisterRef = doc(db, "caixas", cashRegisterData.id);
        await deleteDoc(cashRegisterRef);

        res.status(200).json({ success: true, message: 'Fechamento de caixa arquivado e removido com sucesso!' });

    } catch (error) {
        console.error('Erro ao arquivar fechamento de caixa:', error);
        res.status(500).json({ error: 'Erro interno no servidor.', details: error.message });
    }
};



