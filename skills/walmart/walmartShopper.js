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
const SCREENSHOT_DIR = path.join(__dirname, 'debug_screenshots');
const WALMART_URL = 'https://www.walmart.ca';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Random delay to mimic human browsing speed */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 1200, max = 2800) {
    return sleep(min + Math.random() * (max - min));
}

/** Save a debug screenshot */
async function screenshot(page, name) {
    try {
        if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        const file = path.join(SCREENSHOT_DIR, `${name}_${Date.now()}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`📸 Screenshot salvo: ${file}`);
    } catch (e) {
        console.warn('⚠️ Não foi possível salvar screenshot:', e.message);
    }
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
        const raw = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));

        // Puppeteer only accepts these specific fields — strip everything else
        const VALID_FIELDS = new Set(['name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite', 'url']);
        const VALID_SAMESITE = new Set(['Strict', 'Lax', 'None']);

        const cookies = raw
            .filter(c => c.name && c.value !== undefined)
            .map(c => {
                const clean = {};
                for (const [k, v] of Object.entries(c)) {
                    if (VALID_FIELDS.has(k)) clean[k] = v;
                }
                // Force .ca domain (chrome-cookies-secure may have .com cookies mixed in)
                if (clean.domain && clean.domain.includes('walmart')) {
                    clean.domain = clean.domain.replace('walmart.com', 'walmart.ca');
                }
                // Fix invalid sameSite values
                if (clean.sameSite && !VALID_SAMESITE.has(clean.sameSite)) {
                    delete clean.sameSite;
                }
                return clean;
            })
            // Only load walmart.ca cookies
            .filter(c => !c.domain || c.domain.includes('walmart.ca'));

        // Set cookies one at a time — skip any that Puppeteer still rejects
        let loaded = 0;
        let skipped = 0;
        for (const cookie of cookies) {
            try {
                await page.setCookie(cookie);
                loaded++;
            } catch {
                skipped++;
            }
        }

        if (loaded === 0) {
            console.warn('⚠️ Nenhum cookie válido para walmart.ca encontrado no arquivo.');
            return false;
        }

        console.log(`🍪 ${loaded} cookies carregados${skipped > 0 ? ` (${skipped} ignorados)` : ''}.`);
        return true;
    } catch (e) {
        console.warn('⚠️ Erro ao carregar cookies:', e.message);
        return false;
    }
}

/** Navigate to a URL with fallback from networkidle2 → domcontentloaded */
async function gotoSafe(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    } catch {
        console.warn('⚠️ networkidle2 falhou, tentando domcontentloaded...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(3000); // extra wait for JS render
    }
    // Always try to resolve CAPTCHA after navigating
    await resolveCaptcha(page);
}

/**
 * Detects and solves the Walmart "Robot or human? PRESS & HOLD" DataDome CAPTCHA.
 * Simulates a realistic mouse hold on the button.
 */
async function resolveCaptcha(page) {
    const holdSelectors = [
        // DataDome press-and-hold button
        'button[id*="hold"]',
        'button[class*="hold"]',
        '[aria-label*="hold" i]',
        '[aria-label*="human" i]',
        // Generic fallback — button with "PRESS" in visible text
        'button',
    ];

    try {
        // Check if the captcha modal is visible (short timeout — don't slow normal flow)
        const captchaText = await page.$('div ::-p-text(Robot or human)') ||
            await page.$('div ::-p-text(PRESS & HOLD)') ||
            await page.$('div ::-p-text(confirm that you\'re human)');

        if (!captchaText) return; // No CAPTCHA visible

        console.log('🤖 CAPTCHA "PRESS & HOLD" detectado! Tentando resolver...');
        await screenshot(page, 'captcha_detected');

        // Find the hold button: try specific selectors first
        let holdBtn = null;

        // Try to find a button near the CAPTCHA text
        holdBtn = await page.$('button');

        // Broader search — find the button with hold text
        if (!holdBtn) {
            const allButtons = await page.$$('button');
            for (const btn of allButtons) {
                const text = await btn.evaluate(el => el.textContent);
                if (/hold|press|human/i.test(text)) {
                    holdBtn = btn;
                    break;
                }
            }
        }

        if (!holdBtn) {
            console.warn('⚠️ Botão do CAPTCHA não encontrado.');
            await screenshot(page, 'captcha_btn_not_found');
            return;
        }

        const box = await holdBtn.boundingBox();
        if (!box) return;

        // Move mouse to center of button
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        await page.mouse.move(x, y, { steps: 10 });
        await sleep(300);

        // Press and hold for 4 seconds (mimicking human behavior)
        await page.mouse.down();
        console.log('🖱️ Segurando botão do CAPTCHA por 4s...');
        await sleep(4000 + Math.random() * 1000);
        await page.mouse.up();

        console.log('✅ CAPTCHA resolvido! Aguardando resposta...');
        await sleep(2500);
        await screenshot(page, 'captcha_after_hold');

    } catch (e) {
        // CAPTCHA not present or couldn't solve — continue anyway
        console.log(`ℹ️ Sem CAPTCHA ou não resolvível: ${e.message}`);
    }
}

/** Login on Walmart.ca using credentials from .env */
async function fazerLogin(page) {
    console.log('🔐 Fazendo login no Walmart.ca...');

    await gotoSafe(page, `${WALMART_URL}/account/login`);
    await randomDelay(1500, 2500);

    // Debug: what does the page look like?
    const currentUrl = page.url();
    console.log(`🌐 URL atual após navegar para login: ${currentUrl}`);
    await screenshot(page, 'login_page');

    // Extended list of selectors Walmart uses for the email field
    const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        '#email',
        'input[autocomplete="email"]',
        'input[autocomplete="username"]',
        'input[placeholder*="mail" i]',
        'input[data-automation="email"]',
    ];

    let emailField = null;
    for (const sel of emailSelectors) {
        try {
            await page.waitForSelector(sel, { timeout: 8000 });
            emailField = sel;
            console.log(`✅ Campo de email encontrado: ${sel}`);
            break;
        } catch {
            // try next
        }
    }

    if (!emailField) {
        await screenshot(page, 'login_no_email_field');
        throw new Error('Campo de email não encontrado. Walmart pode estar bloqueando. Veja o screenshot em skills/walmart/debug_screenshots/');
    }

    // Type email
    await page.type(emailField, process.env.WALMART_EMAIL, { delay: 70 });
    await randomDelay(500, 900);

    // Password selectors
    const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        '#password',
        'input[autocomplete="current-password"]',
        'input[data-automation="password"]',
    ];

    let passwordField = null;
    for (const sel of passwordSelectors) {
        const el = await page.$(sel);
        if (el) { passwordField = sel; break; }
    }

    if (!passwordField) {
        await screenshot(page, 'login_no_password_field');
        throw new Error('Campo de senha não encontrado.');
    }

    await page.type(passwordField, process.env.WALMART_PASSWORD, { delay: 70 });
    await randomDelay(500, 900);

    // Submit
    await page.keyboard.press('Enter');

    try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
        await sleep(4000);
    }

    await screenshot(page, 'login_after_submit');
    const urlApos = page.url();
    console.log(`🌐 URL após login: ${urlApos}`);

    if (urlApos.includes('/login')) {
        await screenshot(page, 'login_failed');
        throw new Error('Login falhou — ainda na página de login. Verifique credenciais ou CAPTCHA.');
    }

    await saveCookies(page);
    console.log('✅ Login realizado com sucesso.');
}

/** Check if current page indicates we are logged in */
async function estaLogado(page) {
    try {
        await gotoSafe(page, `${WALMART_URL}/account`);
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

    // Force Canadian locale so walmart.ca doesn't redirect to .com
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-CA,en;q=0.9,fr-CA;q=0.8',
    });

    // Override navigator.language to appear as Canadian browser
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'language', { get: () => 'en-CA' });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-CA', 'en'] });
    });


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
        await gotoSafe(page, WALMART_URL);
        await randomDelay();

        // ── Shopping loop ───────────────────────────────────────────────────
        for (const item of itens) {
            const { quantidade, nome } = item;
            const query = encodeURIComponent(nome);
            const searchUrl = `${WALMART_URL}/search?q=${query}`;

            console.log(`🔍 Buscando: "${nome}" (${quantidade}x)...`);

            try {
                await gotoSafe(page, searchUrl);
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
                    await screenshot(page, `item_not_found_${nome.replace(/\s+/g, '_')}`);
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
