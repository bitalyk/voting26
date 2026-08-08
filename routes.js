const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const dbHandler = require('./dbHandler');

function verifyTelegramInitData(initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        return { valid: false, error: 'Telegram bot token is not configured on the server.' };
    }

    if (!initData || typeof initData !== 'string') {
        return { valid: false, error: 'Missing Telegram init data.' };
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDate = Number(params.get('auth_date') || 0);

    if (!hash) {
        return { valid: false, error: 'Telegram hash missing.' };
    }

    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400) {
        return { valid: false, error: 'Telegram init data is expired.' };
    }

    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

    const dataCheck = [];

    for (const [key, value] of Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        if (key === 'hash') continue;
        dataCheck.push(`${key}=${value}`);
    }

    const checkString = dataCheck.join('\n');
    const expectedHash = crypto
        .createHmac('sha256', secretKey)
        .update(checkString)
        .digest('hex');

    const providedHash = hash.trim();
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const providedBuffer = Buffer.from(providedHash, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
        return { valid: false, error: 'Invalid Telegram signature.' };
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, providedBuffer);

    if (!isValid) {
        return { valid: false, error: 'Invalid Telegram signature.' };
    }

    const userString = params.get('user');
    if (!userString) {
        return { valid: false, error: 'Telegram user payload missing.' };
    }

    try {
        const user = JSON.parse(userString);
        if (!user || !user.id) {
            return { valid: false, error: 'Invalid Telegram user payload.' };
        }
        return { valid: true, user };
    } catch (error) {
        return { valid: false, error: 'Unable to parse Telegram user payload.' };
    }
}

router.get('/', async (req, res) => {
    const candidates = await dbHandler.getCandidates();
    const categories = {
        1: { name: 'Best Innovation', items: candidates.filter(c => c.categoryId === 1) },
        2: { name: 'Best Design', items: candidates.filter(c => c.categoryId === 2) },
        3: { name: 'People\'s Choice', items: candidates.filter(c => c.categoryId === 3) }
    };

    res.render('index', { categories });
});

router.get('/qr', async (req, res) => {
    try {
        const authKey = await dbHandler.createAuthKey();

        const host = req.get('x-forwarded-host') || req.get('host');
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const voteUrl = `${protocol}://${host}/vote?key=${authKey}`;
        const qrCodeDataUrl = await QRCode.toDataURL(voteUrl);

        res.render('qr', {
            authKey,
            voteUrl,
            qrCodeDataUrl
        });
    } catch (err) {
        res.status(500).send('Error generating QR code: ' + err.message);
    }
});

router.get('/vote', async (req, res) => {
    const { key } = req.query;

    if (!key) {
        return res.render('error', { message: 'Missing authentication key in URL parameters.' });
    }

    const keyStatus = await dbHandler.getAuthKeyStatus(key);

    if (!keyStatus.valid) {
        return res.render('error', { message: 'Invalid authentication key.' });
    }

    if (keyStatus.voted) {
        return res.render('error', { message: 'You have already voted using this key.' });
    }

    const candidates = await dbHandler.getCandidates();

    const categories = {
        1: { name: 'Best Innovation', items: candidates.filter(c => c.categoryId === 1) },
        2: { name: 'Best Design', items: candidates.filter(c => c.categoryId === 2) },
        3: { name: 'People\'s Choice', items: candidates.filter(c => c.categoryId === 3) }
    };

    res.render('vote', { key, categories });
});

router.post('/vote/submit', async (req, res) => {
    const { key, cat1, cat2, cat3 } = req.body;

    if (!key || !cat1 || !cat2 || !cat3) {
        return res.render('error', { message: 'Please select one candidate in every category.' });
    }

    const result = await dbHandler.submitVote(key, { cat1, cat2, cat3 });

    if (!result.success) {
        return res.render('error', { message: result.error });
    }

    res.render('success');
});

router.post('/api/telegram-auth', async (req, res) => {
    try {
        const initData = req.body && req.body.initData;
        const verification = verifyTelegramInitData(initData);

        if (!verification.valid) {
            return res.status(401).json({ success: false, error: verification.error });
        }

        const user = await dbHandler.getOrCreateTelegramUser(
            verification.user.id,
            verification.user.username || verification.user.first_name || 'telegram_user'
        );

        return res.json({
            success: true,
            voted: !!user.voted,
            user: {
                id: user.telegramId,
                username: user.username,
                voted: !!user.voted
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/telegram-vote', async (req, res) => {
    try {
        const { initData, categoryVotes } = req.body || {};
        const verification = verifyTelegramInitData(initData);

        if (!verification.valid) {
            return res.status(401).json({ success: false, error: verification.error });
        }

        if (!categoryVotes || typeof categoryVotes !== 'object') {
            return res.status(400).json({ success: false, error: 'Missing telegram vote payload.' });
        }

        const result = await dbHandler.submitTelegramVote(verification.user.id, categoryVotes);

        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }

        return res.json({ success: true, voted: true, user: result.user });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/leaderboard', async (req, res) => {
    const topCandidates = await dbHandler.getLeaderboard();
    res.render('leaderboard', { topCandidates });
});

module.exports = router;