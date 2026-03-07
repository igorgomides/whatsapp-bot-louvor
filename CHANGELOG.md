# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato baseia-se em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed
- **Segurança da Skill Brain:** Atualizado o arquivo `skills/brain/index.js` para garantir que o bot leia e processe apenas mensagens enviadas nos grupos permitidos (`Whatsapp Bot` e `Louvor discípulos`), ignorando quaisquer mensagens privadas (DMs) ou recebidas em outros grupos.
- **Respostas Restritas da Skill Brain:** O bot agora só enviará respostas ativas, ou permitirá comandos executivos, dentro do grupo `Whatsapp Bot`.
- **Prevenção de Auto-Resposta (Loops):** Atualizado o evento no arquivo `index.js` principal de `message_create` para `message`. Isso previne que o bot reaja a mensagens enviadas pelo próprio usuário em seus outros dispositivos logados no mesmo número.
- **Filtro de Grupo no Walmart:** Adicionado filtro de grupo na skill `walmart/index.js` para que comandos diretos, como o `!compras`, apenas tenham efeito se enviados dentro do grupo restrito do bot (`Whatsapp Bot`).

## Histórico Anterior
A maioria das funcionalidades originais, como estrutura de Hub, integração do Ollama e automação LouveApp/Walmart estão estáveis e prontas para uso.
