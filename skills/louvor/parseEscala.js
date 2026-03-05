/**
 * parseEscala.js
 * Parseia a mensagem de escala do Bruno no grupo do WhatsApp
 * e extrai os membros escalados e as músicas.
 */

// Mapeamento: nome no WhatsApp → nome no LouveApp
const MAPEAMENTO_NOMES = {
    'willo': 'Willians Crisanto',
    'igor gomides': 'Igor Gomides',
    'julimar sobrinho': 'Julimar Sobrinho',
    'pollyanna': 'Polly Gomides',
    'polly': 'Polly Gomides',
    'roberta': 'Roberta sobrinho',
    'loys': 'Loys',
    'natali': 'Natali Santos',
    'natália': 'Natalia',
    'natalia': 'Natalia',
    'williams': 'Samantha Johnston',
    'samantha': 'Samantha Johnston',
};

/**
 * Detecta se uma mensagem é uma escala do louvor.
 * Procura por padrões como @ menções seguidas de nomes de músicas.
 */
function isEscala(msgBody) {
    const texto = msgBody.toLowerCase();
    // Deve ter pelo menos 2 menções com @ e pelo menos 2 linhas de músicas
    const linhas = msgBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const linhasMencao = linhas.filter(l => l.startsWith('@'));

    // Se tem pelo menos 2 menções e o texto tem mais de 5 linhas, 
    // provavelmente é uma escala
    if (linhasMencao.length >= 2 && linhas.length >= 5) {
        return true;
    }
    return false;
}

/**
 * Extrai os dados da escala a partir da mensagem.
 * @param {string} msgBody - Texto da mensagem
 * @returns {{ escalados: string[], musicas: string[], dataEvento: string }}
 */
function parseEscala(msgBody) {
    const linhas = msgBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const escalados = [];
    const musicas = [];
    let passouMencoes = false;

    for (const linha of linhas) {
        // Linhas com @ são membros escalados
        if (linha.startsWith('@')) {
            // Extrai o nome após o @
            let nome = linha.substring(1).trim();

            // Remove caracteres especiais e números de telefone
            // Se começa com + é um número, pula
            if (nome.startsWith('+')) continue;

            // Tenta encontrar no mapeamento
            const nomeLower = nome.toLowerCase();
            let nomeEncontrado = null;

            for (const [chave, valor] of Object.entries(MAPEAMENTO_NOMES)) {
                if (nomeLower.includes(chave) || chave.includes(nomeLower)) {
                    nomeEncontrado = valor;
                    break;
                }
            }

            if (nomeEncontrado) {
                // Evita duplicatas (Willo e Williams podem ser a mesma pessoa)
                if (!escalados.includes(nomeEncontrado)) {
                    escalados.push(nomeEncontrado);
                }
            } else {
                console.log(`⚠️ Nome não mapeado: "${nome}". Ignorando.`);
            }

            continue;
        }

        // Se já passamos pelas menções e a linha não é uma saudação/versículo,
        // provavelmente é uma música
        if (escalados.length > 0) {
            passouMencoes = true;
        }

        if (passouMencoes) {
            // Ignora linhas que parecem saudações ou versículos
            const linhaLower = linha.toLowerCase();

            // Ignora saudações comuns
            if (linhaLower.startsWith('boa ') || linhaLower.startsWith('bom ') ||
                linhaLower.startsWith('oi ') || linhaLower.startsWith('olá') ||
                linhaLower.startsWith('pessoal') || linhaLower.includes('perdoe') ||
                linhaLower.includes('desculp') || linhaLower.includes('lista')) {
                continue;
            }

            // Ignora versículos (geralmente têm aspas ou referências bíblicas)
            if (linha.startsWith('"') || linha.startsWith('"') || linha.startsWith('"') ||
                linha.startsWith('«') || linha.startsWith('\'')) {
                continue;
            }
            // Referências bíblicas comuns (Ex: Salmos 86:11 NVT)
            if (/^[A-Z]\w+\s+\d+:\d+/.test(linha) || /NVT|NVI|ARA|ACF|ARC/.test(linha)) {
                continue;
            }

            // Se a linha não é vazia e parece um nome de música
            if (linha.length > 1 && linha.length < 100) {
                // Remove sufixos como "(kids)" para busca
                let nomeMusica = linha.replace(/\s*\(kids\)\s*/gi, '').trim();
                if (nomeMusica.length > 0) {
                    musicas.push(nomeMusica);
                }
            }
        }
    }

    // Regex para encontrar datas (DD/MM ou DD/MM/YYYY) e horas (HH:MM ou HHhMM)
    const regexData = /\b(?:[0-2][0-9]|3[01])\/(?:0[1-9]|1[0-2])(?:\/(?:\d{4}|\d{2}))?\b/;
    const regexHora = /\b(?:0[0-9]|1[0-9]|2[0-3])[:h][0-5][0-9]\b/i;

    const dataMatch = msgBody.match(regexData);
    const horaMatch = msgBody.match(regexHora);

    let dataEvento;
    const agora = new Date();

    if (dataMatch || horaMatch) {
        // Partimos do dia atual ou de uma data base
        dataEvento = new Date(agora);

        if (dataMatch) {
            const partesData = dataMatch[0].split('/');
            const dia = parseInt(partesData[0], 10);
            const mes = parseInt(partesData[1], 10) - 1; // 0-indexado
            let ano = agora.getFullYear();

            if (partesData.length === 3) {
                ano = partesData[2].length === 2 ? 2000 + parseInt(partesData[2], 10) : parseInt(partesData[2], 10);
            } else {
                // Se o mês já passou este ano, assume o próximo ano (ex: Dezembro e estamos em Janeiro, mas se estamos dezembro e a escala é em janeiro do prox ano)
                // Para simplificar, se o mês é menor que hoje e a diferença é grande, pode ser do ano que vem.
                if (mes < agora.getMonth()) {
                    ano++;
                }
            }

            dataEvento.setFullYear(ano, mes, dia);
        } else {
            // Se só enviou a hora, tenta descobrir se é pro mesmo dia ou usa a lógica do próximo domingo
            // Vamos simplificar e basear como "Hoje" se só mandar hora, ou poderiamos usar o domingo
            // Como a escala normal é domingo, vamos assumir o próximo domingo como data base se usar só hora e não dia
            dataEvento = new Date(calcularProximoDomingo());
        }

        // Aplica a Hora
        if (horaMatch) {
            const partesHora = horaMatch[0].replace('h', ':').replace('H', ':').split(':');
            const hora = parseInt(partesHora[0], 10);
            const minuto = parseInt(partesHora[1], 10);
            dataEvento.setHours(hora, minuto, 0, 0);
        } else {
            // Hora padrão
            dataEvento.setHours(17, 0, 0, 0);
        }

        dataEvento = dataEvento.toISOString();
    } else {
        // Comportamento original
        dataEvento = calcularProximoDomingo();
    }

    return {
        escalados,
        musicas,
        dataEvento
    };
}

/**
 * Calcula a data do próximo domingo às 17:00 (EST/EDT).
 * Se hoje já é domingo e ainda não passou das 17h, retorna hoje.
 */
function calcularProximoDomingo() {
    const agora = new Date();
    const diaSemana = agora.getDay(); // 0 = domingo

    let diasAtedomingo;
    if (diaSemana === 0) {
        // Se já é domingo
        diasAtedomingo = 0;
    } else {
        diasAtedomingo = 7 - diaSemana;
    }

    const domingo = new Date(agora);
    domingo.setDate(agora.getDate() + diasAtedomingo);
    domingo.setHours(17, 0, 0, 0);

    return domingo.toISOString();
}

/**
 * Formata os dados da escala para exibição.
 */
function formatarResumo(dados) {
    let resumo = '📋 *ESCALA DETECTADA*\n\n';

    // Formata a data e a hora dinamicamente do objeto Date
    const dataObj = new Date(dados.dataEvento);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    resumo += `📅 Data: ${dataFormatada} às ${horaFormatada}\n\n`;

    resumo += '👥 *Escalados:*\n';
    dados.escalados.forEach(nome => {
        resumo += `  • ${nome}\n`;
    });

    resumo += '\n🎵 *Músicas:*\n';
    dados.musicas.forEach(musica => {
        resumo += `  • ${musica}\n`;
    });

    resumo += '\n✅ Para confirmar e criar no LouveApp, responda: *!confirmar*';
    resumo += '\n❌ Para cancelar, responda: *!cancelar*';

    return resumo;
}

module.exports = {
    isEscala,
    parseEscala,
    formatarResumo,
    MAPEAMENTO_NOMES
};
