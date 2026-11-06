const { getYtAudio, cleanQuery } = require('../lib/youtube');

async function songCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = cleanQuery(rawText);

        if (!query) {
            await sock.sendMessage(chatId, {
                text: '❌ *Usage:* `.song <song name or YouTube link>`\nExample: `.song Faded Alan Walker`'
            }, { quoted: message });
            return;
        }

        // Inform user that download is in progress
        await sock.sendMessage(chatId, {
            text: `🔎 *Searching & downloading audio:* _${query}_\n⏳ Please wait...`
        }, { quoted: message });

        const audio = await getYtAudio(query);

        // Send audio directly to chat
        await sock.sendMessage(chatId, {
            audio: audio.buffer,
            mimetype: 'audio/mpeg',
            fileName: audio.filename || `${audio.title}.mp3`,
            ptt: false
        }, { quoted: message });

    } catch (err) {
        console.error('Song command error:', err);
        const errMsg = err?.message || 'Download failed. Please try again later.';
        await sock.sendMessage(chatId, {
            text: `❌ *Audio Download Failed:* ${errMsg}`
        }, { quoted: message });
    }
}

module.exports = songCommand;