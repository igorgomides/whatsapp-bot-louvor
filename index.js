/**
 * index.js — WhatsApp Bot Hub
 *
 * One WhatsApp session, multiple skills.
 * To add a new feature: create skills/<name>/index.js and register it below.
 */

require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');

// ─── Register Skills ───────────────────────────────────────────────────────────
// Each skill must export: { name, onReady(client), handleMessage(msg, client) }
// Brain must be first — it intercepts natural language before other skills
const skills = [
    require('./skills/brain'),
    require('./skills/louvor'),
    require('./skills/walmart'),
    // Future skills go here 👇
    // require('./skills/finance'),
    // require('./skills/reminders'),
];

// ─── Auth check ────────────────────────────────────────────────────────────────
let isAuthExists = false;
if (fs.existsSync('.wwebjs_auth/session/Default/Local Storage')) {
    isAuthExists = true;
}

// ─── Bot startup ───────────────────────────────────────────────────────────────
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
            ],
            headless: true,
            dumpio: false,
        },
    };

    if (numeroTelefone && !isAuthExists) {
        clientOptions.pairWithPhoneNumber = {
            phoneNumber: numeroTelefone,
            showNotification: true,
        };
    }

    const client = new Client(clientOptions);

    // ── Auth events ────────────────────────────────────────────────────────────

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
        console.log('\n⚠️ QR Code gerado — escaneie com o WhatsApp:');
        qrcode.generate(qr, { small: true });
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`⏳ Carregando... ${percent}%: ${message}`);
    });

    client.on('authenticated', () => {
        console.log('🔐 Autenticado com sucesso!');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Falha na autenticação:', msg);
    });

    client.on('ready', async () => {
        console.log('\n✅ Bot Hub pronto!');
        console.log(`🔧 Skills ativas: ${skills.map(s => s.name).join(', ')}`);

        // Initialize each skill
        for (const skill of skills) {
            try {
                if (skill.onReady) await skill.onReady(client);
            } catch (e) {
                console.error(`❌ Erro ao iniciar skill "${skill.name}":`, e.message);
            }
        }
    });

    // ── Message routing ────────────────────────────────────────────────────────

    client.on('message_create', async (msg) => {
        try {
            for (const skill of skills) {
                const handled = await skill.handleMessage(msg, client);
                if (handled) break; // First skill to handle wins; remove `break` to allow multiple
            }
        } catch (error) {
            console.error('❌ Erro no roteador de mensagens:', error);
        }
    });

    // ── Initialize ─────────────────────────────────────────────────────────────

    console.log('🚀 Inicializando Bot Hub...');
    client.initialize();

    // Graceful shutdown
    const shutdown = async (signal) => {
        console.log(`\n🛑 ${signal} recebido — encerrando bot...`);
        try {
            await client.destroy();
            console.log('✅ Navegador fechado.');
        } catch (e) {
            console.log('⚠️ Erro ao fechar navegador:', e.message);
        }
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
};

// ─── Entry point ───────────────────────────────────────────────────────────────

if (!isAuthExists) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('\n=========================================');
    console.log('🔄 PRIMEIRO ACESSO — AUTENTICAÇÃO');
    console.log('=========================================');

    rl.question('Digite seu número com DDI e DDD (Ex: 15195028015): ', (numero) => {
        const numeroLimpo = numero.replace(/[^0-9]/g, '');
        rl.close();
        if (numeroLimpo.length < 10) {
            console.log('❌ Número inválido. Reinicie o script.');
            process.exit(1);
        }
        console.log(`\n⏳ Solicitando código para: ${numeroLimpo}...`);
        startBot(numeroLimpo);
    });
} else {
    console.log('\n🔄 Sessão encontrada! Iniciando Bot Hub...');
    startBot();
}