/**
 * skills/brain/index.js
 * AI Brain skill — routes natural language messages to the right skill via Ollama/llama3.
 *
 * - Intercepts messages in GRUPO_BOT and private chats
 * - Sends text to Ollama for intent classification
 * - Calls handleIntent() on the matching skill
 * - Falls back to command mode if Ollama is offline
 */

const { chat, isOnline, OLLAMA_MODEL } = require('./ollama');
const { buildMessages } = require('./prompt');

const GRUPO_BOT = 'Whatsapp Bot';
const GRUPO_LOUVOR = 'Louvor discípulos';

// Registry of skills that support handleIntent
const intentHandlers = {};

/**
 * Register a skill's intent handler.
 * Called by each skill that supports AI-driven invocation.
 * @param {string} intent
 * @param {Function} handler  async (intent, data, msg, client) => void
 */
function registerIntent(intent, handler) {
    intentHandlers[intent] = handler;
}

/**
 * Parse Ollama's JSON response, resilient to extra text before/after the JSON.
 * Uses brace-depth tracking to extract the first complete JSON object.
 */
function parseIntent(raw) {
    try {
        // Find the first opening brace
        const start = raw.indexOf('{');
        if (start === -1) return { intent: 'none', data: {} };

        // Walk forward tracking brace depth to find the matching closing brace
        let depth = 0;
        let end = -1;
        for (let i = start; i < raw.length; i++) {
            if (raw[i] === '{') depth++;
            else if (raw[i] === '}') {
                depth--;
                if (depth === 0) { end = i; break; }
            }
        }

        if (end === -1) return { intent: 'none', data: {} };

        const parsed = JSON.parse(raw.slice(start, end + 1));
        return parsed;
    } catch (e) {
        return { intent: 'none', data: {} };
    }
}


async function onReady(client) {
    const online = await isOnline();
    if (online) {
        console.log(`[brain] 🧠 Ollama online! Modelo: ${OLLAMA_MODEL}`);
    } else {
        console.log('[brain] ⚠️ Ollama offline — bot funcionará apenas com comandos ! diretos.');
    }
}

async function handleMessage(msg, client) {
    const chat_obj = await msg.getChat();

    // Brain only reads from Grupo Bot and Grupo Louvor (never private chats or other groups)
    if (!chat_obj.isGroup) return false;
    const isGrupoBot = chat_obj.name === GRUPO_BOT;
    const isGrupoLouvor = chat_obj.name === GRUPO_LOUVOR;
    if (!isGrupoBot && !isGrupoLouvor) return false;

    // Brain only responds/acts in Grupo Bot — let louvor skill handle Louvor discípulos
    if (!isGrupoBot) return false;

    const texto = msg.body.trim();

    // Skip empty or command messages (handled directly by other skills)
    if (!texto || texto.startsWith('!')) return false;

    // Skip bot's own reply messages to avoid loops (they start with known emoji patterns)
    const botPrefixes = ['⏳', '✅', '❌', '⚠️', '🛒', '📋', '🤖', '📊', '🔑'];
    if (botPrefixes.some(p => texto.startsWith(p))) return false;

    // Check if Ollama is online
    const online = await isOnline();
    if (!online) {
        console.log('[brain] ⚠️ Ollama offline, skipping AI routing.');
        return false; // Let other skills handle via commands
    }

    console.log(`[brain] 🧠 Processando com Ollama: "${texto.slice(0, 60)}..."`);

    let intentResult;
    try {
        const messages = buildMessages(texto);
        const raw = await chat(messages);
        console.log(`[brain] 📤 Ollama respondeu: ${raw.slice(0, 200)}`);
        intentResult = parseIntent(raw);
    } catch (err) {
        console.error('[brain] ❌ Erro ao chamar Ollama:', err.message);
        return false;
    }

    const { intent, data } = intentResult;
    console.log(`[brain] 🎯 Intent: ${intent}`, data);

    // Route to the matching skill
    if (intent && intent !== 'none' && intentHandlers[intent]) {
        try {
            await intentHandlers[intent](intent, data, msg, client);
        } catch (err) {
            console.error(`[brain] ❌ Erro ao executar intent "${intent}":`, err.message);
            await msg.reply(`❌ Erro ao processar sua solicitação: ${err.message}`);
        }
        return true;
    }

    // intent: none — friendly response
    if (intent === 'none') {
        return false; // Don't reply to random chats
    }

    return false;
}

module.exports = { name: 'brain', onReady, handleMessage, registerIntent };
