const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ==========================================
// 🛡️ NÍVEL 1: PROTEÇÃO GLOBAL DO PROCESSO NODE
// ==========================================
process.on('uncaughtException', (err) => console.error('⚠️ [CRÍTICO ISOLADO]', err.message));
process.on('unhandledRejection', (reason) => console.error('🧠 [REJEIÇÃO INTERCEPTADA]', reason));

const app = express();

// ==========================================
// 🛡️ NÍVEL 2: BLINDAGEM DA API (EXPRESS)
// ==========================================
app.use(helmet()); // Esconde vulnerabilidades HTTP comuns
app.use(express.json({ limit: '10kb' })); // Trava de memória: Rejeita cargas de dados grandes

// Anti-Spam: Limita a 10 pedidos por minuto vindos do mesmo servidor (Roblox)
const limiteDeUso = rateLimit({
    windowMs: 60 * 1000, 
    max: 15, 
    message: { success: false, error: "429: Rate Limit ativado. Muitas requisições, aguarde 1 minuto." }
});
app.use('/play', limiteDeUso);

// ==========================================
// 🤖 NÍVEL 3: CONFIGURAÇÃO DO BOT
// ==========================================
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const conexoesAtivas = new Map();

// ==========================================
// 📡 NÍVEL 4: ROTA DE PROCESSAMENTO
// ==========================================
app.post('/play', async (req, res) => {
    try {
        const { robloxName, musica, discordUserId } = req.body;

        // Sanitização e Validação Estrita (Regex para ID do Discord - Garante que são apenas 17-19 números)
        if (!robloxName || !musica || !discordUserId || !/^\d{17,19}$/.test(String(discordUserId))) {
            return res.status(400).json({ success: false, error: "400: Dados inválidos ou ID do Discord malformado." });
        }

        const musicaLimpa = String(musica).trim().substring(0, 100);
        const userId = String(discordUserId);
        const nomeSala = `🎧-${String(robloxName).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 12)}`; // Remove emojis/símbolos perigosos

        if (!GUILD_ID || !CATEGORY_ID) throw new Error("Variáveis de ambiente ausentes.");

        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return res.status(500).json({ success: false, error: "500: Servidor do Discord inacessível." });

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return res.status(404).json({ success: false, error: "404: Seu ID não está no servidor do Discord." });

        // Limpa conexões pendentes do usuário para evitar sobrecarga de canais
        if (conexoesAtivas.has(userId)) {
            const antiga = conexoesAtivas.get(userId);
            try {
                antiga.connection.destroy();
                antiga.channel.delete().catch(() => {});
            } catch (e) {}
            conexoesAtivas.delete(userId);
        }

        // Cria o canal com tratamento de erro
        const channel = await guild.channels.create({
            name: nomeSala,
            type: ChannelType.GuildVoice,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel] },
                { id: userId, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Speak] }
            ]
        }).catch(err => { throw { status: 403, msg: "O bot não tem permissão para criar salas." }; });

        // Conexão de voz com Timeout Inteligente (Se o Discord demorar mais de 15s, aborta em vez de travar)
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 15000);
        } catch (error) {
            connection.destroy();
            channel.delete().catch(() => {});
            return res.status(500).json({ success: false, error: "500: Falha ao estabelecer comunicação com o servidor de voz do Discord." });
        }

        // Busca e Extração Segura de Áudio (Proteção contra vídeos restritos/indisponíveis)
        const youtubeSearch = await play.search(musicaLimpa, { limit: 1 }).catch(() => null);
        if (!youtubeSearch || youtubeSearch.length === 0) {
            connection.destroy();
            channel.delete().catch(() => {});
            return res.status(404).json({ success: false, error: "404: Música não encontrada no YouTube." });
        }

        const stream = await play.stream(youtubeSearch[0].url, { quality: 1 }).catch(() => null);
        if (!stream) {
            connection.destroy();
            channel.delete().catch(() => {});
            return res.status(500).json({ success: false, error: "500: Áudio bloqueado pelo YouTube (Direitos autorais ou Idade)." });
        }

        const player = createAudioPlayer();
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        player.play(resource);
        connection.subscribe(player);

        conexoesAtivas.set(userId, { channel, connection, player });

        // 🧹 Rotina de Autolimpeza
        const limparSala = () => {
            if (conexoesAtivas.has(userId)) {
                setTimeout(() => {
                    try {
                        channel.delete().catch(() => {});
                        if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
                    } catch (e) {}
                    conexoesAtivas.delete(userId);
                }, 2000);
            }
        };

        player.on(AudioPlayerStatus.Idle, limparSala);
        player.on('error', limparSala);
        connection.on(VoiceConnectionStatus.Disconnected, limparSala);

        return res.status(200).json({ success: true, message: "Tocando no Discord!", trackName: youtubeSearch[0].title.substring(0, 40) });

    } catch (err) {
        console.error("💥 ERRO NA ROTA /PLAY:", err.message || err);
        const status = err.status || 500;
        const msg = err.msg || "Erro interno fatal no processamento da API.";
        return res.status(status).json({ success: false, error: `${status}: ${msg}` });
    }
});

// ==========================================
// 🛑 NÍVEL 5: DESLIGAMENTO SEGURO (GRACEFUL SHUTDOWN)
// ==========================================
// Se a Railway reiniciar a máquina, o bot apaga as salas abertas antes de morrer.
const desligarSistema = () => {
    console.log("⚠️ Sinal de desligamento recebido. Limpando salas fantasmas...");
    conexoesAtivas.forEach((dados) => {
        try {
            dados.channel.delete().catch(() => {});
            dados.connection.destroy();
        } catch (e) {}
    });
    setTimeout(() => process.exit(0), 3000);
};

process.on('SIGTERM', desligarSistema);
process.on('SIGINT', desligarSistema);

// ==========================================
// 🚀 INICIALIZAÇÃO
// ==========================================
const PORT = process.env.PORT || 3000;
client.login(process.env.DISCORD_TOKEN).catch(() => console.error("❌ TOKEN INVÁLIDO OU AUSENTE!"));

client.once('ready', () => {
    console.log(`🤖 [SISTEMA BLINDADO] Rádio conectada como ${client.user.tag}`);
    app.listen(PORT, () => console.log(`🌐 API operando com Helmet e Rate-Limit na porta ${PORT}`));
});
