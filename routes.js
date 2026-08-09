const crypto = require('crypto');
const express = require('express');
const dbHandler = require('./dbHandler');

const router = express.Router();
const LANGUAGES = ['en', 'ru', 'ro'];
const I18N = {
    en: {
        eventTitle: 'GoCon Voting Event', eventSubtitle: 'Choose your favorite projects and help shape the final results.', startVoting: 'Start Voting', soon: 'Soon...', votingOpen: 'Voting is open now', countdownLabel: 'Voting starts in', authPrompt: 'Please open this application inside Telegram to participate.', openTelegram: 'Open in Telegram', close: 'Close', leaderboardTitle: 'Leaderboard', resultsLocked: 'Results are not ready yet.', resultsNotReady: 'Results are not ready yet.', alreadyVoted: 'Already voted', selectOptionEach: 'Please select one option in each category before submitting.', userHello: 'Welcome', timerDays: 'Days', timerHours: 'Hours', timerMinutes: 'Minutes', timerSeconds: 'Seconds', categoryLabel: 'Select one', votingNotStarted: 'Voting will start soon', home: 'Home', submitVote: 'Submit vote', noDescription: 'No description provided yet.', telegramOnly: 'This page must be opened inside Telegram.', voteFailed: 'Vote submission failed.', topThree: 'Top 3', noVotes: 'No votes recorded yet.', votes: 'votes'
    },
    ru: {
        eventTitle: 'Голосование GoCon', eventSubtitle: 'Выберите любимые проекты и помогите сформировать итоговые результаты.', startVoting: 'Начать голосование', soon: 'Скоро...', votingOpen: 'Голосование уже открыто', countdownLabel: 'Голосование начнётся через', authPrompt: 'Пожалуйста, откройте это приложение внутри Telegram, чтобы принять участие.', openTelegram: 'Открыть в Telegram', close: 'Закрыть', leaderboardTitle: 'Лидерборд', resultsLocked: 'Результаты ещё не готовы.', resultsNotReady: 'Результаты ещё не готовы.', alreadyVoted: 'Вы уже проголосовали', selectOptionEach: 'Пожалуйста, выберите по одному варианту в каждой категории.', userHello: 'Добро пожаловать', timerDays: 'Дней', timerHours: 'Часов', timerMinutes: 'Минут', timerSeconds: 'Секунд', categoryLabel: 'Выберите один', votingNotStarted: 'Голосование скоро начнётся', home: 'Главная', submitVote: 'Отправить голос', noDescription: 'Описание пока не добавлено.', telegramOnly: 'Эта страница должна быть открыта внутри Telegram.', voteFailed: 'Не удалось отправить голос.', topThree: 'Топ 3', noVotes: 'Голоса ещё не зарегистрированы.', votes: 'голосов'
    },
    ro: {
        eventTitle: 'Votarea GoCon', eventSubtitle: 'Alege proiectele preferate și ajută la stabilirea rezultatelor finale.', startVoting: 'Începe votul', soon: 'În curând...', votingOpen: 'Votul este deschis acum', countdownLabel: 'Votul începe în', authPrompt: 'Deschide această aplicație în Telegram pentru a participa.', openTelegram: 'Deschide în Telegram', close: 'Închide', leaderboardTitle: 'Clasament', resultsLocked: 'Rezultatele nu sunt gata încă.', resultsNotReady: 'Rezultatele nu sunt gata încă.', alreadyVoted: 'Ai votat deja', selectOptionEach: 'Selectează câte o opțiune în fiecare categorie înainte de a trimite.', userHello: 'Bun venit', timerDays: 'Zile', timerHours: 'Ore', timerMinutes: 'Minute', timerSeconds: 'Secunde', categoryLabel: 'Alege unul', votingNotStarted: 'Votul va începe în curând', home: 'Acasă', submitVote: 'Trimite votul', noDescription: 'Descrierea nu este disponibilă încă.', telegramOnly: 'Această pagină trebuie deschisă în Telegram.', voteFailed: 'Trimiterea votului a eșuat.', topThree: 'Top 3', noVotes: 'Nu există voturi încă.', votes: 'voturi'
    }
};

function readCookie(req, name) {
    const entry = String(req.headers.cookie || '').split(';').find((cookie) => cookie.trim().startsWith(`${name}=`));
    return entry ? decodeURIComponent(entry.split('=').slice(1).join('=').trim()) : '';
}

function getRequestLanguage(req) {
    const requested = String(req.query.lang || readCookie(req, 'voting_lang') || '').toLowerCase();
    if (LANGUAGES.includes(requested)) return requested;
    const browserLanguage = String(req.headers['accept-language'] || '').split(',')[0].split('-')[0].toLowerCase();
    return LANGUAGES.includes(browserLanguage) ? browserLanguage : 'en';
}

function getPageContext(req) {
    const lang = getRequestLanguage(req);
    return { lang, t: I18N[lang], telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || 'your_bot_username' };
}

function renderPublic(req, res, view, model = {}) {
    const context = getPageContext(req);
    res.cookie('voting_lang', context.lang, { maxAge: 31536000000, sameSite: 'lax' });
    res.render(view, { ...context, ...model });
}

function getCountdownParts(targetTime) {
    const totalSeconds = Math.floor(Math.max(targetTime - Date.now(), 0) / 1000);
    return { days: Math.floor(totalSeconds / 86400), hours: Math.floor((totalSeconds % 86400) / 3600), minutes: Math.floor((totalSeconds % 3600) / 60), seconds: totalSeconds % 60 };
}

function verifyTelegramInitData(initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || !initData || typeof initData !== 'string') return { valid: false, error: 'Missing Telegram authentication data.' };
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDate = Number(params.get('auth_date'));
    if (!hash || !Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400) return { valid: false, error: 'Telegram authentication data is expired.' };
    const checkString = Array.from(params.entries()).filter(([key]) => key !== 'hash').sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = Buffer.from(crypto.createHmac('sha256', secret).update(checkString).digest('hex'), 'hex');
    const received = Buffer.from(hash, 'hex');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return { valid: false, error: 'Invalid Telegram signature.' };
    try {
        const user = JSON.parse(params.get('user'));
        return user && user.id ? { valid: true, user } : { valid: false, error: 'Invalid Telegram user payload.' };
    } catch {
        return { valid: false, error: 'Invalid Telegram user payload.' };
    }
}

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const adminGuard = (req, res, next) => (req.session && req.session.isAdmin ? next() : res.redirect('/admin/login'));
const uploadImage = (req, res, next) => req.app.locals.upload.single('image')(req, res, next);
const imagePath = (req) => (req.file ? `/uploads/${req.file.filename}` : '');
const categoryPath = (categoryId) => `/admin/categories/${encodeURIComponent(categoryId)}/candidates`;

router.get('/', asyncRoute(async (req, res) => {
    const settings = await dbHandler.getSettings();
    const votingOpen = settings.allowTestVoting || Date.now() >= new Date(settings.votingStartTimestamp).getTime();
    const countdown = !settings.allowTestVoting && !settings.showSoonText && !votingOpen ? getCountdownParts(new Date(settings.votingStartTimestamp).getTime()) : null;
    renderPublic(req, res, 'index', { settings, votingOpen, countdown, showSoonText: Boolean(settings.showSoonText) });
}));

router.get('/vote', asyncRoute(async (req, res) => {
    const settings = await dbHandler.getSettings();
    if (!settings.allowTestVoting && Date.now() < new Date(settings.votingStartTimestamp).getTime()) return res.status(403).render('error', { message: 'Voting is not open yet.' });
    const [categories, candidates] = await Promise.all([dbHandler.getCategories(), dbHandler.getCandidates()]);
    const byCategory = new Map();
    candidates.forEach((candidate) => byCategory.set(candidate.categoryId, [...(byCategory.get(candidate.categoryId) || []), candidate]));
    const { lang } = getPageContext(req);
    renderPublic(req, res, 'vote', { categories: categories.map((category) => ({ ...category, displayName: dbHandler.resolveLocalizedText(category.name, lang), candidates: byCategory.get(category.categoryId) || [] })) });
}));

router.get('/leaderboard', asyncRoute(async (req, res) => {
    const [settings, leaderboard] = await Promise.all([dbHandler.getSettings(), dbHandler.getLeaderboard()]);
    const showAt = new Date(settings.leaderboardShowTimestamp).getTime();
    const isLocked = !settings.allowTestLeaderboard && Date.now() < showAt;
    const { lang } = getPageContext(req);
    renderPublic(req, res, 'leaderboard', { settings, isLocked, countdown: isLocked ? getCountdownParts(showAt) : null, categoryResults: leaderboard.categoryResults.map((category) => ({ ...category, categoryName: dbHandler.resolveLocalizedText(category.name, lang) })) });
}));

router.post('/api/telegram-auth', asyncRoute(async (req, res) => {
    const verification = verifyTelegramInitData(req.body && req.body.initData);
    if (!verification.valid) return res.status(401).json({ success: false, error: verification.error });
    const user = await dbHandler.getOrCreateTelegramUser(verification.user.id, verification.user.username || verification.user.first_name, verification.user.language_code);
    res.json({ success: true, voted: Boolean(user.voted), user: { id: user.telegramId, username: user.username, languageCode: user.languageCode } });
}));

router.post('/api/telegram-vote', asyncRoute(async (req, res) => {
    const verification = verifyTelegramInitData(req.body && req.body.initData);
    if (!verification.valid) return res.status(401).json({ success: false, error: verification.error });
    const result = await dbHandler.submitTelegramVote(verification.user.id, req.body && req.body.categoryVotes, verification.user);
    res.status(result.success ? 200 : 400).json(result);
}));

router.get('/admin/login', (req, res) => {
    if (req.session && req.session.isAdmin) return res.redirect('/admin');
    return res.render('admin-settings', { ...getPageContext(req), isLoggedIn: false, errorMessage: '' });
});
router.post('/admin/login', (req, res) => {
    if (req.body.password !== (process.env.ADMIN_PASSWORD || 'admin123')) return res.status(401).render('admin-settings', { ...getPageContext(req), isLoggedIn: false, errorMessage: 'Invalid password.' });
    req.session.isAdmin = true;
    return res.redirect('/admin');
});
router.post('/admin/logout', adminGuard, (req, res) => req.session.destroy(() => res.redirect('/admin/login')));

router.get('/admin', adminGuard, asyncRoute(async (req, res) => res.render('admin-settings', { ...getPageContext(req), isLoggedIn: true, settings: await dbHandler.getSettings(), errorMessage: '' })));
router.post('/admin/settings', adminGuard, asyncRoute(async (req, res) => {
    await dbHandler.updateSettings({ votingStartTimestamp: req.body.votingStartTimestamp, leaderboardShowTimestamp: req.body.leaderboardShowTimestamp, showSoonText: req.body.showSoonText === 'on', allowTestVoting: req.body.allowTestVoting === 'on', allowTestLeaderboard: req.body.allowTestLeaderboard === 'on' });
    res.redirect('/admin');
}));

router.get('/admin/categories', adminGuard, asyncRoute(async (req, res) => res.render('admin-categories', { ...getPageContext(req), categories: await dbHandler.getCategories() })));
router.post('/admin/categories', adminGuard, uploadImage, asyncRoute(async (req, res) => {
    await dbHandler.createCategory({ name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, image: imagePath(req), order: req.body.order });
    res.redirect('/admin/categories');
}));
router.post('/admin/categories/:categoryId/update', adminGuard, uploadImage, asyncRoute(async (req, res) => {
    const payload = { name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, order: req.body.order };
    if (req.file) payload.image = imagePath(req);
    await dbHandler.updateCategory(req.params.categoryId, payload);
    res.redirect('/admin/categories');
}));
router.post('/admin/categories/:categoryId/delete', adminGuard, asyncRoute(async (req, res) => {
    await dbHandler.deleteCategory(req.params.categoryId);
    res.redirect('/admin/categories');
}));

router.get('/admin/categories/:categoryId/candidates', adminGuard, asyncRoute(async (req, res) => {
    const category = await dbHandler.getCategoryById(req.params.categoryId);
    if (!category) return res.status(404).render('error', { message: 'Category not found.' });
    return res.render('admin-candidates', { ...getPageContext(req), category, candidates: await dbHandler.getCandidatesByCategory(category.categoryId) });
}));
router.post('/admin/categories/:categoryId/candidates', adminGuard, uploadImage, asyncRoute(async (req, res) => {
    await dbHandler.createCandidate({ categoryId: req.params.categoryId, name: req.body.name, description: req.body.description, code: req.body.code, order: req.body.order, image: imagePath(req) });
    res.redirect(categoryPath(req.params.categoryId));
}));
router.post('/admin/categories/:categoryId/candidates/:candidateId/update', adminGuard, uploadImage, asyncRoute(async (req, res) => {
    const payload = { categoryId: req.params.categoryId, name: req.body.name, description: req.body.description, code: req.body.code, order: req.body.order };
    if (req.file) payload.image = imagePath(req);
    await dbHandler.updateCandidate(req.params.candidateId, payload);
    res.redirect(categoryPath(req.params.categoryId));
}));
router.post('/admin/categories/:categoryId/candidates/:candidateId/order', adminGuard, asyncRoute(async (req, res) => {
    await dbHandler.updateCandidate(req.params.candidateId, { categoryId: req.params.categoryId, order: req.body.order });
    res.redirect(categoryPath(req.params.categoryId));
}));
router.post('/admin/categories/:categoryId/candidates/:candidateId/delete', adminGuard, asyncRoute(async (req, res) => {
    await dbHandler.deleteCandidate(req.params.candidateId, req.params.categoryId);
    res.redirect(categoryPath(req.params.categoryId));
}));

module.exports = router;