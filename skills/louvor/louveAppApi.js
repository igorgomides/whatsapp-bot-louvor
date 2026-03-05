/**
 * louveAppApi.js
 * Cliente da API do LouveApp para criar escalas automaticamente.
 * Usa chamadas HTTP diretas à API REST (api-v6.louveapp.com.br).
 */

const fs = require('fs');
const path = require('path');

// Configuração
const API_BASE = 'https://api-v6.louveapp.com.br';
const MINISTERIO_ID = '661420906edcb40008deb405';
const TOKEN_FILE = path.join(__dirname, '..', '..', '.louveapp_token');

// IDs dos membros no LouveApp
const MEMBROS = {
    'Igor Gomides': { id: '6614225acdee740008827ce7', instrumento: '5f31e5e47803d600172af726' }, // Baixo
    'Julimar Sobrinho': { id: '6617acd62e909d00077993e0', instrumento: '5f31e5fd7803d600172af728' }, // Teclado
    'Polly Gomides': { id: '66146d47b6894e0008233d45', instrumento: '5f31e5ca7803d600172af713' }, // Ministro
    'Roberta sobrinho': { id: '677de1b9870f1400080e1941', instrumento: '5f31e1d17803d600172af717' }, // Vocalista
    'Samantha Johnston': { id: '66180fbaa8bbca0008d4e51e', instrumento: '5f31e1d17803d600172af717' }, // Vocalista
    'Willians Crisanto': { id: '661c2ffcd91f260008d943e9', instrumento: '5f31e5ed7803d600172af727' }, // Bateria
    'Loys': { id: '661a77e0ff20f100087c3bb1', instrumento: '5f31e1d17803d600172af717' }, // Vocalista
    'Natali Santos': { id: null, instrumento: '5f31e1d17803d600172af717' }, // TODO: precisamos do ID
    'Natalia': { id: null, instrumento: '5f31e1d17803d600172af717' }, // TODO: precisamos do ID
};

/**
 * Extrai o campo 'device' do payload JWT (base64).
 */
function getDeviceFromToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        return payload.device || null;
    } catch (e) {
        return null;
    }
}

/**
 * Faz uma requisição HTTP usando fetch nativo do Node 18+.
 * Inclui os headers obrigatórios: Authorization, device, x-platform.
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = getToken();
    if (!token) {
        throw new Error('Token do LouveApp não encontrado. Execute !token <seu_token> para configurar.');
    }

    const device = getDeviceFromToken(token);

    const options = {
        method,
        headers: {
            'Authorization': `bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-platform': 'web',
            ...(device ? { 'device': device } : {}),
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const url = `${API_BASE}${endpoint}`;
    console.log(`🌐 API ${method} ${url}`);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok || data.error) {
        console.error('❌ Erro na API:', JSON.stringify(data, null, 2));
        throw new Error(`API Error: ${data.message || data.key || response.statusText}`);
    }

    return data;
}

// ========== TOKEN MANAGEMENT ==========

function getToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        }
    } catch (e) {
        console.error('Erro ao ler token:', e.message);
    }
    return null;
}

function saveToken(token) {
    fs.writeFileSync(TOKEN_FILE, token.trim());
    console.log('💾 Token LouveApp salvo com sucesso!');
}

/**
 * Tenta renovar o token chamando /auth/loggedIn
 */
async function refreshToken() {
    try {
        const data = await apiRequest('/auth/loggedIn');
        if (data.token) {
            saveToken(data.token);
            console.log('🔄 Token renovado com sucesso!');
            return true;
        }
    } catch (e) {
        console.error('❌ Erro ao renovar token:', e.message);
    }
    return false;
}

// ========== BUSCAR MÚSICAS ==========

/**
 * Busca músicas no repertório do ministério pelo nome.
 * A API retorna { docs: [...], total: N }
 * Cada doc tem: _id, musicaOriginal: { _id, nome, ... }
 * @param {string} termo - Nome da música (parcial ou completo)
 * @returns {Array} Lista de músicas encontradas
 */
async function buscarMusica(termo) {
    const endpoint = `/ministry/${MINISTERIO_ID}/songs?term=${encodeURIComponent(termo)}`;
    const data = await apiRequest(endpoint);
    // API retorna { docs: [...], total: N }
    return data.docs || [];
}

/**
 * Busca uma música pelo nome e retorna o ID e versão.
 * @param {string} nomeMusica
 * @returns {{ musica: string, versao: string, nome: string } | null}
 */
async function encontrarMusica(nomeMusica) {
    try {
        const resultados = await buscarMusica(nomeMusica);

        if (resultados.length > 0) {
            const doc = resultados[0];
            const musicaId = doc._id;
            const original = doc.musicaOriginal || {};
            const nome = original.nome || nomeMusica;

            // Pega a versão default, se existir
            const versaoId = original.defaultVersion?._id || null;

            console.log(`🎵 Encontrada: "${nome}" (ID: ${musicaId})`);
            return {
                musica: musicaId,
                versao: versaoId,
                nome: nome,
            };
        }

        console.log(`⚠️ Música não encontrada: "${nomeMusica}"`);
        return null;
    } catch (e) {
        console.error(`❌ Erro ao buscar música "${nomeMusica}":`, e.message);
        return null;
    }
}

// ========== CRIAR ESCALA ==========

/**
 * Cria uma escala no LouveApp.
 * @param {Object} params
 * @param {string} params.descricao - Nome/descrição do evento
 * @param {string} params.data - Data ISO do evento
 * @param {string[]} params.escalados - Nomes dos membros (como mapeados no LouveApp)
 * @param {string[]} params.musicas - Nomes das músicas para buscar
 */
async function criarEscala({ descricao, data, escalados, musicas }) {
    console.log('\n🚀 Criando escala no LouveApp...');

    // 1. Montar lista de usuários
    const usuarios = [];
    for (const nome of escalados) {
        const membro = MEMBROS[nome];
        if (membro && membro.id) {
            usuarios.push({
                usuario: membro.id,
                funcao: membro.instrumento,
                confirmada: false,
            });
            console.log(`  👤 ${nome} → ${membro.id}`);
        } else {
            console.log(`  ⚠️ Membro sem ID no sistema: ${nome}`);
        }
    }

    // 2. Buscar e montar lista de músicas
    const musicasEscala = [];
    for (const nomeMusica of musicas) {
        const musicaEncontrada = await encontrarMusica(nomeMusica);
        if (musicaEncontrada) {
            const entry = { musica: musicaEncontrada.musica };
            if (musicaEncontrada.versao) {
                entry.versao = musicaEncontrada.versao;
            }
            musicasEscala.push(entry);
        }
    }

    // 3. Montar payload
    const payload = {
        descricao: descricao || 'Culto de Domingo',
        data: data,
        usuarios: usuarios,
        musicasEscala: musicasEscala,
        ministerio: MINISTERIO_ID,
        solicitarConfirmacao: true,
        fechada: false,
        roteiro: {
            itens: musicasEscala.map(() => ({ tipo: 'musica' })),
        },
    };

    console.log('\n📦 Payload:', JSON.stringify(payload, null, 2));

    // 4. Enviar para a API
    const endpoint = `/ministry/${MINISTERIO_ID}/schedules`;
    const resultado = await apiRequest(endpoint, 'POST', payload);

    console.log('✅ Escala criada com sucesso!');
    return resultado;
}

// ========== INICIALIZAÇÃO ==========

/**
 * Inicia o refresh automático do token (a cada 12 horas).
 */
function iniciarRefreshAutomatico() {
    // Refresh a cada 12 horas
    setInterval(async () => {
        console.log('🔄 Renovando token do LouveApp...');
        await refreshToken();
    }, 12 * 60 * 60 * 1000);

    console.log('⏰ Refresh automático de token configurado (a cada 12h)');
}

module.exports = {
    saveToken,
    getToken,
    refreshToken,
    criarEscala,
    buscarMusica,
    encontrarMusica,
    iniciarRefreshAutomatico,
    MEMBROS,
};
