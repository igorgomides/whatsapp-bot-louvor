/**
 * skills/brain/prompt.js
 * Ultra-short system prompt optimized for small models (llama3.2:1b, phi3:mini).
 */

const SYSTEM_PROMPT = `You classify WhatsApp messages into JSON. Reply ONLY with JSON, no extra text.

Intents: "compras" (buy items), "escala" (worship schedule), "status" (bot alive?), "ajuda" (help), "none" (other)

Format:
- compras: {"intent":"compras","data":{"itens":[{"quantidade":1,"nome":"item"}]}}
- escala:  {"intent":"escala","data":{"acao":"consultar"|"confirmar"|"cancelar"}}
- outros:  {"intent":"<intent>","data":{}}

Reply ONLY with the JSON object.`;

/**
 * Build the messages array for the Ollama chat API.
 * @param {string} userMessage
 * @returns {Array<{role: string, content: string}>}
 */
function buildMessages(userMessage) {
   return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
   ];
}

module.exports = { buildMessages };

