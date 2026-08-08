const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const dbHandler = require('./dbHandler');

// GET / - Home Landing Page
router.get('/', (req, res) => {
    res.render('index');
});

router.get('/qr', async (req, res) => {
    try {
        const authKey = await dbHandler.createAuthKey();
        
        // Автоматически подхватит https адрес от ngrok (или localhost если локально)
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

// GET /vote
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

// POST /vote/submit
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

// GET /leaderboard
router.get('/leaderboard', async (req, res) => {
    const topCandidates = await dbHandler.getLeaderboard();
    res.render('leaderboard', { topCandidates });
});

module.exports = router;