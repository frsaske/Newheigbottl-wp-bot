const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
let downloadContentFromMessage;
try {
    downloadContentFromMessage = require('@whiskeysockets/baileys').downloadContentFromMessage;
} catch (_) {}

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

/**
 * Sanitizes JID to avoid multi-device parsing errors
 */
function cleanJid(jid) {
    if (!jid || typeof jid !== 'string') return null;
    const num = jid.split('@')[0].split(':')[0];
    const domain = jid.endsWith('@g.us') ? '@g.us' : '@s.whatsapp.net';
    return `${num}${domain}`;
}

/**
 * Retrieves buffer from quoted image, direct message image, or user profile picture
 */
async function getImageBuffer(sock, message, targetJid) {
    // 1. Quoted image
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
    }

    // 2. Direct image attached to current message
    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
    }

    // 3. User avatar
    const sanitized = cleanJid(targetJid);
    if (sanitized) {
        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(sanitized, 'image');
        } catch (_) {
            try {
                ppUrl = await sock.profilePictureUrl(sanitized, 'preview');
            } catch (_) {}
        }

        if (ppUrl) {
            try {
                const res = await fetch(ppUrl, { signal: AbortSignal.timeout(6000) });
                if (res.ok) {
                    const ab = await res.arrayBuffer();
                    return Buffer.from(ab);
                }
            } catch (_) {}
        }
    }

    // 4. Fallback generated avatar
    const letter = (targetJid || 'U').split('@')[0].charAt(0).toUpperCase() || 'U';
    const tmpFb = path.join('/tmp', `fallback_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`);
    try {
        execSync(`convert -size 512x512 gradient:"#667eea"-"#764ba2" -font "${FONT_PATH}" -pointsize 150 -fill white -gravity center -annotate +0+0 "${letter}" "${tmpFb}"`);
        const buf = fs.readFileSync(tmpFb);
        return buf;
    } finally {
        try { if (fs.existsSync(tmpFb)) fs.unlinkSync(tmpFb); } catch (_) {}
    }
}

/**
 * Applies ImageMagick filter overlay on input image buffer
 */
function applyCanvasOverlay(inputBuffer, type, username = 'User') {
    const id = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const inPath = path.join('/tmp', `misc_in_${id}.png`);
    const outPath = path.join('/tmp', `misc_out_${id}.png`);

    fs.writeFileSync(inPath, inputBuffer);

    try {
        if (type === 'gay') {
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 \\( -size 512x512 gradient:red-orange-yellow-green-blue-purple -alpha set -channel A -evaluate set 45% \\) -compose over -composite "${outPath}"`);
        } else if (type === 'heart') {
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 \\
                -fill "rgba(255, 105, 180, 0.2)" -stroke "#ff1493" -strokewidth 12 \\
                -draw "roundrectangle 16,16 496,496 32,32" \\
                -font "${FONT_PATH}" -pointsize 26 -fill "#ff1493" -gravity south \\
                -background "rgba(0,0,0,0.8)" -splice 0x60 -annotate +0+15 "💖 IN LOVE WITH YOU 💖" \\
                "${outPath}"`);
        } else if (type === 'horny') {
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 \\
                -stroke "#ff3366" -strokewidth 12 \\
                -draw "roundrectangle 16,16 496,496 32,32" \\
                -font "${FONT_PATH}" -pointsize 26 -fill "#ff3366" -gravity south \\
                -background "rgba(0,0,0,0.85)" -splice 0x60 -annotate +0+15 "🔥 CERTIFIED HORNY PASS 🔥" \\
                "${outPath}"`);
        } else if (type === 'simp') {
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 \\
                -stroke "#00e5ff" -strokewidth 12 \\
                -draw "roundrectangle 16,16 496,496 32,32" \\
                -font "${FONT_PATH}" -pointsize 26 -fill "#00e5ff" -gravity south \\
                -background "rgba(0,0,0,0.85)" -splice 0x60 -annotate +0+15 "💳 OFFICIAL SIMP CARD: @${username} 💳" \\
                "${outPath}"`);
        } else {
            // Default rounded frame
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 \\
                -stroke "#ffffff" -strokewidth 10 \\
                -draw "roundrectangle 16,16 496,496 32,32" \\
                "${outPath}"`);
        }

        return fs.readFileSync(outPath);
    } finally {
        try { if (fs.existsSync(inPath)) fs.unlinkSync(inPath); } catch (_) {}
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {}
    }
}

/**
 * Universal handler for Misc avatar effects (.heart, .horny, .gay, .simp)
 */
async function handleMiscEffect(sock, chatId, message, type) {
    try {
        const ctx = message.message?.extendedTextMessage?.contextInfo;
        const targetJid = ctx?.mentionedJid?.[0] || 
                          ctx?.participant || 
                          message.key.participant || 
                          message.key.remoteJid;

        const username = (targetJid || '').split('@')[0];

        try {
            await sock.sendPresenceUpdate('composing', chatId);
        } catch (_) {}

        const baseBuffer = await getImageBuffer(sock, message, targetJid);
        const processedBuffer = applyCanvasOverlay(baseBuffer, type, username);

        const captions = {
            heart: `💖 *Lovely Heart Filter* for @${username}`,
            horny: `🔥 *Certified Horny Pass Issued* to @${username}`,
            gay: `🌈 *Pride Rainbow Filter* for @${username}`,
            simp: `💳 *Official Simp Card Issued* to @${username}`
        };

        const caption = captions[type] || `✨ Effect for @${username}`;

        return await sock.sendMessage(chatId, {
            image: processedBuffer,
            caption,
            mentions: [targetJid]
        }, { quoted: message });

    } catch (error) {
        console.error(`Error in handleMiscEffect (${type}):`, error);
        return sock.sendMessage(chatId, {
            text: `❌ Could not process the .${type} command. Please try again!`
        }, { quoted: message });
    }
}

async function handleHeart(sock, chatId, message) {
    return handleMiscEffect(sock, chatId, message, 'heart');
}

async function handleHorny(sock, chatId, message) {
    return handleMiscEffect(sock, chatId, message, 'horny');
}

async function handleGay(sock, chatId, message) {
    return handleMiscEffect(sock, chatId, message, 'gay');
}

async function handleSimp(sock, chatId, message) {
    return handleMiscEffect(sock, chatId, message, 'simp');
}

async function miscCommand(sock, chatId, message, args) {
    const sub = (args[0] || '').toLowerCase();
    if (['heart', 'horny', 'gay', 'simp'].includes(sub)) {
        return handleMiscEffect(sock, chatId, message, sub);
    }
    return sock.sendMessage(chatId, {
        text: '╭━━━〔 ✧ *MISC COMMANDS* 〕━━━╮\n┃\n┃ ✦ *.heart [@user]* ➔ Lovely heart filter\n┃ ✦ *.horny [@user]* ➔ Certified horny pass\n┃ ✦ *.gay [@user]*   ➔ Rainbow pride overlay\n┃ ✦ *.simp [@user]*  ➔ Official simp card\n┃ ✦ *.topmembers*    ➔ Group leaderboard\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯'
    }, { quoted: message });
}

module.exports = {
    miscCommand,
    handleHeart,
    handleHorny,
    handleGay,
    handleSimp,
    handleMiscEffect
};
