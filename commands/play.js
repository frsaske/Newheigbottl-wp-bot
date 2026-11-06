const { getYtAudio, cleanQuery } = require('../lib/youtube');

async function playCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = cleanQuery(rawText);

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Usage:* `.play <song name or YouTube link>`\nExample: `.play Believer Imagine Dragons`'
            }, { quoted: message });
        }

        // Send progress message
        await sock.sendMessage(chatId, {
            text: `🎵 *Searching & fetching:* _${query}_\n⏳ Please wait a moment...`
        }, { quoted: message });

        const audio = await getYtAudio(query);

        // Send cover image preview if available
        if (audio.thumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: audio.thumbnail },
                    caption: `🎶 *Title:* ${audio.title}\n⏱️ *Duration:* ${audio.duration || 'N/A'}\n👤 *Artist:* ${audio.author || 'YouTube'}`
                }, { quoted: message });
            } catch (_) {}
        }

        // Send audio
        await sock.sendMessage(chatId, {
            audio: audio.buffer,
            mimetype: 'audio/mpeg',
            fileName: audio.filename || `${audio.title}.mp3`,
            ptt: false
        }, { quoted: message });

    } catch (error) {
        console.error('Error in play command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Play Failed:* ${error?.message || 'Could not fetch song. Please try another title.'}`
        }, { quoted: message });
    }
}

module.exports = playCommand;