# cardapio_samia

## Diagrama de Fluxo (Mermaid)

```mermaid
flowchart TD
    subgraph Client[Cliente / Navegador]
        I[index.html\nCardápio PWA]
        A[atendente.html\nLançamento de Pedido]
        P[pdv.html\nPainel PDV]
        G[gerenciar.html\nGerenciar Disponibilidade]
    end

    subgraph Server[Funções Serverless]
        API_MENU[/api/menu/]
        API_PEDIDO[/api/criar-pedido/]
    end

    subgraph Firebase[Firebase]
        FS[(Firestore)]
        AUTH[(Auth)]
    end

    subgraph Data[Fontes de Dados]
        GS[(Google Sheets\nCSV público)]
        WA[(WhatsApp)]
        SW[(Service Worker\nCache Storage)]
        MF[(manifest.json)]
    end

    %% PWA
    I -- registra --> SW
    I -- carrega --> MF

    %% Consumo de cardápio e taxas
    I -->|fetch /api/menu| API_MENU
    A -->|fetch /api/menu| API_MENU
    P -->|fetch /api/menu\n(apenas taxas)| API_MENU
    G -->|fetch /api/menu| API_MENU
    API_MENU -->|lê CSV| GS
    API_MENU -->|lê config| FS
    API_MENU -->|JSON cardápio/promoções/taxas/ingredientes| I
    API_MENU -->|JSON| A
    API_MENU -->|JSON| P
    API_MENU -->|JSON| G

    %% Autenticação (telas internas)
    G --> AUTH
    P --> AUTH
    A --> AUTH

    %% Controle em tempo real
    I <-->|onSnapshot config/*| FS
    G <-->|onSnapshot config/*| FS
    P <-->|onSnapshot pedidos| FS

    %% Criação de pedidos
    I -->|POST /api/criar-pedido\n(itens, endereço, total, pagamento, whatsapp)| API_PEDIDO
    A -->|POST /api/criar-pedido| API_PEDIDO
    API_PEDIDO -->|addDoc pedidos| FS
    API_PEDIDO -->|gera link wa.me| WA
    API_PEDIDO -->|whatsappUrl| I
    API_PEDIDO -->|whatsappUrl| A

    %% Abertura do WhatsApp pelo cliente/atendente
    I -->|abre link| WA
    A -->|abre link| WA
```

Como visualizar: editores como VS Code e plataformas (GitHub com extensão Mermaid) renderizam o diagrama automaticamente.
