// Este arquivo é uma função Serverless para o Vercel.
// Ele foi atualizado para ler a nova coluna "preço 10 fatias" da planilha.

import fetch from 'node-fetch';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

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

export default async (req, res) => {
    // Permite requisições de qualquer origem (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde a requisições OPTIONS (pre-flight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Apenas permite requisições POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { order, selectedAddress, total, paymentMethod, whatsappNumber, observation } = req.body;

        if (!order || !selectedAddress || !total) {
            return res.status(400).json({ error: 'Dados do pedido incompletos.' });
        }
        
        if (!whatsappNumber) {
            console.error('Erro Crítico: O número do WhatsApp não foi recebido do frontend.');
            return res.status(400).json({ error: 'O número de WhatsApp para receber o pedido não foi configurado.' });
        }

        // Salva o pedido no Firestore
        let pdvSaved = false;
        let pdvError = null;
        try {
			
            // Simulação de erro ao salvar no Firestore (para testes)
            //console.error('[TEST] Simulando erro no Firestore: SIMULATED_FIRESTORE_ERROR');
            //throw new Error('SIMULATED_FIRESTORE_ERROR');
			
            await addDoc(collection(db, "pedidos"), {
                itens: order,
                endereco: selectedAddress,
                total: total,
                pagamento: paymentMethod,
                status: 'Novo',
                criadoEm: serverTimestamp(),
                observacao: observation || ''
            });
            pdvSaved = true;
        } catch (firestoreError) {
            console.error('Falha ao salvar pedido no Firestore (PDV):', firestoreError);
            pdvError = String(firestoreError && firestoreError.message ? firestoreError.message : firestoreError);
            // Continua o fluxo para enviar ao WhatsApp mesmo assim
        }
        
        // Monta a mensagem para o WhatsApp com agrupamento por categoria
        const itemsByCategory = order.reduce((acc, item) => {
            const category = item.category || 'Outros';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {});

        let itemsText = '';
        for (const category in itemsByCategory) {
            itemsText += `\n*${category.toUpperCase()}*\n`;
            itemsText += itemsByCategory[category].map(item => {
                 let itemString = `  - ${item.name}`;
                 if (item.extras && item.extras.length > 0) {
                    const extrasString = item.extras.map(extra => `    + _${extra.name} (${extra.placement})_`).join('\n');
                    itemString += `\n${extrasString}`;
                }
                return itemString;
            }).join('\n');
            itemsText += '\n';
        }


        let paymentText = `Pagamento: ${paymentMethod}`;
        if (typeof paymentMethod === 'object' && paymentMethod.method === 'Dinheiro') {
            paymentText = `Pagamento: Dinheiro\nTroco para: R$ ${paymentMethod.trocoPara.toFixed(2).replace('.', ',')}`;
        }

        let discountText = '';
        if (total.discount && total.discount > 0) {
            discountText = `Desconto: - R$ ${total.discount.toFixed(2).replace('.', ',')}\n`;
        }
        
        let observationText = '';
        if (observation && observation.trim() !== '') {
            observationText = `\n*OBSERVAÇÕES:*\n_${observation.trim()}_\n`;
        }

        const fullMessage = `
*-- NOVO PEDIDO --*

*Cliente:* ${selectedAddress.clientName}
*Endereço:* ${selectedAddress.rua}, ${selectedAddress.numero} - ${selectedAddress.bairro}
${selectedAddress.referencia ? `*Referência:* ${selectedAddress.referencia}` : ''}
------------------------------------
*PEDIDO:*
${itemsText}
------------------------------------
Subtotal: R$ ${total.subtotal.toFixed(2).replace('.', ',')}
${discountText}Taxa de Entrega: R$ ${total.deliveryFee.toFixed(2).replace('.', ',')}
*Total: R$ ${total.finalTotal.toFixed(2).replace('.', ',')}*
${paymentText}
${observationText}
        `;
        
        const targetNumber = `55${whatsappNumber.replace(/\D/g, '')}`;
        const whatsappUrl = `https://wa.me/${targetNumber}?text=${encodeURIComponent(fullMessage.trim())}`;

        res.status(200).json({ whatsappUrl, pdvSaved, pdvError });

    } catch (error) {
        console.error("Erro na função criar-pedido:", error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
};

