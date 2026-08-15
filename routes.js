const crypto = require('crypto');
const express = require('express');
const dbHandler = require('./dbHandler');

const router = express.Router();
const LANGUAGES = ['en', 'ru', 'ro'];
const BASE = {
    eventTitle: 'GoCon Voting Event', eventSubtitle: 'Choose your favorite projects and help shape the final results.', eventLabel: 'Event', startVoting: 'Start Voting', soon: 'Soon...', votingOpen: 'Voting is open now', countdownLabel: 'Voting starts in', notifyWhenVotingStarts: 'Notify me when voting starts', authPrompt: 'Please open this application inside Telegram to participate.', openTelegram: 'Open in Telegram', close: 'Close', leaderboardTitle: 'Leaderboard', resultsLabel: 'Results', resultsLocked: 'Results are not ready yet.', resultsNotReady: 'Results are not ready yet.', alreadyVoted: 'Already voted', selectOptionEach: 'Please select one option in each category before submitting.', userHello: 'Welcome', timerDays: 'Days', timerHours: 'Hours', timerMinutes: 'Minutes', timerSeconds: 'Seconds', categoryLabel: 'Select one', votingNotStarted: 'Voting will start soon', home: 'Home', submitVote: 'Submit vote', voteNow: 'Vote now', noDescription: 'No description provided yet.', telegramOnly: 'This page must be opened inside Telegram.', voteFailed: 'Vote submission failed.', topThree: 'Top 3', noVotes: 'No votes recorded yet.', votes: 'votes', prizeWheel: 'Prize Wheel', prize: 'Prize', noPrizesAvailable: 'There are no prizes available right now.', spin: 'Spin', selectingPrizes: 'Selecting prizes...', spinning: 'Spinning...', telegramSpinOnly: 'Open this page inside Telegram to spin.', prizeWon: 'Prize won', yourPrizes: 'Your prizes', claimPrize: 'Close / Claim', youWon: 'You won', language: 'Language', accessDenied: 'Access denied', notice: 'Notice', viewLeaderboard: 'View Leaderboard', categoryProgress: 'Category {current} of {total}', previousCategory: 'Previous Category', nextCategory: 'Next Category', reviewSubmit: 'Review & Submit Vote', youVoted: 'You Voted:', confirmVote: 'Confirm & Vote', discard: 'Discard / Edit', interactiveMap: 'Interactive Map', mapSelector: 'Map', legend: 'Legend', noEventMaps: 'No event maps available yet.', schedule: 'Live schedule', currentEvent: 'Current event', nextEvent: 'Next event', noCurrentEvent: 'No event is currently active.', noNextEvent: 'No upcoming events.', notifyWhenEventsStart: 'Notify me when events start', notificationUnavailable: 'Open in Telegram to enable notifications.'
};
const I18N = {
    en: BASE,
    ru: { ...BASE, eventTitle: 'Голосование GoCon', eventSubtitle: 'Выберите любимые проекты и помогите определить итоговые результаты.', eventLabel: 'Событие', startVoting: 'Начать голосование', soon: 'Скоро...', votingOpen: 'Голосование открыто', countdownLabel: 'Голосование начнётся через', authPrompt: 'Чтобы участвовать, откройте приложение в Telegram.', openTelegram: 'Открыть в Telegram', close: 'Закрыть', leaderboardTitle: 'Лидерборд', resultsLabel: 'Результаты', resultsLocked: 'Результаты пока недоступны.', resultsNotReady: 'Результаты пока не готовы.', alreadyVoted: 'Вы уже проголосовали', selectOptionEach: 'Выберите по одному варианту в каждой категории перед отправкой.', userHello: 'Добро пожаловать', timerDays: 'Дни', timerHours: 'Часы', timerMinutes: 'Минуты', timerSeconds: 'Секунды', categoryLabel: 'Выберите один вариант', votingNotStarted: 'Голосование скоро начнётся', home: 'Главная', submitVote: 'Отправить голос', voteNow: 'Голосовать', noDescription: 'Описание пока не добавлено.', telegramOnly: 'Эту страницу нужно открыть в Telegram.', voteFailed: 'Не удалось отправить голос.', topThree: 'Топ-3', noVotes: 'Голосов пока нет.', votes: 'голосов', prizeWheel: 'Колесо призов', prize: 'Приз', noPrizesAvailable: 'Сейчас нет доступных призов.', spin: 'Крутить', selectingPrizes: 'Выбираем призы...', spinning: 'Крутится...', telegramSpinOnly: 'Откройте эту страницу в Telegram, чтобы крутить колесо.', prizeWon: 'Приз получен', yourPrizes: 'Ваши призы', claimPrize: 'Закрыть / Получить', youWon: 'Вы выиграли', language: 'Язык', accessDenied: 'Доступ запрещён', notice: 'Уведомление', viewLeaderboard: 'Открыть лидерборд', categoryProgress: 'Категория {current} из {total}', previousCategory: 'Предыдущая категория', nextCategory: 'Следующая категория', reviewSubmit: 'Проверить и отправить голос', youVoted: 'Вы проголосовали:', confirmVote: 'Подтвердить голос', discard: 'Изменить выбор', interactiveMap: 'Интерактивная карта', mapSelector: 'Карта', legend: 'Легенда', noEventMaps: 'Карты событий пока нет.', schedule: 'Расписание', currentEvent: 'Сейчас', nextEvent: 'Далее', noCurrentEvent: 'Сейчас нет активного события.', noNextEvent: 'Ближайших событий нет.', notifyWhenEventsStart: 'Уведомлять о начале событий', notificationUnavailable: 'Откройте приложение в Telegram, чтобы включить уведомления.' },
    ro: { ...BASE, eventTitle: 'Votarea GoCon', eventSubtitle: 'Alege proiectele preferate și ajută la stabilirea rezultatelor finale.', eventLabel: 'Eveniment', startVoting: 'Începe votul', soon: 'În curând...', votingOpen: 'Votarea este deschisă', countdownLabel: 'Votarea începe în', authPrompt: 'Deschide această aplicație în Telegram pentru a participa.', openTelegram: 'Deschide în Telegram', close: 'Închide', leaderboardTitle: 'Clasament', resultsLabel: 'Rezultate', resultsLocked: 'Rezultatele nu sunt încă disponibile.', resultsNotReady: 'Rezultatele nu sunt încă pregătite.', alreadyVoted: 'Ai votat deja', selectOptionEach: 'Selectează o opțiune din fiecare categorie înainte de trimitere.', userHello: 'Bine ai venit', timerDays: 'Zile', timerHours: 'Ore', timerMinutes: 'Minute', timerSeconds: 'Secunde', categoryLabel: 'Selectează o opțiune', votingNotStarted: 'Votarea va începe în curând', home: 'Acasă', submitVote: 'Trimite votul', voteNow: 'Votează', noDescription: 'Nu a fost adăugată încă o descriere.', telegramOnly: 'Această pagină trebuie deschisă în Telegram.', voteFailed: 'Trimiterea votului a eșuat.', topThree: 'Top 3', noVotes: 'Nu sunt încă voturi înregistrate.', votes: 'voturi', prizeWheel: 'Roata premiilor', prize: 'Premiu', noPrizesAvailable: 'Nu sunt premii disponibile momentan.', spin: 'Învârte', selectingPrizes: 'Se selectează premiile...', spinning: 'Se învârte...', telegramSpinOnly: 'Deschide această pagină în Telegram pentru a învârti roata.', prizeWon: 'Premiu câștigat', yourPrizes: 'Premiile tale', claimPrize: 'Închide / Ridică premiul', youWon: 'Ai câștigat', language: 'Limbă', accessDenied: 'Acces interzis', notice: 'Notificare', viewLeaderboard: 'Vezi clasamentul', categoryProgress: 'Categoria {current} din {total}', previousCategory: 'Categoria anterioară', nextCategory: 'Următoarea categorie', reviewSubmit: 'Verifică și trimite votul', youVoted: 'Ai votat:', confirmVote: 'Confirmă votul', discard: 'Modifică alegerea', interactiveMap: 'Hartă interactivă', mapSelector: 'Hartă', legend: 'Legendă', noEventMaps: 'Nu există hărți de evenimente încă.', schedule: 'Program live', currentEvent: 'Eveniment curent', nextEvent: 'Următorul eveniment', noCurrentEvent: 'Nu există un eveniment activ.', noNextEvent: 'Nu există evenimente viitoare.', notifyWhenEventsStart: 'Anunță-mă când încep evenimentele', notificationUnavailable: 'Deschide aplicația în Telegram pentru a activa notificările.' }
};

I18N.ru.notifyWhenVotingStarts = 'Уведомить о начале голосования';
I18N.ro.notifyWhenVotingStarts = 'Anunță-mă când începe votarea';
Object.assign(I18N.en, { vote: 'Vote', voted: 'Voted', selectCategory: 'Select Category', watchVideo: 'Watch Video', videoUnavailable: 'Video Unavailable', fileTooLarge: 'File size too large (Max 5MB)', unsupportedFileFormat: 'Unsupported file format' });
Object.assign(I18N.ru, { vote: 'Голосовать', voted: 'Проголосовано', selectCategory: 'Выберите категорию', watchVideo: 'Смотреть видео', videoUnavailable: 'Видео недоступно', fileTooLarge: 'Размер файла слишком большой (макс. 5 МБ)', unsupportedFileFormat: 'Неподдерживаемый формат файла' });
Object.assign(I18N.ro, { vote: 'Votează', voted: 'Votat', selectCategory: 'Selectează categoria', watchVideo: 'Vezi video', videoUnavailable: 'Videoclip indisponibil', fileTooLarge: 'Fișierul este prea mare (max. 5 MB)', unsupportedFileFormat: 'Format de fișier neacceptat' });

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
    const expected = Buffer.from(crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()).update(checkString).digest('hex'), 'hex');
    const received = Buffer.from(hash, 'hex');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return { valid: false, error: 'Invalid Telegram signature.' };
    try { const user = JSON.parse(params.get('user')); return user && user.id ? { valid: true, user } : { valid: false, error: 'Invalid Telegram user payload.' }; } catch { return { valid: false, error: 'Invalid Telegram user payload.' }; }
}

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const adminGuard = (req, res, next) => (req.session && req.session.isAdmin ? next() : res.redirect('/admin/login'));
const adminMutationGuard = (req, res, next) => {
    if (!req.session || !req.session.isAdmin) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    return next();
};
const uploadImage = (req, res, next) => req.app.locals.upload.single('image')(req, res, next);
const uploadFavicon = (req, res, next) => req.app.locals.faviconUpload.single('favicon')(req, res, next);
const imagePath = (req) => (req.file ? `/uploads/${req.file.filename}` : '');
const categoryPath = (categoryId) => `/admin/categories/${encodeURIComponent(categoryId)}/candidates`;

function participantVideoUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Invalid protocol');
        return parsed.toString();
    } catch {
        throw new Error('Participant video URL must be a valid HTTP or HTTPS URL.');
    }
}

function visibleLocalizedPanels(layout, lang) {
    return (layout || []).filter((panel) => panel.visible).sort((left, right) => left.order - right.order).map((panel) => ({
        ...panel,
        displayBrand: dbHandler.resolveLocalizedText(panel.brand, lang) || 'GoCon',
        displayTitle: dbHandler.resolveLocalizedText(panel.title, lang),
        displayDescription: dbHandler.resolveLocalizedText(panel.description, lang)
    }));
}

function layoutPayloadFromForm(layout, body = {}) {
    return (layout || []).map((panel) => {
        const key = panel.panelId;
        return {
            panelId: key,
            visible: body[`visible_${key}`] === 'on',
            order: body[`order_${key}`],
            brand: key === 'header' ? { en: body.headerBrandEn, ru: body.headerBrandRu, ro: body.headerBrandRo } : panel.brand,
            title: { en: body[`${key}TitleEn`], ru: body[`${key}TitleRu`], ro: body[`${key}TitleRo`] },
            description: { en: body[`${key}DescriptionEn`], ru: body[`${key}DescriptionRu`], ro: body[`${key}DescriptionRo`] }
        };
    });
}

router.get('/', asyncRoute(async (req, res) => {
    const [settings, scheduleEvents, siteConfig] = await Promise.all([dbHandler.getSettings(), dbHandler.getScheduleEvents(), dbHandler.getSiteConfig()]);
    const votingOpen = settings.allowTestVoting || Date.now() >= new Date(settings.votingStartTimestamp).getTime();
    const countdown = !settings.allowTestVoting && !settings.showSoonText && !votingOpen ? getCountdownParts(new Date(settings.votingStartTimestamp).getTime()) : null;
    const { lang } = getPageContext(req);
    renderPublic(req, res, 'index', { settings, scheduleEvents, votingOpen, countdown, showSoonText: Boolean(settings.showSoonText), siteConfig, mainPagePanels: visibleLocalizedPanels(siteConfig.mainPageLayout, lang) });
}));
router.get('/map', asyncRoute(async (req, res) => {
    const [maps, eventTypes, markerCategories] = await Promise.all([dbHandler.getPublicMaps(), dbHandler.getMapEventTypes(), dbHandler.getMarkerCategories()]);
    renderPublic(req, res, 'map', { maps, eventTypes, markerCategories });
}));
router.get('/vote', asyncRoute(async (req, res) => {
    const settings = await dbHandler.getSettings();
    if (!settings.allowTestVoting && Date.now() < new Date(settings.votingStartTimestamp).getTime()) return res.status(403).render('error', { ...getPageContext(req), message: getPageContext(req).t.votingNotStarted });
    const categories = await dbHandler.getCategories();
    const telegramId = req.session && req.session.telegramUserId;
    const status = telegramId ? await dbHandler.getTelegramUserStatus(telegramId) : null;
    const votedCategories = new Set(status && status.valid ? status.data.votedCategories || [] : []);
    const legacyVoter = Boolean(status && status.valid && status.data.voted);
    const { lang } = getPageContext(req);
    renderPublic(req, res, 'vote', { categories: categories.map((category) => ({ ...category, displayName: dbHandler.resolveLocalizedText(category.name, lang), displayDescription: dbHandler.resolveLocalizedText(category.description, lang), hasVoted: legacyVoter || votedCategories.has(category.categoryId) })) });
}));
router.get('/vote/category/:categoryId', asyncRoute(async (req, res) => {
    const settings = await dbHandler.getSettings();
    if (!settings.allowTestVoting && Date.now() < new Date(settings.votingStartTimestamp).getTime()) return res.status(403).render('error', { ...getPageContext(req), message: getPageContext(req).t.votingNotStarted });
    const category = await dbHandler.getCategoryById(req.params.categoryId);
    if (!category) return res.status(404).render('error', { ...getPageContext(req), message: 'Category not found.' });
    const telegramId = req.session && req.session.telegramUserId;
    const status = telegramId ? await dbHandler.getTelegramUserStatus(telegramId) : null;
    const hasVoted = Boolean(status && status.valid && (status.data.voted || (status.data.votedCategories || []).includes(category.categoryId)));
    const { lang } = getPageContext(req);
    return renderPublic(req, res, 'category-candidates', { category: { ...category, displayName: dbHandler.resolveLocalizedText(category.name, lang), displayDescription: dbHandler.resolveLocalizedText(category.description, lang) }, candidates: await dbHandler.getCandidatesByCategory(category.categoryId), hasVoted });
}));
router.get('/leaderboard', asyncRoute(async (req, res) => {
    const [settings, leaderboard, siteConfig] = await Promise.all([dbHandler.getSettings(), dbHandler.getLeaderboard(), dbHandler.getSiteConfig()]);
    const showAt = new Date(settings.leaderboardShowTimestamp).getTime(); const isLocked = !settings.allowTestLeaderboard && Date.now() < showAt; const { lang } = getPageContext(req);
    renderPublic(req, res, 'leaderboard', { settings, siteConfig, leaderboardPanels: visibleLocalizedPanels(siteConfig.leaderboardLayout, lang), isLocked, countdown: isLocked ? getCountdownParts(showAt) : null, categoryResults: leaderboard.categoryResults.map((category) => ({ ...category, categoryName: dbHandler.resolveLocalizedText(category.name, lang) })) });
}));
router.get('/prizes', asyncRoute(async (req, res) => {
    const telegramId = req.session && req.session.telegramUserId;
    if (!telegramId) return res.status(403).render('error', { ...getPageContext(req), message: getPageContext(req).t.telegramSpinOnly });
    const status = await dbHandler.getTelegramUserStatus(telegramId);
    if (!status.valid || !status.data.allowedPrizes) return res.status(403).render('error', { ...getPageContext(req), message: getPageContext(req).t.accessDenied });
    const { lang } = getPageContext(req); renderPublic(req, res, 'prizes', { prizes: (await dbHandler.getActivePrizes()).map((prize) => ({ ...prize, displayName: dbHandler.resolveLocalizedText(prize.name, lang) })) });
}));
router.get('/api/schedule', asyncRoute(async (_req, res) => res.json({ success: true, events: await dbHandler.getScheduleEvents(), serverTime: new Date().toISOString() })));
router.post('/api/telegram-auth', asyncRoute(async (req, res) => {
    const verification = verifyTelegramInitData(req.body && req.body.initData); if (!verification.valid) return res.status(401).json({ success: false, error: verification.error });
    const user = await dbHandler.getOrCreateTelegramUser(verification.user.id, verification.user.username || verification.user.first_name, verification.user.language_code); req.session.telegramUserId = user.telegramId;
    return res.json({ success: true, voted: Boolean(user.voted), votedCategories: user.votedCategories || [], allowedPrizes: Boolean(user.allowedPrizes), scheduleNotificationsEnabled: Boolean(user.scheduleNotificationsEnabled), votingStartNotificationsEnabled: Boolean(user.votingStartNotificationsEnabled), user: { id: user.telegramId, username: user.username, languageCode: user.languageCode } });
}));
router.post('/api/user/language', asyncRoute(async (req, res) => {
    const verification = verifyTelegramInitData(req.body && req.body.initData);
    if (!verification.valid) return res.status(401).json({ success: false, error: verification.error });
    const user = await dbHandler.getOrCreateTelegramUser(verification.user.id, verification.user.username || verification.user.first_name, verification.user.language_code);
    const updatedUser = await dbHandler.updateTelegramUserLanguage(user.telegramId, req.body && req.body.languageCode);
    return res.json({ success: true, languageCode: updatedUser ? updatedUser.languageCode : 'en' });
}));
router.post('/api/user/toggle-notifications', asyncRoute(async (req, res) => {
    const verification = verifyTelegramInitData(req.body && req.body.initData);
    if (!verification.valid) return res.status(401).json({ success: false, error: verification.error });
    const user = await dbHandler.getOrCreateTelegramUser(verification.user.id, verification.user.username || verification.user.first_name, verification.user.language_code);
    const updatedUser = await dbHandler.updateScheduleNotifications(user.telegramId, req.body && req.body.enabled === true);
    return res.json({ success: true, scheduleNotificationsEnabled: Boolean(updatedUser && updatedUser.scheduleNotificationsEnabled) });
}));
router.post('/api/user/toggle-voting-start-notifications', asyncRoute(async (req, res) => {
    const verification = verifyTelegramInitData(req.body && req.body.initData);
    if (!verification.valid) return res.status(401).json({ success: false, error: verification.error });
    const user = await dbHandler.getOrCreateTelegramUser(verification.user.id, verification.user.username || verification.user.first_name, verification.user.language_code);
    const updatedUser = await dbHandler.updateVotingStartNotifications(user.telegramId, req.body && req.body.enabled === true);
    return res.json({ success: true, votingStartNotificationsEnabled: Boolean(updatedUser && updatedUser.votingStartNotificationsEnabled) });
}));
router.post('/api/telegram-vote', asyncRoute(async (req, res) => { const verification = verifyTelegramInitData(req.body && req.body.initData); if (!verification.valid) return res.status(401).json({ success: false, error: verification.error }); const result = await dbHandler.submitTelegramVote(verification.user.id, req.body && req.body.categoryVotes, verification.user); return res.status(result.success ? 200 : 400).json(result); }));
router.post('/api/prizes/spin', asyncRoute(async (req, res) => { const verification = verifyTelegramInitData(req.body && req.body.initData); if (!verification.valid) return res.status(401).json({ success: false, error: verification.error }); req.session.telegramUserId = String(verification.user.id); const result = await dbHandler.spinPrizes(verification.user.id, req.body && req.body.spinCount); return res.status(result.success ? 200 : 400).json(result); }));

router.get('/admin/login', (req, res) => req.session && req.session.isAdmin ? res.redirect('/admin') : res.render('admin-settings', { ...getPageContext(req), isLoggedIn: false, errorMessage: '' }));
router.post('/admin/login', (req, res) => { if (req.body.password !== (process.env.ADMIN_PASSWORD || 'admin123')) return res.status(401).json({ success: false, error: 'Invalid password.' }); req.session.isAdmin = true; return res.json({ success: true, token: req.app.locals.adminBearerToken, redirect: '/admin' }); });
router.post('/admin/logout', adminMutationGuard, (req, res) => req.session.destroy(() => res.json({ success: true, redirect: '/admin/login' })));
router.get('/admin', adminGuard, asyncRoute(async (req, res) => res.render('admin-settings', { ...getPageContext(req), isLoggedIn: true, settings: await dbHandler.getSettings(), errorMessage: '' })));
router.post('/admin/settings', adminMutationGuard, asyncRoute(async (req, res) => { await dbHandler.updateSettings({ votingStartTimestamp: req.body.votingStartTimestamp, leaderboardShowTimestamp: req.body.leaderboardShowTimestamp, showSoonText: req.body.showSoonText === 'on', allowTestVoting: req.body.allowTestVoting === 'on', allowTestLeaderboard: req.body.allowTestLeaderboard === 'on' }); res.json({ success: true, redirect: '/admin' }); }));

router.get('/admin/graphics', adminGuard, asyncRoute(async (req, res) => res.render('admin-graphics', { ...getPageContext(req), siteConfig: await dbHandler.getSiteConfig() })));
router.post('/admin/graphics/favicon', adminMutationGuard, uploadFavicon, asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'Choose a favicon file to upload.' });
    await dbHandler.updateFaviconPath(`/uploads/${req.file.filename}`);
    return res.json({ success: true, redirect: '/admin/graphics' });
}));

router.get('/admin/main-page', adminGuard, asyncRoute(async (req, res) => res.render('admin-main-page', { siteConfig: await dbHandler.getSiteConfig() })));
router.post('/admin/main-page', adminMutationGuard, asyncRoute(async (req, res) => {
    const siteConfig = await dbHandler.getSiteConfig();
    await dbHandler.updateMainPageLayout(layoutPayloadFromForm(siteConfig.mainPageLayout, req.body));
    return res.json({ success: true, redirect: '/admin/main-page' });
}));
router.get('/admin/main-page/order', adminGuard, asyncRoute(async (req, res) => res.render('admin-main-order', { siteConfig: await dbHandler.getSiteConfig() })));
router.post('/admin/main-page/order', adminMutationGuard, asyncRoute(async (req, res) => {
    const siteConfig = await dbHandler.getSiteConfig();
    const orderedPanelIds = Array.isArray(req.body.panelIds) ? req.body.panelIds : String(req.body.panelIds || '').split(',');
    const orderById = new Map(orderedPanelIds.map((panelId, order) => [String(panelId), order]));
    const panels = siteConfig.mainPageLayout.map((panel) => ({ ...panel, order: orderById.has(panel.panelId) ? orderById.get(panel.panelId) : panel.order }));
    await dbHandler.updateMainPageLayout(panels);
    return res.json({ success: true, redirect: '/admin/main-page/order' });
}));

router.get('/admin/leaderboard-config', adminGuard, asyncRoute(async (req, res) => res.render('admin-leaderboard', { siteConfig: await dbHandler.getSiteConfig() })));
router.post('/admin/leaderboard-config', adminMutationGuard, asyncRoute(async (req, res) => {
    const siteConfig = await dbHandler.getSiteConfig();
    await dbHandler.updateLeaderboardLayout(layoutPayloadFromForm(siteConfig.leaderboardLayout, req.body));
    return res.json({ success: true, redirect: '/admin/leaderboard-config' });
}));

router.get('/admin/schedule', adminGuard, asyncRoute(async (req, res) => res.render('admin-schedule', { ...getPageContext(req), scheduleEvents: await dbHandler.getScheduleEvents() })));
router.post('/admin/schedule', adminMutationGuard, asyncRoute(async (req, res) => {
    await dbHandler.createScheduleEvent({ title: { en: req.body.titleEn, ru: req.body.titleRu, ro: req.body.titleRo }, description: { en: req.body.descriptionEn, ru: req.body.descriptionRu, ro: req.body.descriptionRo }, startTime: req.body.startTime, endTime: req.body.endTime });
    return res.json({ success: true, redirect: '/admin/schedule' });
}));
router.post('/admin/schedule/:eventId/update', adminMutationGuard, asyncRoute(async (req, res) => {
    const event = await dbHandler.updateScheduleEvent(req.params.eventId, { title: { en: req.body.titleEn, ru: req.body.titleRu, ro: req.body.titleRo }, description: { en: req.body.descriptionEn, ru: req.body.descriptionRu, ro: req.body.descriptionRo }, startTime: req.body.startTime, endTime: req.body.endTime });
    if (!event) return res.status(404).json({ success: false, error: 'Schedule event not found.' });
    return res.json({ success: true, redirect: '/admin/schedule' });
}));
router.post('/admin/schedule/:eventId/delete', adminMutationGuard, asyncRoute(async (req, res) => {
    if (!await dbHandler.deleteScheduleEvent(req.params.eventId)) return res.status(404).json({ success: false, error: 'Schedule event not found.' });
    return res.json({ success: true, redirect: '/admin/schedule' });
}));

router.get('/admin/interactive-map', adminGuard, asyncRoute(async (req, res) => res.render('admin-maps', { ...getPageContext(req), maps: await dbHandler.getMaps() })));
router.get('/admin/interactive-map/edit', adminGuard, asyncRoute(async (req, res) => { const map = await dbHandler.getMapById(req.query.mapId); if (!map) return res.status(404).render('error', { ...getPageContext(req), message: 'Map not found.' }); const [eventTypes, markerCategories] = await Promise.all([dbHandler.getMapEventTypes(), dbHandler.getMarkerCategories()]); return res.render('admin-map-edit', { ...getPageContext(req), map, eventTypes, markerCategories }); }));
router.post('/api/admin/maps', adminMutationGuard, asyncRoute(async (_req, res) => { const map = await dbHandler.createMap({ name: {} }); res.json({ success: true, map, redirect: `/admin/interactive-map/edit?mapId=${encodeURIComponent(map.mapId)}` }); }));
router.post('/api/admin/maps/:mapId/delete', adminMutationGuard, asyncRoute(async (req, res) => { if (!await dbHandler.deleteMap(req.params.mapId)) return res.status(404).json({ success: false, error: 'Map not found.' }); return res.json({ success: true, redirect: '/admin/interactive-map' }); }));
router.post('/api/admin/maps/:mapId/details', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { const mapId = String(req.body.mapId || req.params.mapId || '').trim(); const map = await dbHandler.updateMap(mapId, { name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, isDefault: req.body.isDefault === 'true', isVisible: req.body.isVisible === 'true', ...(req.file ? { imageUrl: imagePath(req) } : {}) }); if (!map) return res.status(404).json({ success: false, error: 'Map not found.' }); return res.json({ success: true, map }); }));
router.post('/api/admin/maps/:mapId/editor', adminMutationGuard, asyncRoute(async (req, res) => { const mapId = String(req.body.mapId || req.params.mapId || '').trim(); const map = await dbHandler.updateMap(mapId, { legend: req.body.legend, placedEvents: req.body.placedEvents }); if (!map) return res.status(404).json({ success: false, error: 'Map not found.' }); return res.json({ success: true, redirect: '/admin/interactive-map' }); }));
router.post('/api/admin/maps/:mapId/save', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { const mapId = String(req.body.mapId || req.params.mapId || '').trim(); let editorState = {}; try { editorState = JSON.parse(req.body.editorState || '{}'); } catch { return res.status(400).json({ success: false, error: 'Invalid map editor data.' }); } const map = await dbHandler.updateMap(mapId, { name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, isDefault: req.body.isDefault === 'true', isVisible: req.body.isVisible === 'true', ...(req.file ? { imageUrl: imagePath(req) } : {}), legend: editorState.legend || [], placedEvents: editorState.placedEvents || [] }); if (!map) return res.status(404).json({ success: false, error: 'Map not found.' }); return res.json({ success: true, redirect: '/admin/interactive-map' }); }));
router.post('/api/admin/marker-categories', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { const category = await dbHandler.createMarkerCategory({ name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, color: req.body.color }); res.json({ success: true, category }); }));
router.post('/api/admin/marker-categories/:categoryId/update', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { const category = await dbHandler.updateMarkerCategory(req.params.categoryId, { name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, color: req.body.color }); if (!category) return res.status(404).json({ success: false, error: 'Marker category not found.' }); return res.json({ success: true, category }); }));
router.post('/api/admin/marker-categories/:categoryId/delete', adminMutationGuard, asyncRoute(async (req, res) => { if (!await dbHandler.deleteMarkerCategory(req.params.categoryId)) return res.status(404).json({ success: false, error: 'Marker category not found.' }); return res.json({ success: true }); }));
router.post('/api/admin/map-event-types', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { const eventType = await dbHandler.createMapEventType({ categoryId: req.body.categoryId || '', name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, description: { en: req.body.descriptionEn || '', ru: req.body.descriptionRu || '', ro: req.body.descriptionRo || '' }, symbolIcon: imagePath(req) }); res.json({ success: true, eventType }); }));
router.post('/api/admin/map-event-types/:eventTypeId/update', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { const eventTypeId = String(req.params.eventTypeId || '').trim(); const payload = { categoryId: req.body.categoryId || '', name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, description: { en: req.body.descriptionEn || '', ru: req.body.descriptionRu || '', ro: req.body.descriptionRo || '' } }; if (req.file) payload.symbolIcon = imagePath(req); const eventType = await dbHandler.updateMapEventType(eventTypeId, payload); if (!eventType) return res.status(404).json({ success: false, error: 'Event type not found.' }); return res.json({ success: true, eventType }); }));
router.post('/api/admin/map-event-types/:eventTypeId/delete', adminMutationGuard, asyncRoute(async (req, res) => { const eventTypeId = String(req.params.eventTypeId || '').trim(); if (!await dbHandler.deleteMapEventType(eventTypeId)) return res.status(404).json({ success: false, error: 'Event type not found.' }); return res.json({ success: true }); }));

router.get('/admin/prizes', adminGuard, asyncRoute(async (req, res) => res.render('admin-prizes', { ...getPageContext(req), prizes: await dbHandler.getPrizes() })));
router.post('/admin/prizes', adminMutationGuard, asyncRoute(async (req, res) => { await dbHandler.createPrize({ name: { en: req.body.nameEn, ru: req.body.nameRu, ro: req.body.nameRo }, amount: req.body.amount, color: req.body.color }); res.json({ success: true, redirect: '/admin/prizes' }); }));
router.post('/admin/prizes/:prizeId/update', adminMutationGuard, asyncRoute(async (req, res) => { await dbHandler.updatePrize(req.params.prizeId, { name: { en: req.body.nameEn, ru: req.body.nameRu, ro: req.body.nameRo }, amount: req.body.amount, color: req.body.color }); res.json({ success: true, redirect: '/admin/prizes' }); }));
router.post('/admin/prizes/:prizeId/delete', adminMutationGuard, asyncRoute(async (req, res) => { await dbHandler.deletePrize(req.params.prizeId); res.json({ success: true, redirect: '/admin/prizes' }); }));
router.get('/api/admin/users/count', adminMutationGuard, asyncRoute(async (_req, res) => res.json({ success: true, count: await dbHandler.getTelegramUserCount() })));
router.get('/api/admin/users/search', adminMutationGuard, asyncRoute(async (req, res) => res.json({ success: true, users: await dbHandler.searchTelegramUsers(req.query.q) })));
router.post('/api/admin/users/:telegramId/prize-permission', adminMutationGuard, asyncRoute(async (req, res) => { const user = await dbHandler.updateTelegramUserPrizePermission(req.params.telegramId, req.body.allowedPrizes === true); if (!user) return res.status(404).json({ success: false, error: 'User not found.' }); return res.json({ success: true, user }); }));
router.get('/admin/categories', adminGuard, asyncRoute(async (req, res) => res.render('admin-categories', { ...getPageContext(req), categories: await dbHandler.getCategories() })));
router.post('/admin/categories', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { await dbHandler.createCategory({ name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, description: { en: req.body.descriptionEn || '', ru: req.body.descriptionRu || '', ro: req.body.descriptionRo || '' }, image: imagePath(req), requiresVideoUrl: req.body.requiresVideoUrl === 'on', order: req.body.order }); res.json({ success: true, redirect: '/admin/categories' }); }));
router.post('/admin/categories/:categoryId/update', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { const payload = { name: { en: req.body.nameEn || '', ru: req.body.nameRu || '', ro: req.body.nameRo || '' }, description: { en: req.body.descriptionEn || '', ru: req.body.descriptionRu || '', ro: req.body.descriptionRo || '' }, requiresVideoUrl: req.body.requiresVideoUrl === 'on', order: req.body.order }; if (req.file) payload.image = imagePath(req); await dbHandler.updateCategory(req.params.categoryId, payload); res.json({ success: true, redirect: '/admin/categories' }); }));
router.post('/admin/categories/:categoryId/delete', adminMutationGuard, asyncRoute(async (req, res) => { await dbHandler.deleteCategory(req.params.categoryId); res.json({ success: true, redirect: '/admin/categories' }); }));
router.get('/admin/categories/:categoryId/candidates', adminGuard, asyncRoute(async (req, res) => { const category = await dbHandler.getCategoryById(req.params.categoryId); if (!category) return res.status(404).render('error', { message: 'Category not found.' }); return res.render('admin-candidates', { ...getPageContext(req), category, candidates: await dbHandler.getCandidatesByCategory(category.categoryId) }); }));
router.post('/admin/categories/:categoryId/candidates', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { await dbHandler.createCandidate({ categoryId: req.params.categoryId, name: req.body.name, description: req.body.description, code: req.body.code, videoUrl: participantVideoUrl(req.body.videoUrl), order: req.body.order, image: imagePath(req) }); res.json({ success: true, redirect: categoryPath(req.params.categoryId) }); }));
router.post('/admin/categories/:categoryId/candidates/:candidateId/update', adminMutationGuard, uploadImage, asyncRoute(async (req, res) => { const payload = { categoryId: req.params.categoryId, name: req.body.name, description: req.body.description, code: req.body.code, videoUrl: participantVideoUrl(req.body.videoUrl), order: req.body.order }; if (req.file) payload.image = imagePath(req); await dbHandler.updateCandidate(req.params.candidateId, payload); res.json({ success: true, redirect: categoryPath(req.params.categoryId) }); }));
router.post('/admin/categories/:categoryId/candidates/:candidateId/order', adminMutationGuard, asyncRoute(async (req, res) => { await dbHandler.updateCandidate(req.params.candidateId, { categoryId: req.params.categoryId, order: req.body.order }); res.json({ success: true, redirect: categoryPath(req.params.categoryId) }); }));
router.post('/admin/categories/:categoryId/candidates/:candidateId/delete', adminMutationGuard, asyncRoute(async (req, res) => { await dbHandler.deleteCandidate(req.params.candidateId, req.params.categoryId); res.json({ success: true, redirect: categoryPath(req.params.categoryId) }); }));

module.exports = router;