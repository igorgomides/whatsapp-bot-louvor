/**
 * exportWalmartCookies.js
 * Usa o SEU Chrome real (com sua sessão já logada) para exportar os cookies.
 * 
 * ANTES DE RODAR:
 *   1. Feche TODAS as janelas do Chrome
 *   2. Rode este script
 *   3. O Chrome vai abrir com sua sessão existente
 *   4. Navegue para walmart.ca e pressione ENTER no terminal
 *
 * Usage:
 *   node scripts/exportWalmartCookies.js
 */

require('dotenv').config();

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_FILE = path.join(__dirname, '../skills/walmart/walmart_cookies.json');
const WALMART_URL = 'https://www.walmart.ca';

// Chrome real do Mac com perfil existente (já logado em tudo)
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_PROFILE = path.join(process.env.HOME, 'Library/Application Support/Google/Chrome');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForEnter() {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('\n✅ Pressione ENTER para salvar os cookies do Walmart.ca: ', () => {
            rl.close();
            resolve();
        });
    });
}

async function main() {
    console.log('🚀 Iniciando exportação de cookies do Walmart.ca...');
    console.log('');
    console.log('⚠️  FECHE TODAS AS JANELAS DO CHROME ANTES DE CONTINUAR!');
    console.log('');
    console.log('📋 INSTRUÇÕES:');
    console.log('   1. Feche todo o Chrome (Cmd+Q)');
    console.log('   2. Pressione ENTER aqui para abrir o Chrome com seu perfil');
    console.log('   3. Navegue para walmart.ca e faça login se necessário');
    console.log('   4. Quando estiver logado, pressione ENTER novamente');
    console.log('');

    // Wait for user to close Chrome first
    await new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('Fechou o Chrome? Pressione ENTER para abrir: ', () => {
            rl.close();
            resolve();
        });
    });

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        executablePath: CHROME_PATH,       // Seu Chrome real
        userDataDir: CHROME_PROFILE,        // Seu perfil real (sessões salvas)
        args: [
            '--no-sandbox',
            '--start-maximized',
            '--profile-directory=Default',
        ],
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    console.log('\n🌐 Navegando para walmart.ca...');
    await page.goto(WALMART_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
    });

    console.log('');
    console.log('👆 Faça login no Walmart.ca se necessário.');
    console.log('   (Com seu Chrome real, pode já estar logado!)');

    await waitForEnter();

    console.log('\n⏳ Salvando cookies...');
    await sleep(1000);

    const currentUrl = page.url();
    console.log(`🌐 URL atual: ${currentUrl}`);

    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));

    console.log(`\n🍪 ${cookies.length} cookies salvos em:`);
    console.log(`   ${COOKIES_FILE}`);
    console.log('\n📋 Copie para o Linux com:');
    console.log(`\n   scp "${COOKIES_FILE}" igor-gomides@<IP-DO-LINUX>:~/Documents/Antigravity/whatsapp-bot/skills/walmart/walmart_cookies.json\n`);

    await browser.close();
    console.log('✅ Pronto!');
}

main().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
