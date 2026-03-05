/**
 * getChromeWalmartCookies.js
 * Lê os cookies do Walmart.ca direto do banco de dados do Chrome no Mac.
 * Não precisa abrir browser nenhum!
 *
 * Usage:
 *   node scripts/getChromeWalmartCookies.js
 */

const chrome = require('chrome-cookies-secure');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, '../skills/walmart/walmart_cookies.json');

console.log('🍪 Lendo cookies do Walmart.ca do Chrome...');

chrome.getCookies('https://www.walmart.ca/', 'puppeteer', (err, cookies) => {
    if (err) {
        console.error('❌ Erro:', err.message);
        console.log('\n💡 Dica: Certifique-se de que o Chrome está fechado e que você está logado no Walmart.ca');
        process.exit(1);
    }

    if (!cookies || cookies.length === 0) {
        console.error('❌ Nenhum cookie encontrado para walmart.ca');
        console.log('💡 Abra o Chrome, faça login no walmart.ca, feche o Chrome, e rode de novo.');
        process.exit(1);
    }

    // Clean cookies to Puppeteer-compatible format
    const VALID_FIELDS = new Set(['name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite', 'url']);
    const VALID_SAMESITE = new Set(['Strict', 'Lax', 'None']);

    const cleaned = cookies.map(c => {
        const clean = {};
        for (const [k, v] of Object.entries(c)) {
            if (VALID_FIELDS.has(k)) clean[k] = v;
        }
        if (clean.sameSite && !VALID_SAMESITE.has(clean.sameSite)) delete clean.sameSite;
        return clean;
    });

    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cleaned, null, 2));
    console.log(`✅ ${cleaned.length} cookies salvos (limpos) em: ${COOKIES_FILE}`);
    console.log('\n📋 Copie para o Linux com:');
    console.log(`\n   scp "${COOKIES_FILE}" igor-gomides@<IP-DO-LINUX>:~/Documents/Antigravity/whatsapp-bot/skills/walmart/walmart_cookies.json\n`);
});

