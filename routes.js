const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const dbHandler = require('./dbHandler');

const LANGUAGES = ['en', 'ru', 'ro'];
const I18N = {
    en: {
        eventTitle: 'GoCon Voting Event',
        eventSubtitle: 'Choose your favorite projects and help shape the final results.',
        startVoting: 'Start Voting',
        soon: 'Soon...',
        votingOpen: 'Voting is open now',
        countdownLabel: 'Voting starts in',
        authPrompt: 'Please open this application inside Telegram to participate.',
        openTelegram: 'Open in Telegram',
        close: 'Close',
        login: 'Admin Login',
        password: 'Password',
        leaderboardTitle: 'Leaderboard',
        resultsSoon: 'Results available soon',
        resultsLocked: 'Results are not ready yet.',
        resultsNotReady: 'Results are not ready yet.',
        viewHome: 'Back to home',
        loading: 'Checking access…',
        alreadyVoted: 'Already voted',
        voteSuccess: 'Vote submitted successfully',
        selectOptionEach: 'Please select one option in each category before submitting.',
        userHello: 'Hello',
        timerDays: 'Days',
        timerHours: 'Hours',
        timerMinutes: 'Minutes',
        timerSeconds: 'Seconds',
        voteNow: 'Vote now',
        categoryLabel: 'Select one',
        votingNotStarted: 'Voting will start soon'
    },
    ru: {
        eventTitle: 'Голосование GoCon',
        eventSubtitle: 'Выберите любимые проекты и помогите сформировать итоговые результаты.',
        startVoting: 'Начать голосование',
        soon: 'Скоро...',
        votingOpen: 'Голосование уже открыто',
        countdownLabel: 'Голосование начнётся через',
        authPrompt: 'Пожалуйста, откройте это приложение внутри Telegram, чтобы принять участие.',
        openTelegram: 'Открыть в Telegram',
        close: 'Закрыть',
        login: 'Вход администратора',
        password: 'Пароль',
        leaderboardTitle: 'Лидерборд',
        resultsSoon: 'Результаты скоро будут доступны',
        resultsLocked: 'Результаты ещё не готовы.',
        resultsNotReady: 'Результаты ещё не готовы.',
        viewHome: 'На главную',
        loading: 'Проверяем доступ…',
        alreadyVoted: 'Вы уже проголосовали',
        voteSuccess: 'Голос успешно отправлен',
        selectOptionEach: 'Пожалуйста, выберите по одному варианту в каждой категории.',
        userHello: 'Привет',
        timerDays: 'Дней',
        timerHours: 'Часов',
        timerMinutes: 'Минут',
        timerSeconds: 'Секунд',
        voteNow: 'Голосовать',
        categoryLabel: 'Выберите один',
        votingNotStarted: 'Голосование cкоро начнётся'
    },
    ro: {
        eventTitle: 'Votarea GoCon',
        eventSubtitle: 'Alege proiectele preferate și ajută la stabilirea rezultatelor finale.',
        startVoting: 'Începe votul',
        soon: 'În curând...',
        votingOpen: 'Votul este deschis acum',
        countdownLabel: 'Votul începe în',
        authPrompt: 'Deschide această aplicație în Telegram pentru a participa.',
        openTelegram: 'Deschide în Telegram',
        close: 'Închide',
        login: 'Autentificare administrator',
        password: 'Parolă',
        leaderboardTitle: 'Clasament',
        resultsSoon: 'Rezultatele vor fi disponibile în curând',
        resultsLocked: 'Rezultatele nu sunt gata încă.',
        resultsNotReady: 'Rezultatele nu sunt gata încă.',
        viewHome: 'Înapoi acasă',
        loading: 'Verificăm accesul…',
        alreadyVoted: 'Ați votat deja',
        voteSuccess: 'Votul a fost trimis cu succes',
        selectOptionEach: 'Selectează câte o opțiune în fiecare categorie înainte de a trimite.',
        userHello: 'Salut',
        timerDays: 'Zile',
        timerHours: 'Ore',
        timerMinutes: 'Minute',
        timerSeconds: 'Secunde',
        voteNow: 'Votează acum',
        categoryLabel: 'Alege unul',
        votingNotStarted: 'Votul va începe în curând'
    }
};

function getRequestLanguage(req) {
    const value = String(req.query.lang || req.headers['x-language'] || '').trim().toLowerCase();
    if (LANGUAGES.includes(value)) {
        return value;
    }

    const acceptLanguage = String(req.headers['accept-language'] || '').split(',')[0].split('-')[0].trim().toLowerCase();
    if (LANGUAGES.includes(acceptLanguage)) {
        return acceptLanguage;
    }

    return 'en';
}

function getPageContext(req) {
    const lang = getRequestLanguage(req);
    return {
        lang,
        t: I18N[lang] || I18N.en,
        telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || 'your_bot_username'
    };
}

function getCountdownParts(targetTime) {
    const distance = Math.max(targetTime - Date.now(), 0);
    const totalSeconds = Math.floor(distance / 1000);
    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds, totalSeconds };
}

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

const adminGuard = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.redirect('/admin/login');
};

const applyUploadMiddleware = (req, res, next) => {
    const upload = req.app && req.app.locals && req.app.locals.upload;
    if (!upload) {
        return next();
    }
    return upload.single('image')(req, res, next);
};

router.get('/', async (req, res) => {
    const settings = await dbHandler.getSettings();
    const langContext = getPageContext(req);
    const startTimestamp = new Date(settings.votingStartTimestamp).getTime();
    const votingOpen = settings.allowTestVoting === true || Date.now() >= startTimestamp;
    const countdown = !settings.allowTestVoting && !settings.showSoonText && !votingOpen ? getCountdownParts(startTimestamp) : null;

    res.render('index', {
        ...langContext,
        settings,
        countdown,
        showSoonText: Boolean(settings.showSoonText),
        votingOpen
    });
});

router.get('/vote', async (req, res) => {
    const langContext = getPageContext(req);
    const settings = await dbHandler.getSettings();
    const categories = await dbHandler.getCategories();
    const categoryIds = categories.map((category) => category.categoryId);
    const candidates = await dbHandler.getCandidates();

    const votingStatus = settings.allowTestVoting === true ? { allowed: true } : { allowed: Date.now() >= new Date(settings.votingStartTimestamp).getTime() };
    if (!votingStatus.allowed) {
        return res.render('error', { message: 'Voting is not open yet. Please wait for the event start.' });
    }

    const mappedCategories = categories.map((category) => ({
        ...category,
        displayName: dbHandler.resolveLocalizedText(category.name, langContext.lang),
        candidates: candidates.filter((candidate) => candidate.categoryId === category.categoryId).sort((a, b) => (a.order || 0) - (b.order || 0))
    }));

    if (!categoryIds.length) {
        return res.render('vote', { ...langContext, categories: [], message: 'No categories have been configured yet.' });
    }

    res.render('vote', { ...langContext, categories: mappedCategories });
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
            verification.user.username || verification.user.first_name || 'telegram_user',
            verification.user.language_code || 'en'
        );

        return res.json({
            success: true,
            voted: !!user.voted,
            user: {
                id: user.telegramId,
                username: user.username,
                voted: !!user.voted,
                languageCode: user.languageCode || 'en'
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

        const user = await dbHandler.getOrCreateTelegramUser(
            verification.user.id,
            verification.user.username || verification.user.first_name || 'telegram_user',
            verification.user.language_code || 'en'
        );

        const result = await dbHandler.submitTelegramVote(user.telegramId, categoryVotes, verification.user);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }

        return res.json({ success: true, voted: true, user: result.user });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/leaderboard', async (req, res) => {
    const langContext = getPageContext(req);
    const settings = await dbHandler.getSettings();
    const leaderboard = await dbHandler.getLeaderboard();
    const leaderBoardShowTimestamp = new Date(settings.leaderboardShowTimestamp).getTime();
    const leaderboardOpen = settings.allowTestLeaderboard === true || Date.now() >= leaderBoardShowTimestamp;
    const isLocked = !leaderboardOpen;

    const countdown = isLocked ? getCountdownParts(leaderBoardShowTimestamp) : null;

    res.render('leaderboard', {
        ...langContext,
        settings,
        countdown,
        isLocked,
        leaderboardOpen,
        categoryResults: leaderboard.categoryResults || []
    });
});

router.get('/admin/login', async (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.redirect('/admin');
    }

    const langContext = getPageContext(req);
    res.render('admin', { ...langContext, isLoggedIn: false, settings: await dbHandler.getSettings(), categories: await dbHandler.getCategories(), candidates: await dbHandler.getCandidates(), errorMessage: '' });
});

router.post('/admin/login', async (req, res) => {
    const { password } = req.body || {};
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!password || password !== expectedPassword) {
        const langContext = getPageContext(req);
        return res.status(401).render('admin', {
            ...langContext,
            isLoggedIn: false,
            settings: await dbHandler.getSettings(),
            categories: await dbHandler.getCategories(),
            candidates: await dbHandler.getCandidates(),
            errorMessage: 'Invalid password.'
        });
    }

    req.session.isAdmin = true;
    res.redirect('/admin');
});

router.post('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
});

router.get('/admin', adminGuard, async (req, res) => {
    const langContext = getPageContext(req);
    const [settings, categories, candidates] = await Promise.all([
        dbHandler.getSettings(),
        dbHandler.getCategories(),
        dbHandler.getCandidates()
    ]);

    res.render('admin', {
        ...langContext,
        isLoggedIn: true,
        settings,
        categories,
        candidates,
        errorMessage: ''
    });
});

router.post('/admin/settings', adminGuard, async (req, res) => {
    try {
        const payload = {
            allowTestVoting: req.body.allowTestVoting === 'on',
            allowTestLeaderboard: req.body.allowTestLeaderboard === 'on',
            showSoonText: req.body.showSoonText === 'on',
            votingStartTimestamp: req.body.votingStartTimestamp,
            leaderboardShowTimestamp: req.body.leaderboardShowTimestamp
        };

        await dbHandler.updateSettings(payload);
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send(`Unable to update settings: ${error.message}`);
    }
});

router.post('/admin/categories', adminGuard, applyUploadMiddleware, async (req, res) => {
    const categoryImage = req.file || null;
    const name = {
        en: req.body.nameEn || '',
        ru: req.body.nameRu || '',
        ro: req.body.nameRo || ''
    };

    const result = await dbHandler.createCategory({
        categoryId: req.body.categoryId || `cat_${Date.now()}`,
        name,
        image: categoryImage ? `/uploads/${categoryImage.filename}` : (req.body.imageUrl || ''),
        order: Number(req.body.order || 0)
    });

    if (!result) {
        return res.status(400).send('Unable to create category');
    }

    res.redirect('/admin');
});

router.post('/admin/categories/:id/update', adminGuard, applyUploadMiddleware, async (req, res) => {
    const categoryId = req.params.id;
    const categoryImage = req.file || null;
    const name = {
        en: req.body.nameEn || '',
        ru: req.body.nameRu || '',
        ro: req.body.nameRo || ''
    };

    await dbHandler.updateCategory(categoryId, {
        name,
        image: categoryImage ? `/uploads/${categoryImage.filename}` : (req.body.imageUrl || ''),
        order: Number(req.body.order || 0)
    });

    res.redirect('/admin');
});

router.post('/admin/categories/:id/delete', adminGuard, async (req, res) => {
    await dbHandler.deleteCategory(req.params.id);
    res.redirect('/admin');
});

router.post('/admin/candidates', adminGuard, applyUploadMiddleware, async (req, res) => {
    const candidateImage = req.file || null;
    const payload = {
        candidateId: req.body.candidateId || `candidate_${Date.now()}`,
        categoryId: req.body.categoryId || '',
        name: req.body.name || '',
        description: req.body.description || '',
        code: req.body.code || '',
        order: Number(req.body.order || 0),
        image: candidateImage ? `/uploads/${candidateImage.filename}` : (req.body.imageUrl || '')
    };

    await dbHandler.createCandidate(payload);
    res.redirect('/admin');
});

router.post('/admin/candidates/:candidateId/:categoryId/update', adminGuard, applyUploadMiddleware, async (req, res) => {
    const candidateId = req.params.candidateId;
    const categoryId = req.params.categoryId;
    const candidateImage = req.file || null;
    await dbHandler.updateCandidate(candidateId, {
        categoryId,
        name: req.body.name || '',
        description: req.body.description || '',
        code: req.body.code || '',
        image: candidateImage ? `/uploads/${candidateImage.filename}` : (req.body.imageUrl || ''),
        order: Number(req.body.order || 0)
    });
    res.redirect('/admin');
});

router.post('/admin/candidates/:candidateId/:categoryId/delete', adminGuard, async (req, res) => {
    await dbHandler.deleteCandidate(req.params.candidateId, req.params.categoryId);
    res.redirect('/admin');
});

module.exports = router;