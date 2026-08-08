const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const routes = require('./routes');
const dbHandler = require('./dbHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// URL подключения (локальная MongoDB или строка из MongoDB Atlas)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/voting_system';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/', routes);

// Сначала подключаемся к базе, затем запускаем сервер
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB successfully');
        await dbHandler.seedCandidatesIfEmpty();
        
        app.listen(PORT, () => {
            console.log(`Server is running at http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });