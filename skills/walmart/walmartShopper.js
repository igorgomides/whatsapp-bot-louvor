/**
 * walmartShopper.js
 * Uses puppeteer-extra + stealth plugin to automate Walmart.ca shopping.
 *
 * Flow:
 *   1. Load saved cookies (avoid re-login on every run)
 *   2. If no cookies, log in and save cookies
 *   3. For each item: search, find first result, add to cart
 *   4. Return { adicionados, naoEncontrados }
 */

require('dotenv').config();

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_FILE = path.join(__dirname, 'walmart_cookies.json');
const WALMART_URL = 'https://www.walmart.ca';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Random delay to mimic human browsing speed */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 1200, max = 2800) {
    return sleep(min + Math.random() * (max - min));
}

/** Save browser cookies to disk */
async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log('🍪 Cookies salvos em walmart_cookies.json');
}

/** Load saved cookies into the page (returns true if file exists) */
async function loadCookies(page) {
    if (!fs.existsSync(COOKIES_FILE)) return false;
    try {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        await page.setCookie(...cookies);
        console.log('🍪 Cookies carregados do arquivo.');
        return true;
    } catch (e) {
        console.warn('⚠️ Erro ao carregar cookies:', e.message);
        return false;
    }
}

/** Login on Walmart.ca using credentials from .env */
async function fazerLogin(page) {
    console.log('🔐 Fazendo login no Walmart.ca...');

    await page.goto(`${WALMART_URL}/account/login`, { waitUntil: 'networkidle2', timeout: 60000 });
    await randomDelay();

    // Fill e-mail
    await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 15000 });
    await page.type('input[type="email"], input[name="email"], #email', process.env.WALMART_EMAIL, { delay: 60 });
    await randomDelay(500, 900);

    // Fill password
    await page.type('input[type="password"], input[name="password"], #password', process.env.WALMART_PASSWORD, { delay: 60 });
    await randomDelay(500, 900);

    // Submit
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    await saveCookies(page);
    console.log('✅ Login realizado com sucesso.');
}

/** Check if current page indicates we are logged in */
async function estaLogado(page) {
    try {
        // Navigate to the account page and check if redirected to login
        await page.goto(`${WALMART_URL}/account`, { waitUntil: 'networkidle2', timeout: 30000 });
        const url = page.url();
        return !url.includes('/login');
    } catch {
        return false;
    }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {{ quantidade: number, nome: string }[]} itens
 * @returns {Promise<{ adicionados: string[], naoEncontrados: string[] }>}
 */
async function fazerCompras(itens) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
        ],
    });

    const page = await browser.newPage();

    // Realistic viewport + user-agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    const adicionados = [];
    const naoEncontrados = [];

    try {
        // ── Authentication ──────────────────────────────────────────────────
        const cookiesLoaded = await loadCookies(page);

        if (cookiesLoaded) {
            const logado = await estaLogado(page);
            if (!logado) {
                console.log('⚠️ Cookies expirados. Fazendo novo login...');
                await fazerLogin(page);
            }
        } else {
            await fazerLogin(page);
        }

        // Navigate to home before starting to search
        await page.goto(WALMART_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await randomDelay();

        // ── Shopping loop ───────────────────────────────────────────────────
        for (const item of itens) {
            const { quantidade, nome } = item;
            const query = encodeURIComponent(nome);
            const searchUrl = `${WALMART_URL}/search?q=${query}`;

            console.log(`🔍 Buscando: "${nome}" (${quantidade}x)...`);

            try {
                await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                await randomDelay();

                // ── Find "Add to Cart" button on first result ───────────────
                // Walmart.ca uses several possible selectors; try each in order.
                const addToCartSelectors = [
                    'button[data-automation="add-to-cart-button"]',
                    'button[aria-label*="Add to cart"]',
                    'button[aria-label*="add to cart"]',
                    '[data-testid="addToCartBtn"]',
                    'button.add-to-cart-btn',
                ];

                let botaoEncontrado = false;

                for (const selector of addToCartSelectors) {
                    try {
                        await page.waitForSelector(selector, { timeout: 5000 });
                        const buttons = await page.$$(selector);

                        if (buttons.length > 0) {
                            // Click the first visible Add to Cart button
                            await buttons[0].click();
                            console.log(`  ✅ "${nome}" adicionado ao carrinho.`);
                            botaoEncontrado = true;

                            // If quantity > 1, try to set quantity
                            if (quantidade > 1) {
                                await randomDelay(800, 1200);
                                await ajustarQuantidade(page, quantidade);
                            }

                            adicionados.push(quantidade > 1 ? `${quantidade}x ${nome}` : nome);
                            break;
                        }
                    } catch {
                        // Selector not found, try next
                    }
                }

                if (!botaoEncontrado) {
                    console.log(`  ⚠️ "${nome}" — Botão "Add to cart" não encontrado.`);
                    naoEncontrados.push(nome);
                }
            } catch (err) {
                console.error(`  ❌ Erro ao buscar "${nome}":`, err.message);
                naoEncontrados.push(nome);
            }

            // Random pause between items to avoid bot detection
            await randomDelay(1500, 3000);
        }
    } finally {
        await browser.close();
        console.log('🔒 Navegador fechado.');
    }

    return { adicionados, naoEncontrados };
}

/**
 * Attempt to update the quantity field in the cart mini-modal (best effort).
 * Walmart sometimes shows a quantity stepper after adding to cart.
 */
async function ajustarQuantidade(page, quantidade) {
    try {
        // Some modals expose a quantity input
        const qtySelectors = [
            'input[aria-label*="quantity"]',
            'input[aria-label*="Quantity"]',
            'input[data-automation="quantity-input"]',
        ];

        for (const sel of qtySelectors) {
            const el = await page.$(sel);
            if (el) {
                await el.click({ clickCount: 3 });
                await el.type(String(quantidade), { delay: 50 });
                await page.keyboard.press('Enter');
                console.log(`    ℹ️ Quantidade ajustada para ${quantidade}.`);
                return;
            }
        }
    } catch (e) {
        // Quantity stepper not found — not a fatal error
        console.log(`    ⚠️ Não foi possível ajustar a quantidade (${e.message}). Adicionando 1 e continuando.`);
    }
}

module.exports = { fazerCompras };
