/**
 * skills/walmart/index.js
 * Skill: Compras no Walmart.ca via Puppeteer
 */

const { parseCompras, formatarLista } = require('./parseCompras');
const { fazerCompras } = require('./walmartShopper');
const brain = require('../brain');

const GRUPO_BOT = 'Whatsapp Bot';

async function onReady(client) {
    console.log('[walmart] 🛒 Skill Walmart carregada. Aguardando !compras ou linguagem natural...');
    // Register AI intent handler
    brain.registerIntent('compras', handleIntent);
}

/**
 * Called by brain skill when Ollama classifies intent as 'compras'.
 * @param {string} intent
 * @param {{ itens: {quantidade: number, nome: string}[] }} data
 */
async function handleIntent(intent, data, msg, client) {
    const itens = (data.itens || []).filter(i => i.nome);

    if (itens.length === 0) {
        await msg.reply('❌ Não entendi quais itens você quer comprar. Pode repetir?');
        return;
    }

    await msg.reply(
        `⏳ Iniciando compras no Walmart.ca...\n\n📋 Itens:\n${formatarLista(itens)}`
    );

    console.log(`[walmart] 🛒 Iniciando compras para ${itens.length} item(s) via AI...`);

    try {
        const { adicionados, naoEncontrados } = await fazerCompras(itens);
        let resposta = '✅ *Compras finalizadas!*\n\n';
        if (adicionados.length > 0) resposta += adicionados.map(i => `✅ ${i}`).join('\n') + '\n';
        if (naoEncontrados.length > 0) resposta += naoEncontrados.map(i => `⚠️ ${i} — não encontrado`).join('\n') + '\n';
        resposta += '\n🛒 Seu carrinho: https://www.walmart.ca/cart';
        await msg.reply(resposta);
    } catch (err) {
        console.error('[walmart] ❌ Erro:', err);
        await msg.reply(`❌ Erro ao fazer compras: ${err.message}`);
    }
}


/**
 * Handles !compras, !ping (in private), !ajuda
 * Returns true if the message was consumed.
 */
async function handleMessage(msg, client) {
    const chat = await msg.getChat();
    // Walmart direct commands only work in the bot group
    if (!chat.isGroup || chat.name !== GRUPO_BOT) return false;

    const texto = msg.body.trim();
    const textoLower = texto.toLowerCase();

    // Only handle !compras-related commands
    if (!textoLower.startsWith('!compras') && textoLower !== '!ajuda-walmart') {
        return false;
    }

    if (textoLower === '!ajuda-walmart') {
        await msg.reply(
            '🛒 *Walmart Shopper Bot*\n\n' +
            'Envie:\n```\n!compras\n2x leite integral\npão de forma\n6 ovos\narroz 5kg\n```\n\n' +
            'O bot abre o Walmart.ca, adiciona os itens e manda o link do carrinho.'
        );
        return true;
    }

    // !compras
    const linhas = texto.split('\n');
    const listaTexto = linhas.slice(1).join('\n').trim();

    if (!listaTexto) {
        await msg.reply(
            '❌ Lista vazia! Envie os itens abaixo do comando:\n\n' +
            '```\n!compras\n2x leite integral\npão de forma\n6 ovos\n```'
        );
        return true;
    }

    const itens = parseCompras(listaTexto);

    if (itens.length === 0) {
        await msg.reply('❌ Não identifiquei nenhum item. Tente novamente.');
        return true;
    }

    await msg.reply(
        `⏳ Iniciando compras no Walmart.ca...\n\n📋 Itens:\n${formatarLista(itens)}`
    );

    console.log(`[walmart] 🛒 Iniciando compras para ${itens.length} item(s)...`);

    try {
        const { adicionados, naoEncontrados } = await fazerCompras(itens);

        let resposta = '✅ *Compras finalizadas!*\n\n';
        if (adicionados.length > 0) resposta += adicionados.map(i => `✅ ${i}`).join('\n') + '\n';
        if (naoEncontrados.length > 0) resposta += naoEncontrados.map(i => `⚠️ ${i} — não encontrado`).join('\n') + '\n';
        resposta += '\n🛒 Seu carrinho: https://www.walmart.ca/cart';

        await msg.reply(resposta);
    } catch (err) {
        console.error('[walmart] ❌ Erro:', err);
        await msg.reply(`❌ Erro ao fazer compras: ${err.message}`);
    }

    return true;
}

module.exports = { name: 'walmart', onReady, handleMessage };
