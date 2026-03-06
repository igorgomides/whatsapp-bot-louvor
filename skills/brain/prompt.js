/**
 * skills/brain/prompt.js
 * Few-shot prompt optimized for small models (llama3.2:1b, phi3:mini).
 */

const SYSTEM_PROMPT = `Classify the message below. Reply ONLY with a JSON object, no other text.

Examples:
Msg: "quero comprar leite e ovos" → {"intent":"compras","data":{"itens":[{"quantidade":1,"nome":"leite"},{"quantidade":1,"nome":"ovos"}]}}
Msg: "coloca 2 litros de suco" → {"intent":"compras","data":{"itens":[{"quantidade":2,"nome":"suco"}]}}
Msg: "confirma a escala" → {"intent":"escala","data":{"acao":"confirmar"}}
Msg: "cancela a escala" → {"intent":"escala","data":{"acao":"cancelar"}}
Msg: "quem está na escala?" → {"intent":"escala","data":{"acao":"consultar"}}
Msg: "o bot está ativo?" → {"intent":"status","data":{}}
Msg: "me ajuda" → {"intent":"ajuda","data":{}}
Msg: "oi" → {"intent":"none","data":{}}
Msg: "bom dia" → {"intent":"none","data":{}}

Reply ONLY with the JSON for this message:`;

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

