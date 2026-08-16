require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const sharp = require('sharp');
const routes = require('./routes');
const dbHandler = require('./dbHandler');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/voting_system';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET || 'gocon-admin-bearer-v1';
const adminBearerToken = crypto.createHmac('sha256', adminTokenSecret).update(adminPassword).digest('base64url').slice(0, 32);
let scheduleNotificationCheckRunning = false;

function verifyAdminBearer(req, res, next) {
    const authorization = String(req.get('authorization') || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const expected = Buffer.from(adminBearerToken);
    const received = Buffer.from(token);

    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    return next();
}

const uploadDirectory = path.join(__dirname, 'public', 'uploads');
const candidateOriginalDirectory = path.join(uploadDirectory, 'candidates', 'original');
const candidateThumbnailDirectory = path.join(uploadDirectory, 'candidates', 'thumbnails');
fs.mkdirSync(uploadDirectory, { recursive: true });
fs.mkdirSync(candidateOriginalDirectory, { recursive: true });
fs.mkdirSync(candidateThumbnailDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname)}`;
        callback(null, safeName);
    }
});

const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);

function imageFileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedImageExtensions.has(extension) || !allowedImageMimeTypes.has(file.mimetype)) {
        const error = new Error('Unsupported image format.');
        error.code = 'UNSUPPORTED_IMAGE_FORMAT';
        return callback(error);
    }
    return callback(null, true);
}

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter
});

const faviconUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter
});

const candidateImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const candidateImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function candidateImageFileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!candidateImageExtensions.has(extension) || !candidateImageMimeTypes.has(file.mimetype)) {
        const error = new Error('Unsupported image format.');
        error.code = 'UNSUPPORTED_IMAGE_FORMAT';
        return callback(error);
    }
    return callback(null, true);
}

const candidateUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, callback) => callback(null, candidateOriginalDirectory),
        filename: (_req, file, callback) => {
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname).toLowerCase()}`;
            callback(null, safeName);
        }
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: candidateImageFileFilter
});

async function processCandidateImage(file) {
    if (!file) return {};

    const thumbnailFilename = `${path.parse(file.filename).name}.webp`;
    const thumbnailPath = path.join(candidateThumbnailDirectory, thumbnailFilename);
    try {
        await sharp(file.path, { limitInputPixels: 100000000 })
            .rotate()
            .resize({ width: 600, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(thumbnailPath);
    } catch (error) {
        await Promise.allSettled([fs.promises.unlink(file.path), fs.promises.unlink(thumbnailPath)]);
        error.code = error.code || 'IMAGE_PROCESSING_FAILED';
        throw error;
    }

    return {
        image: `/uploads/candidates/thumbnails/${thumbnailFilename}`,
        originalImage: `/uploads/candidates/original/${file.filename}`
    };
}

app.locals.upload = upload;
app.locals.faviconUpload = faviconUpload;
app.locals.candidateUpload = candidateUpload;
app.locals.processCandidateImage = processCandidateImage;
app.locals.adminBearerToken = adminBearerToken;
app.locals.verifyAdminBearer = verifyAdminBearer;
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.get('/favicon.ico', async (req, res, next) => {
    try {
        const siteConfig = await dbHandler.getSiteConfig();
        const filename = path.basename(String(siteConfig.faviconPath || ''));
        const faviconFile = filename ? path.join(uploadDirectory, filename) : '';
        if (!faviconFile || !fs.existsSync(faviconFile)) return res.status(204).end();
        res.set('Cache-Control', 'no-store');
        return res.sendFile(faviconFile);
    } catch (error) {
        return next(error);
    }
});

app.get('/public-theme.css', async (req, res, next) => {
    try {
        const siteConfig = await dbHandler.getSiteConfig();
        const publicTheme = ['classic', 'studio', 'night', 'citrus'].includes(siteConfig.publicTheme) ? siteConfig.publicTheme : 'classic';
        const themeFiles = {
            classic: [],
            studio: ['gocon-theme.css'],
            night: ['gocon-theme.css', 'themes/night.css'],
            citrus: ['gocon-theme.css', 'themes/citrus.css']
        }[publicTheme];
        const styles = await Promise.all(themeFiles.map((file) => fs.promises.readFile(path.join(__dirname, 'public', file), 'utf8')));
        res.set('Cache-Control', 'no-store');
        return res.type('text/css').send(styles.join('\n'));
    } catch (error) {
        return next(error);
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDirectory));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.ADMIN_PASSWORD || 'local-admin-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 6,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    }
}));

app.use('/', routes);

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        const isCandidateUpload = req.path.includes('/candidates');
        return res.status(413).json({ success: false, code: 'FILE_TOO_LARGE', error: isCandidateUpload ? 'File exceeds maximum limit of 25MB.' : 'File is too large! Please upload an image smaller than 5MB.' });
    }
    if (error && error.code === 'UNSUPPORTED_IMAGE_FORMAT') {
        return res.status(415).json({ success: false, code: 'UNSUPPORTED_IMAGE_FORMAT', error: 'Unsupported image format! Please use PNG, JPG, WEBP, or SVG.' });
    }
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: error.message });
    }
    if (error && error.code === 'IMAGE_PROCESSING_FAILED') {
        return res.status(422).json({ success: false, code: 'IMAGE_PROCESSING_FAILED', error: 'The uploaded image could not be processed.' });
    }
    return next(error);
});

app.use((req, res) => {
    const requestedLanguage = String(req.query.lang || '').toLowerCase();
    const lang = ['en', 'ru', 'ro'].includes(requestedLanguage) ? requestedLanguage : 'en';
    res.status(404).render('error', { message: 'The requested page could not be found.', lang });
});

function scheduleNotificationMessage(event, languageCode) {
    const title = dbHandler.resolveLocalizedText(event.title, languageCode) || dbHandler.resolveLocalizedText(event.title, 'en');
    const messages = {
        en: `Event Starting Now: ${title}!`,
        ru: `Событие начинается сейчас: ${title}!`,
        ro: `Evenimentul începe acum: ${title}!`
    };
    return `\u{1F514} ${messages[languageCode] || messages.en}`;
}

function votingStartNotificationMessage(languageCode) {
    const messages = {
        en: 'Voting is open now!',
        ru: 'Голосование открыто!',
        ro: 'Votarea este deschisa!'
    };
    const language = dbHandler.normalizeLanguageCode(languageCode);
    return `\u{1F514} ${messages[language]}`;
}

async function sendTelegramScheduleNotification(telegramId, text) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramId, text }),
        signal: AbortSignal.timeout(10000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
        throw new Error(result.description || `Telegram API request failed with status ${response.status}.`);
    }
}

async function checkScheduleNotifications() {
    if (scheduleNotificationCheckRunning || !process.env.TELEGRAM_BOT_TOKEN) return;
    scheduleNotificationCheckRunning = true;
    try {
        const dueEvents = await dbHandler.getDueUnnotifiedScheduleEvents();
        if (!dueEvents.length) return;

        const recipients = await dbHandler.getScheduleNotificationUsers();
        for (const event of dueEvents) {
            const deliveries = await Promise.allSettled(recipients.map((user) => sendTelegramScheduleNotification(
                user.telegramId,
                scheduleNotificationMessage(event, user.languageCode)
            )));
            deliveries.forEach((delivery, index) => {
                if (delivery.status === 'rejected') {
                    console.error(`Schedule notification failed for Telegram user ${recipients[index].telegramId}:`, delivery.reason.message);
                }
            });
            await dbHandler.markScheduleEventNotified(event.eventId);
        }
    } catch (error) {
        console.error('Schedule notification check failed:', error.message);
    } finally {
        scheduleNotificationCheckRunning = false;
    }
}

async function checkVotingStartNotifications() {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
    try {
        const settings = await dbHandler.getSettings();
        if (settings.votingStartNotificationSent || Date.now() < new Date(settings.votingStartTimestamp).getTime()) return;
        const recipients = await dbHandler.getVotingStartNotificationUsers();
        const deliveries = await Promise.allSettled(recipients.map((user) => sendTelegramScheduleNotification(
            user.telegramId,
            votingStartNotificationMessage(user.languageCode)
        )));
        deliveries.forEach((delivery, index) => {
            if (delivery.status === 'rejected') console.error(`Voting start notification failed for Telegram user ${recipients[index].telegramId}:`, delivery.reason.message);
        });
        await dbHandler.markVotingStartNotificationSent();
    } catch (error) {
        console.error('Voting start notification check failed:', error.message);
    }
}

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB successfully');
        await dbHandler.seedDatabaseDefaults();
        await checkScheduleNotifications();
        await checkVotingStartNotifications();
        setInterval(checkScheduleNotifications, 60000);
        setInterval(checkVotingStartNotifications, 60000);
        const server = app.listen(PORT, () => {
            console.log(`Server is running at http://localhost:${PORT}`);
        });
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Stop the existing server or set PORT to an available port.`);
            } else {
                console.error('HTTP server error:', error);
            }
            process.exit(1);
        });
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });