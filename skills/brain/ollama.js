/**
 * skills/brain/ollama.js
 * Thin client for the Ollama REST API (http://localhost:11434).
 */

const http = require('http');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

/**
 * Send a chat request to Ollama and return the assistant's reply as a string.
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
function chat(messages, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model: OLLAMA_MODEL,
            messages,
            stream: false,
        });

        const url = new URL('/api/chat', OLLAMA_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 11434,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.message?.content || '');
                } catch (e) {
                    reject(new Error(`Resposta inválida do Ollama: ${data.slice(0, 200)}`));
                }
            });
        });

        req.on('error', reject);

        // Timeout
        const timer = setTimeout(() => {
            req.destroy();
            reject(new Error(`Ollama timeout após ${timeoutMs}ms`));
        }, timeoutMs);

        res => clearTimeout(timer); // eslint-disable-line
        req.on('response', () => clearTimeout(timer));

        req.write(body);
        req.end();
    });
}

/**
 * Check if Ollama is reachable.
 * @returns {Promise<boolean>}
 */
function isOnline() {
    return new Promise((resolve) => {
        const url = new URL('/', OLLAMA_URL);
        const req = http.request({
            hostname: url.hostname,
            port: url.port || 11434,
            path: '/',
            method: 'GET',
        }, () => resolve(true));
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => { req.destroy(); resolve(false); });
        req.end();
    });
}

module.exports = { chat, isOnline, OLLAMA_MODEL };
