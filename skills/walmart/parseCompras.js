/**
 * parseCompras.js
 * Parses a WhatsApp shopping list message into an array of { quantidade, nome }.
 *
 * Supported formats per line:
 *   2x leite integral
 *   2 ovos
 *   6ovos
 *   pão de forma        (no quantity → quantidade = 1)
 *   arroz 5kg           (trailing weight info kept in name)
 */

/**
 * @param {string} texto - Raw WhatsApp message body (after the !compras command line)
 * @returns {{ quantidade: number, nome: string }[]}
 */
function parseCompras(texto) {
    const linhas = texto
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const itens = [];

    for (const linha of linhas) {
        // Skip the !compras command line itself
        if (linha.toLowerCase().startsWith('!compras')) continue;

        // Patterns:
        //   "2x leite"  →  grupos: qty=2, nome=leite
        //   "2 leite"   →  grupos: qty=2, nome=leite
        //   "2leite"    →  grupos: qty=2, nome=leite
        //   "leite"     →  no match on qty group, qty=1
        const match = linha.match(/^(\d+)\s*[xX]?\s+(.+)$/) ||
                      linha.match(/^(\d+)[xX](.+)$/);

        if (match) {
            const quantidade = parseInt(match[1], 10);
            const nome = match[2].trim();
            itens.push({ quantidade, nome });
        } else {
            // No leading number → quantity 1
            itens.push({ quantidade: 1, nome: linha });
        }
    }

    return itens;
}

/**
 * Formats a parsed list back to a readable string for confirmation messages.
 * @param {{ quantidade: number, nome: string }[]} itens
 * @returns {string}
 */
function formatarLista(itens) {
    return itens
        .map(i => `• ${i.quantidade > 1 ? `${i.quantidade}x ` : ''}${i.nome}`)
        .join('\n');
}

module.exports = { parseCompras, formatarLista };
