/**
 * skills/louvor/index.js
 * Skill: Gerenciamento de escalas de louvor (LouveApp)
 */

const { isEscala, parseEscala, formatarResumo } = require('./parseEscala');
const louveApp = require('./louveAppApi');
const brain = require('../brain');

const GRUPO_LOUVOR = 'Louvor discípulos';
const GRUPO_LOUVOR_TB = 'Louvor discípulos tb';
const GRUPO_BOT = 'Whatsapp Bot';

// Escala pendente de confirmação (estado local da skill)
let escalaPendente = null;

/**
 * Called once when the bot is ready.
 */
async function onReady(client) {
    louveApp.iniciarRefreshAutomatico();

    if (louveApp.getToken()) {
        const ok = await louveApp.refreshToken();
        if (ok) console.log('[louvor] 🔑 Token LouveApp válido!');
        else console.log(`[louvor] ⚠️ Token LouveApp expirado. Use !token <token> em "${GRUPO_BOT}".`);
    } else {
        console.log(`[louvor] ⚠️ Token LouveApp não configurado. Use !token <token> em "${GRUPO_BOT}".`);
    }

    // Register AI intent handler
    brain.registerIntent('escala', handleIntent);
    brain.registerIntent('status', async (intent, data, msg) => {
        const tokenStatus = louveApp.getToken() ? '✅ Configurado' : '❌ Não configurado';
        const escalaStatus = escalaPendente
            ? `✅ Pendente (${escalaPendente.escalados.length} pessoas, ${escalaPendente.musicas.length} músicas)`
            : '❌ Nenhuma';
        await msg.reply(`📊 *Status do Bot*\n\n🔑 Token LouveApp: ${tokenStatus}\n📋 Escala pendente: ${escalaStatus}`);
    });
    brain.registerIntent('ajuda', async (intent, data, msg) => {
        await msg.reply(
            '🤖 *O que eu sei fazer:*\n\n' +
            '🛒 *Compras* — "coloca leite e ovos no walmart"\n' +
            '📋 *Escala* — "confirma a escala" / "cancela a escala"\n' +
            '📊 *Status* — "o bot está ativo?"\n\n' +
            'Você também pode usar comandos diretos: !compras, !confirmar, !cancelar, !status'
        );
    });
}

/**
 * Main message handler. Returns true if the message was handled.
 */
async function handleMessage(msg, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return false;

    const textoFormatado = msg.body.toLowerCase().trim();

    // ── Grupo Louvor discípulos — detecta escalas automaticamente ─────────────
    if (chat.name === GRUPO_LOUVOR) {
        let senderName = 'Desconhecido';
        try {
            const contact = await msg.getContact();
            senderName = contact.pushname || contact.name || contact.number;
        } catch (e) {
            console.log('[louvor] ⚠️ Erro ao obter contato:', e.message);
        }

        console.log(`\n[louvor] 🔔 [${GRUPO_LOUVOR}] Mensagem de ${senderName}`);

        if (isEscala(msg.body)) {
            console.log('[louvor] 📋 ESCALA DETECTADA! Parseando...');
            const dados = parseEscala(msg.body);
            console.log('[louvor] 📊 Dados extraídos:', JSON.stringify(dados, null, 2));

            if (dados.escalados.length > 0 && dados.musicas.length > 0) {
                escalaPendente = dados;
                const chats = await client.getChats();
                const grupoBot = chats.find(c => c.isGroup && c.name === GRUPO_BOT);

                if (grupoBot) {
                    await grupoBot.sendMessage(formatarResumo(dados));
                    console.log(`[louvor] ✅ Resumo enviado para "${GRUPO_BOT}"`);
                } else {
                    console.log(`[louvor] ⚠️ Grupo "${GRUPO_BOT}" não encontrado!`);
                }
            } else {
                console.log('[louvor] ⚠️ Escala incompleta — poucos dados extraídos.');
            }
        }
        return true;
    }

    // ── Grupo Bot — comandos de louvor ────────────────────────────────────────
    if (chat.name === GRUPO_BOT) {
        try {
            const contact = await msg.getContact();
            console.log(`\n[louvor] 🤖 [${GRUPO_BOT}] ${contact.pushname || contact.number}: ${msg.body}`);
        } catch (e) {
            console.log(`\n[louvor] 🤖 [${GRUPO_BOT}] Comando: ${msg.body}`);
        }

        if (textoFormatado === '!ping') {
            await msg.reply('pong! O bot está ativo e escutando. 🤖');
            return true;
        }

        if (textoFormatado === '!status') {
            const tokenStatus = louveApp.getToken() ? '✅ Configurado' : '❌ Não configurado';
            const escalaStatus = escalaPendente
                ? `✅ Pendente (${escalaPendente.escalados.length} pessoas, ${escalaPendente.musicas.length} músicas)`
                : '❌ Nenhuma';
            await msg.reply(
                `📊 *Status do Bot*\n\n` +
                `🔑 Token LouveApp: ${tokenStatus}\n` +
                `📋 Escala pendente: ${escalaStatus}`
            );
            return true;
        }

        if (textoFormatado.startsWith('!token ')) {
            const token = msg.body.substring(7).trim();
            if (token.length > 50) {
                louveApp.saveToken(token);
                await msg.reply('✅ Token do LouveApp salvo! Tentando renovar...');
                const ok = await louveApp.refreshToken();
                await msg.reply(ok ? '🔑 Token válido e renovado!' : '⚠️ Token pode ter expirado.');
            } else {
                await msg.reply('❌ Token inválido. Cole o token JWT completo após !token.');
            }
            return true;
        }

        if (textoFormatado === '!confirmar') {
            if (!escalaPendente) { await msg.reply('❌ Nenhuma escala pendente.'); return true; }
            if (!louveApp.getToken()) { await msg.reply('❌ Token não configurado! Use !token <token> primeiro.'); return true; }

            await msg.reply('⏳ Criando escala no LouveApp... Aguarde.');
            try {
                await louveApp.criarEscala({
                    descricao: escalaPendente.descricao || 'Culto de Domingo',
                    data: escalaPendente.dataEvento,
                    escalados: escalaPendente.escalados,
                    musicas: escalaPendente.musicas,
                });

                const confirmacaoMsg =
                    '✅ *Escala criada com sucesso no LouveApp!*\n\n' +
                    `📅 ${new Date(escalaPendente.dataEvento).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}\n` +
                    `👥 ${escalaPendente.escalados.length} membros\n` +
                    `🎵 ${escalaPendente.musicas.length} músicas\n\n` +
                    '🔗 Confira em: https://app.louveapp.com.br';

                await msg.reply(confirmacaoMsg);

                const chats = await client.getChats();
                const grupoTb = chats.find(c => c.isGroup && c.name === GRUPO_LOUVOR_TB);
                if (grupoTb) {
                    await grupoTb.sendMessage(confirmacaoMsg);
                    console.log(`[louvor] ✅ Confirmação encaminhada para "${GRUPO_LOUVOR_TB}"`);
                }

                escalaPendente = null;
            } catch (error) {
                console.error('[louvor] ❌ Erro ao criar escala:', error);
                await msg.reply(`❌ Erro ao criar escala: ${error.message}`);
            }
            return true;
        }

        if (textoFormatado.startsWith('!escala')) {
            if (textoFormatado === '!escala') {
                await msg.reply('❌ Envie a escala junto com o comando.\nEx: !escala\n@nome\nMusica 1');
                return true;
            }
            const textoEscala = msg.body.replace(/^!escala\s*/i, '');
            const dados = parseEscala(textoEscala);
            if (dados.escalados.length > 0 && dados.musicas.length > 0) {
                escalaPendente = dados;
                await msg.reply(formatarResumo(dados));
            } else {
                await msg.reply('⚠️ Escala inválida. Marque membros com @ e liste músicas em linhas separadas.');
            }
            return true;
        }

        if (textoFormatado.startsWith('!alterar ')) {
            if (!escalaPendente) {
                await msg.reply('❌ Nenhuma escala pendente. Use !escala primeiro.');
                return true;
            }
            const parte = msg.body.replace(/^!alterar\s+/i, '');
            const idx = parte.indexOf(' ');
            const campo = (idx !== -1 ? parte.substring(0, idx) : parte).toLowerCase().trim();
            const valor = idx !== -1 ? parte.substring(idx + 1).trim() : '';

            if (!valor) {
                await msg.reply('❌ Informe o novo valor. Ex: !alterar data 15/03');
            } else if (campo === 'data') {
                const regexData = /^(?:[0-2][0-9]|3[01])\/(?:0[1-9]|1[0-2])(?:\/(?:\d{4}|\d{2}))?$/;
                if (!regexData.test(valor)) {
                    await msg.reply('❌ Formato de data inválido. Use DD/MM ou DD/MM/YYYY.');
                } else {
                    const d = new Date(escalaPendente.dataEvento);
                    const partes = valor.split('/');
                    d.setFullYear(
                        partes.length === 3 ? (partes[2].length === 2 ? 2000 + parseInt(partes[2]) : parseInt(partes[2])) : d.getFullYear(),
                        parseInt(partes[1]) - 1,
                        parseInt(partes[0])
                    );
                    escalaPendente.dataEvento = d.toISOString();
                    await msg.reply(`✅ Data alterada!\n\n${formatarResumo(escalaPendente)}`);
                }
            } else if (campo === 'hora') {
                const regexHora = /^(?:0[0-9]|1[0-9]|2[0-3])[:h][0-5][0-9]$/i;
                if (!regexHora.test(valor)) {
                    await msg.reply('❌ Formato inválido. Use HH:MM ou HHhMM.');
                } else {
                    const d = new Date(escalaPendente.dataEvento);
                    const ph = valor.replace(/h/i, ':').split(':');
                    d.setHours(parseInt(ph[0]), parseInt(ph[1]), 0, 0);
                    escalaPendente.dataEvento = d.toISOString();
                    await msg.reply(`✅ Horário alterado!\n\n${formatarResumo(escalaPendente)}`);
                }
            } else if (campo === 'descricao' || campo === 'descrição') {
                escalaPendente.descricao = valor;
                await msg.reply(`✅ Descrição alterada!\n\n${formatarResumo(escalaPendente)}`);
            } else {
                await msg.reply('❌ Campo desconhecido. Use: data | hora | descricao');
            }
            return true;
        }

        if (textoFormatado === '!cancelar') {
            escalaPendente ? (escalaPendente = null, await msg.reply('❌ Escala cancelada.'))
                : await msg.reply('ℹ️ Nenhuma escala pendente.');
            return true;
        }

        if (textoFormatado === '!ajuda') {
            await msg.reply(
                '🤖 *Comandos do Bot — Louvor*\n\n' +
                '!ping — Testa se o bot está ativo\n' +
                '!status — Status do bot e token\n' +
                '!token <jwt> — Configura token do LouveApp\n' +
                '!escala <texto> — Cria escala manual\n' +
                '!alterar data DD/MM — Muda data\n' +
                '!alterar hora HH:MM — Muda horário\n' +
                '!alterar descricao <texto> — Muda descrição\n' +
                '!confirmar — Cria escala no LouveApp\n' +
                '!cancelar — Cancela escala pendente\n' +
                '!ajuda — Esta mensagem\n\n' +
                `O bot detecta escalas no grupo "${GRUPO_LOUVOR}" automaticamente.`
            );
            return true;
        }

        // Legacy
        if (textoFormatado.startsWith('!anotar ')) {
            await msg.reply(`✅ Anotação salva: "${msg.body.substring(8).trim()}"`);
            return true;
        }
    }

    return false;
}

/**
 * Called by brain skill when Ollama classifies intent as 'escala'.
 */
async function handleIntent(intent, data, msg, client) {
    const acao = data.acao || 'consultar';

    if (acao === 'confirmar') {
        // Reuse the !confirmar logic
        const fakeMsg = { ...msg, body: '!confirmar' };
        fakeMsg.reply = msg.reply.bind(msg);
        // Directly call confirm flow
        if (!escalaPendente) { await msg.reply('❌ Nenhuma escala pendente para confirmar.'); return; }
        if (!louveApp.getToken()) { await msg.reply('❌ Token não configurado! Use !token <token> primeiro.'); return; }
        await msg.reply('⏳ Criando escala no LouveApp...');
        try {
            await louveApp.criarEscala({
                descricao: escalaPendente.descricao || 'Culto de Domingo',
                data: escalaPendente.dataEvento,
                escalados: escalaPendente.escalados,
                musicas: escalaPendente.musicas,
            });
            await msg.reply('✅ *Escala criada com sucesso no LouveApp!*\n\n🔗 https://app.louveapp.com.br');
            escalaPendente = null;
        } catch (e) {
            await msg.reply(`❌ Erro ao criar escala: ${e.message}`);
        }
    } else if (acao === 'cancelar') {
        escalaPendente ? (escalaPendente = null, await msg.reply('❌ Escala cancelada.'))
            : await msg.reply('ℹ️ Nenhuma escala pendente.');
    } else {
        // consultar / default
        if (!escalaPendente) {
            await msg.reply('ℹ️ Não há escala pendente no momento.');
        } else {
            await msg.reply(formatarResumo(escalaPendente));
        }
    }
}

module.exports = { name: 'louvor', onReady, handleMessage };
