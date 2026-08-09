require('dotenv').config();

const fs = require('fs');
const net = require('net');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const routes = require('./routes');
const dbHandler = require('./dbHandler');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/voting_system';

function isPortFree(port) {
    return new Promise((resolve) => {
        const tester = net.createServer();
        tester.once('error', () => resolve(false));
        tester.once('listening', () => {
            tester.once('close', () => resolve(true));
            tester.close();
        });
        tester.listen(port, '127.0.0.1');
    });
}

async function getAvailablePort(preferredPort) {
    const candidates = Array.from(new Set([preferredPort, 3000, 3001, 3002, 4000, 5050, 8080]));
    for (const port of candidates) {
        if (await isPortFree(port)) {
            return port;
        }
    }
    return preferredPort;
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
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', true);

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
        sameSite: 'lax'
    }
}));

app.use('/', routes);

app.use((req, res) => {
    res.status(404).render('error', { message: 'The requested page could not be found.' });
});

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB successfully');
        await dbHandler.seedDatabaseDefaults();
        const activePort = await getAvailablePort(PORT);
        app.listen(activePort, () => {
            console.log(`Server is running at http://localhost:${activePort}`);
        });
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });