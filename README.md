# WhatsApp Bot Hub

Este é um bot modular para WhatsApp baseado na biblioteca [whatsapp-web.js](https://wwebjs.dev/). 
O bot utiliza um sistema de "Skills" para adicionar novas funcionalidades de forma organizada, operando sob uma única sessão no WhatsApp (um único número).

## 🚀 Arquitetura (Bot Hub)

Possui a seguinte arquitetura:
- `index.js`: O núcleo do bot. Gerencia autenticação, QR Code, puppeteer e distribui mensagens recebidas para as Skills registradas.
- `skills/`: Diretório contendo os módulos de funcionalidade.
- `skills/brain/`: Módulo de inteligência artificial responsável por processar linguagem natural via Ollama e repassar os comandos (Intents) para as outras skills.

## 📦 Skills Disponíveis

### 1. Brain (Cérebro)
Integração com o Ollama local para NLP (Processamento de Linguagem Natural). Ele intercepta mensagens de alguns grupos expecíficos, entende a intenção da mensagem e aciona a Skill correspondente, evitando a necessidade de decorar comandos (como `!compras`).

### 2. Louvor (LouveApp)
Skill dedicada para interagir com a plataforma LouveApp e automatizar a criação de escalas de louvor. 
- Processa escalas enviadas no grupo `Louvor discípulos` automaticamente.
- Cria escalas na plataforma, gerencia data, hora, descrição, músicas e escalados.
- Responde comandos de gerenciamento (`!escala`, `!confirmar`, `!cancelar`).

### 3. Walmart (Compras)
Skill de automação web. Adiciona itens enviados pelo usuário direto no carrinho de uma conta do Walmart.ca, utilizando o Puppeteer (Web Scraping/Automation) por baixo dos panos.

## 🛠️ Configuração e Instalação

### Pré-requisitos
- Node.js (v18+)
- Google Chrome instalado na máquina (para web scraping e whatsapp-web.js).
- [Ollama](https://ollama.com/) (opcional, para uso da skill Brain) com um modelo compatível (`llama3` ou similar configurado em `.env`).

### Passo a Passo
1. Clone este repositório.
2. Crie um arquivo `.env` na raiz do projeto (use o `.env.example` como base caso exista).
3. Execute `npm install`
4. Execute `npm start` (ou `node index.js`). No primeiro acesso, o terminal solicitará seu número ou exibirá um QR Code para autenticação.

## 🛡️ Segurança e Privacidade
O código possui filtros de grupo restritos (`Whatsapp Bot` e `Louvor discípulos`) para evitar que o bot reaja a mensagens privadas não intencionais e cause conversas acidentais com seus contatos.
