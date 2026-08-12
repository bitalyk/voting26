require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const routes = require('./routes');
const dbHandler = require('./dbHandler');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/voting_system';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET || 'gocon-admin-bearer-v1';
const adminBearerToken = crypto.createHmac('sha256', adminTokenSecret).update(adminPassword).digest('base64url').slice(0, 32);

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
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname)}`;
        callback(null, safeName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error('Only image uploads are allowed.'));
        }
        callback(null, true);
    }
});

app.locals.upload = upload;
app.locals.adminBearerToken = adminBearerToken;
app.locals.verifyAdminBearer = verifyAdminBearer;
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

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
    if (error instanceof multer.MulterError || error.message === 'Only image uploads are allowed.') {
        return res.status(400).render('error', { message: error.message });
    }
    return next(error);
});

app.use((req, res) => {
    const requestedLanguage = String(req.query.lang || '').toLowerCase();
    const lang = ['en', 'ru', 'ro'].includes(requestedLanguage) ? requestedLanguage : 'en';
    res.status(404).render('error', { message: 'The requested page could not be found.', lang });
});

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB successfully');
        await dbHandler.seedDatabaseDefaults();
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