/**
 * skills/brain/prompt.js
 * Few-shot prompt optimized for small models (llama3.2:1b, phi3:mini).
 */

const SYSTEM_PROMPT = `Classify WhatsApp messages. Reply ONLY with JSON, nothing else.

Examples:
user: "quero comprar leite e ovos"
assistant: {"intent":"compras","data":{"itens":[{"quantidade":1,"nome":"leite"},{"quantidade":1,"nome":"ovos"}]}}

user: "coloca 2 litros de suco no walmart"
assistant: {"intent":"compras","data":{"itens":[{"quantidade":2,"nome":"suco"}]}}

user: "confirma a escala"
assistant: {"intent":"escala","data":{"acao":"confirmar"}}

user: "cancela a escala"
assistant: {"intent":"escala","data":{"acao":"cancelar"}}

user: "quem está na escala?"
assistant: {"intent":"escala","data":{"acao":"consultar"}}

user: "o bot está ativo?"
assistant: {"intent":"status","data":{}}

user: "me ajuda"
assistant: {"intent":"ajuda","data":{}}

user: "oi"
assistant: {"intent":"none","data":{}}

user: "bom dia"
assistant: {"intent":"none","data":{}}

Now classify this message and reply ONLY with JSON:`;

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

