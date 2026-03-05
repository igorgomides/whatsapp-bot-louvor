# Bot de Lista de Compras no Walmart.ca via WhatsApp

## Objetivo
Criar um bot de WhatsApp que:
1. Recebe uma lista de compras via mensagem no WhatsApp
2. Usa Puppeteer para abrir o Walmart.ca já logado
3. Busca cada item e adiciona ao carrinho
4. Manda de volta o link do carrinho pronto

---

## Stack
- **Node.js** — Runtime JavaScript
- **whatsapp-web.js** — Conexão com WhatsApp
- **puppeteer-extra + stealth plugin** — Automação do browser sem ser detectado como bot
- **PM2** — Manter o bot rodando em background

---

## Referência (projeto irmão)
O projeto `whatsapp-bot-louvor` já funciona e usa a mesma stack de WhatsApp. Fica em:
`/Users/igorgomides/Documents/ANTIGRAVITY/PROCESS AUTOMATION/whatsapp-bot/`
Repo: https://github.com/igorgomides/whatsapp-bot-louvor

Copie toda a lógica de conexão WhatsApp (autenticação, inicialização do cliente, handling de mensagens) de lá.

---

## Passos para o Agente

### 1. Inicializar o projeto
```bash
cd /Users/igorgomides/Documents/ANTIGRAVITY/GOCERIES-SHOPPER-BOT
npm init -y
npm install whatsapp-web.js qrcode-terminal puppeteer puppeteer-extra puppeteer-extra-plugin-stealth dotenv
```

### 2. Variáveis de ambiente (`.env`)
```env
MEU_NUMERO=15195028015
WALMART_EMAIL=seu@email.com
WALMART_PASSWORD=suasenha
```

### 3. Estrutura de arquivos
```
GOCERIES-SHOPPER-BOT/
├── index.js           # Bot principal (WhatsApp listener)
├── parseCompras.js    # Extrai itens da mensagem do usuário
├── walmartShopper.js  # Automação do Walmart.ca com Puppeteer
├── .env               # Credenciais (NÃO commitar)
├── .gitignore
├── walmart_cookies.json  # Gerado automaticamente após 1º login
└── .wwebjs_auth/         # Sessão do WhatsApp (gerado automaticamente)
```

### 4. Como o bot deve funcionar

#### Mensagem do usuário no WhatsApp:
```
!compras
2x leite integral
pão de forma
6 ovos
arroz 5kg
```

#### Bot responde:
```
⏳ Iniciando compras no Walmart.ca...
```

#### Bot abre Walmart.ca com Puppeteer, busca cada item e adiciona ao carrinho

#### Bot responde ao finalizar:
```
✅ Compras finalizadas!

✅ 2x leite integral
✅ pão de forma
✅ arroz 5kg
⚠️ ovos — não encontrado (verifique manualmente)

🛒 Seu carrinho: https://www.walmart.ca/cart
```

---

### 5. Lógica do `parseCompras.js`
Receber texto e retornar array de `{ quantidade, nome }`:
```js
// Input: "2x leite integral\npão de forma\n6 ovos"
// Output: [
//   { quantidade: 2, nome: 'leite integral' },
//   { quantidade: 1, nome: 'pão de forma' },
//   { quantidade: 6, nome: 'ovos' }
// ]
```
Regex para capturar o padrão `2x`, `2 `, ou sem quantidade.

### 6. Lógica do `walmartShopper.js`
1. Carregar cookies salvos de `walmart_cookies.json` (evita login toda vez)
2. Se não houver cookies, fazer login em `https://www.walmart.ca` com email/senha do `.env` e salvar os cookies
3. Para cada item:
   - Navegar para `https://www.walmart.ca/search?q=NOME+DO+PRODUTO`
   - Aguardar o primeiro resultado aparecer
   - Clicar em "Add to cart" no primeiro produto
   - Se não encontrar resultado, marcar como não encontrado
4. Retornar lista de adicionados e não encontrados

### 7. Evitar bloqueio do Walmart (anti-bot)
Usar `puppeteer-extra-plugin-stealth` para parecer um browser real:
```js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
```
Adicionar delays aleatórios entre buscas (ex: `await sleep(1500 + Math.random() * 1000)`).

### 8. Comandos do Bot
| Comando | Ação |
|---|---|
| `!compras` + lista | Abre Walmart.ca e adiciona itens ao carrinho |
| `!ping` | Verifica se o bot está online |
| `!ajuda` | Lista os comandos |

### 9. Rodar com PM2
```bash
# Primeira vez — autenticar WhatsApp
node index.js

# Após autenticar
pm2 start index.js --name "walmart-bot"
pm2 save
```

---

## Desafios a Considerar

1. **Anti-bot do Walmart.ca** — Usar o stealth plugin. Se mesmo assim bloquear, tentar Playwright com `playwright-extra`.
2. **Login de 2 fatores** — Se a conta tiver 2FA, desativá-lo ou criar uma conta separada para o bot.
3. **Seletores que mudam** — Walmart atualiza o HTML com frequência. Usar seletores por atributos `aria-label` ou `data-item-id` em vez de classes CSS.
4. **Autenticação do WhatsApp** — Igual ao `whatsapp-bot-louvor`, a sessão é salva localmente. Só precisa escanear o QR na primeira vez.
