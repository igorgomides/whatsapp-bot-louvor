const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const { isEscala, parseEscala, formatarResumo } = require('./parseEscala');
const louveApp = require('./louveAppApi');

const GRUPO_LOUVOR = 'Louvor discípulos';
const GRUPO_LOUVOR_TB = 'Louvor discípulos tb';
const GRUPO_BOT = 'Whatsapp Bot';

// Armazena a última escala pendente de confirmação
let escalaPendente = null;

// Verifica se já existe uma sessão aparentemente válida salva
let isAuthExists = false;
if (fs.existsSync('.wwebjs_auth/session/Default/Local Storage')) {
    isAuthExists = true;
}

const startBot = (numeroTelefone = null) => {
    const clientOptions = {
        authStrategy: new LocalAuth(),
        puppeteer: {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-software-rasterizer',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ],
            headless: true,
            dumpio: false
        }
    };

    if (numeroTelefone && !isAuthExists) {
        clientOptions.pairWithPhoneNumber = {
            phoneNumber: numeroTelefone,
            showNotification: true
        };
    }

    const client = new Client(clientOptions);

    client.on('code', (code) => {
        console.log('\n=========================================');
        console.log(`📱 SEU CÓDIGO DE LIGAÇÃO É: ${code}`);
        console.log('=========================================');
        console.log('1. Abra o WhatsApp no seu celular.');
        console.log('2. Vá em Configurações > Aparelhos Conectados > Conectar um aparelho.');
        console.log('3. Toque em "Conectar com número de telefone".');
        console.log('4. Digite o código acima para conectar.\n');
    });

    client.on('qr', (qr) => {
        console.log('\n⚠️ EVENTO: "qr" disparado (O bot está pedindo um novo QR Code)');
        if (!isAuthExists) {
            console.log('ℹ️ É esperado pois não há sessão salva.');
        } else {
            console.log('‼️ A sessão salva parece ter expirado ou é inválida.');
        }
        console.log('Escaneie o QR Code abaixo:');
        qrcode.generate(qr, { small: true });
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`⏳ EVENTO: "loading_screen" -> ${percent}%: ${message}`);
    });

    client.on('authenticated', () => {
        console.log('🔐 EVENTO: "authenticated" -> Autenticado com sucesso!');
    });

    client.on('auth_failure', msg => {
        console.error('❌ EVENTO: "auth_failure" -> Falha na autenticação:', msg);
    });

    client.on('ready', () => {
        console.log('\n✅ EVENTO: "ready" -> Cliente pronto para uso!');
        console.log(`🎵 Escutando escalas no grupo "${GRUPO_LOUVOR}"`);
        console.log(`🤖 Comandos do bot no grupo "${GRUPO_BOT}"`);

        // Inicia refresh automático do token LouveApp
        louveApp.iniciarRefreshAutomatico();

        // Tenta renovar o token ao iniciar
        if (louveApp.getToken()) {
            louveApp.refreshToken().then(ok => {
                if (ok) console.log('🔑 Token LouveApp válido!');
                else console.log('⚠️ Token LouveApp expirado. Use !token <token> no grupo "links uteis".');
            });
        } else {
            console.log('⚠️ Token LouveApp não configurado. Use !token <token> no grupo "links uteis".');
        }
    });

    client.on('message_create', async msg => {
        try {
            const chat = await msg.getChat();
            if (!chat.isGroup) return;

            const textoFormatado = msg.body.toLowerCase().trim();

            // ============ GRUPO "Louvor discípulos" ============
            if (chat.name === GRUPO_LOUVOR) {
                let senderName = 'Desconhecido';
                try {
                    const contact = await msg.getContact();
                    senderName = contact.pushname || contact.name || contact.number;
                } catch (e) {
                    console.log('⚠️ Erro ao obter contato:', e.message);
                }

                console.log(`\n🔔 [${GRUPO_LOUVOR}] Mensagem de ${senderName}`);

                // Detecta se é uma escala
                if (isEscala(msg.body)) {
                    console.log('📋 ESCALA DETECTADA! Parseando...');

                    const dados = parseEscala(msg.body);
                    console.log('📊 Dados extraídos:', JSON.stringify(dados, null, 2));

                    if (dados.escalados.length > 0 && dados.musicas.length > 0) {
                        // Salva a escala pendente
                        escalaPendente = dados;

                        // Envia resumo para o grupo "links uteis" para confirmação
                        const chats = await client.getChats();
                        const grupoBot = chats.find(c => c.isGroup && c.name === GRUPO_BOT);

                        if (grupoBot) {
                            const resumo = formatarResumo(dados);
                            await grupoBot.sendMessage(resumo);
                            console.log(`✅ Resumo enviado para o grupo "${GRUPO_BOT}"`);
                        } else {
                            console.log(`⚠️ Grupo "${GRUPO_BOT}" não encontrado!`);
                        }
                    } else {
                        console.log('⚠️ Escala incompleta - poucos dados extraídos.');
                    }
                }
            }

            // ============ GRUPO "links uteis" (comandos do bot) ============
            if (chat.name === GRUPO_BOT) {
                try {
                    const contact = await msg.getContact();
                    console.log(`\n🤖 [${GRUPO_BOT}] Comando de ${contact.pushname || contact.name || contact.number}: ${msg.body}`);
                } catch (e) {
                    console.log(`\n🤖 [${GRUPO_BOT}] Comando recebido: ${msg.body} (Erro ao obter contato: ${e.message})`);
                }

                // Comando: !ping
                if (textoFormatado === '!ping') {
                    console.log('▶️ Executando: ping');
                    msg.reply('pong! O bot está ativo e escutando. 🤖');
                }

                // Comando: !status
                if (textoFormatado === '!status') {
                    const tokenStatus = louveApp.getToken() ? '✅ Configurado' : '❌ Não configurado';
                    const escalaStatus = escalaPendente
                        ? `✅ Pendente (${escalaPendente.escalados.length} pessoas, ${escalaPendente.musicas.length} músicas)`
                        : '❌ Nenhuma';

                    msg.reply(
                        `📊 *Status do Bot*\n\n` +
                        `🔑 Token LouveApp: ${tokenStatus}\n` +
                        `📋 Escala pendente: ${escalaStatus}`
                    );
                }

                // Comando: !token <token_jwt>
                if (textoFormatado.startsWith('!token ')) {
                    const token = msg.body.substring(7).trim();
                    if (token.length > 50) {
                        louveApp.saveToken(token);
                        msg.reply('✅ Token do LouveApp salvo com sucesso! Tentando renovar...');

                        const ok = await louveApp.refreshToken();
                        if (ok) {
                            msg.reply('🔑 Token válido e renovado!');
                        } else {
                            msg.reply('⚠️ Token pode ter expirado. Tente obter um novo token.');
                        }
                    } else {
                        msg.reply('❌ Token inválido. Cole o token JWT completo após !token.');
                    }
                }

                // Comando: !confirmar (confirma a escala pendente)
                if (textoFormatado === '!confirmar') {
                    if (!escalaPendente) {
                        msg.reply('❌ Nenhuma escala pendente para confirmar.');
                        return;
                    }

                    if (!louveApp.getToken()) {
                        msg.reply('❌ Token do LouveApp não configurado! Use !token <token> primeiro.');
                        return;
                    }

                    msg.reply('⏳ Criando escala no LouveApp... Aguarde.');

                    try {
                        const resultado = await louveApp.criarEscala({
                            descricao: 'Culto de Domingo',
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

                        msg.reply(confirmacaoMsg);

                        // Encaminha para o grupo Louvor discípulos tb
                        const chats = await client.getChats();
                        const grupoConfirmacao = chats.find(c => c.isGroup && c.name === GRUPO_LOUVOR_TB);

                        if (grupoConfirmacao) {
                            await grupoConfirmacao.sendMessage(confirmacaoMsg);
                            console.log(`✅ Confirmação enviada para o grupo "${GRUPO_LOUVOR_TB}"`);
                        } else {
                            console.log(`⚠️ Grupo "${GRUPO_LOUVOR_TB}" não encontrado para encaminhamento.`);
                        }

                        // Limpa a escala pendente
                        escalaPendente = null;
                    } catch (error) {
                        console.error('❌ Erro ao criar escala:', error);
                        msg.reply(`❌ Erro ao criar escala: ${error.message}\n\nTente novamente ou verifique o token.`);
                    }
                }

                // Comando: !cancelar (cancela a escala pendente)
                if (textoFormatado === '!cancelar') {
                    if (escalaPendente) {
                        escalaPendente = null;
                        msg.reply('❌ Escala pendente cancelada.');
                    } else {
                        msg.reply('ℹ️ Nenhuma escala pendente para cancelar.');
                    }
                }

                // Comando: !ajuda
                if (textoFormatado === '!ajuda') {
                    msg.reply(
                        '🤖 *Comandos do Bot*\n\n' +
                        '!ping — Testa se o bot está ativo\n' +
                        '!status — Mostra status do bot e token\n' +
                        '!token <jwt> — Configura o token do LouveApp\n' +
                        '!confirmar — Confirma e cria a escala pendente no LouveApp\n' +
                        '!cancelar — Cancela a escala pendente\n' +
                        '!ajuda — Mostra esta mensagem\n\n' +
                        `O bot detecta escalas automaticamente no grupo "${GRUPO_LOUVOR}" e envia o resumo aqui para confirmação.`
                    );
                }

                // Comando: !anotar (legado)
                if (textoFormatado.startsWith('!anotar ')) {
                    const informacao = msg.body.substring(8).trim();
                    msg.reply(`✅ Anotação salva: "${informacao}"`);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    });

    console.log('🚀 Inicializando cliente WhatsApp...');
    client.initialize();
};

if (!isAuthExists) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n=========================================');
    console.log('🔄 PRIMEIRO ACESSO - AUTENTICAÇÃO');
    console.log('=========================================');

    rl.question('Digite seu número com DDI e DDD (Ex: 5511999999999): ', (numero) => {
        const numeroLimpo = numero.replace(/[^0-9]/g, '');
        rl.close();

        if (numeroLimpo.length < 10) {
            console.log('❌ Número inválido. Reinicie o script e digite o número completo.');
            process.exit(1);
        }

        console.log(`\n⏳ Solicitando código para o número: ${numeroLimpo}... Aguarde.`);
        startBot(numeroLimpo);
    });
} else {
    console.log('\n🔄 Sessão encontrada! Iniciando o bot diretamente...');
    startBot();
}