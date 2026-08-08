const crypto = require('crypto');
const mongoose = require('mongoose');

// --- СХЕМЫ И МОДЕЛИ MONGODB ---

// 1. Схема для ключей доступа
const keySchema = new mongoose.Schema({
    authKey: { type: String, required: true, unique: true },
    voted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    votedAt: { type: Date }
});

// 2. Схема для кандидатов
const candidateSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    categoryId: { type: Number, required: true },
    categoryName: { type: String, required: true },
    name: { type: String, required: true },
    votes: { type: Number, default: 0 }
});

const Key = mongoose.model('Key', keySchema);
const Candidate = mongoose.model('Candidate', candidateSchema);

// Генерация 12-значного ключа
function generate12CharKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(12);
    for (let i = 0; i < 12; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result;
}

// Заполнение кандидатов при первом запуске
async function seedCandidatesIfEmpty() {
    const count = await Candidate.countDocuments();
    if (count === 0) {
        const initialCandidates = [
            { id: 'c1_1', categoryId: 1, categoryName: 'Best Innovation', name: 'Project Alpha', votes: 0 },
            { id: 'c1_2', categoryId: 1, categoryName: 'Best Innovation', name: 'Project Beta', votes: 0 },
            { id: 'c1_3', categoryId: 1, categoryName: 'Best Innovation', name: 'Project Gamma', votes: 0 },
            { id: 'c2_1', categoryId: 2, categoryName: 'Best Design', name: 'Design Studio A', votes: 0 },
            { id: 'c2_2', categoryId: 2, categoryName: 'Best Design', name: 'Design Studio B', votes: 0 },
            { id: 'c2_3', categoryId: 2, categoryName: 'Best Design', name: 'Design Studio C', votes: 0 },
            { id: 'c3_1', categoryId: 3, categoryName: 'People\'s Choice', name: 'Team Nova', votes: 0 },
            { id: 'c3_2', categoryId: 3, categoryName: 'People\'s Choice', name: 'Team Apex', votes: 0 },
            { id: 'c3_3', categoryId: 3, categoryName: 'People\'s Choice', name: 'Team Vortex', votes: 0 }
        ];
        await Candidate.insertMany(initialCandidates);
        console.log('Начальные кандидаты успешно добавлены в MongoDB');
    }
}

module.exports = {
    seedCandidatesIfEmpty,

    // Создание нового 12-значного ключа
    createAuthKey: async () => {
        const key = generate12CharKey();
        await Key.create({ authKey: key, voted: false });
        return key;
    },

    // Проверка статуса ключа
    getAuthKeyStatus: async (key) => {
        const keyData = await Key.findOne({ authKey: key });
        if (!keyData) {
            return { valid: false, reason: 'Key does not exist' };
        }
        return { valid: true, voted: keyData.voted, data: keyData };
    },

    // Получить всех кандидатов
    getCandidates: async () => {
        return await Candidate.find({}).lean();
    },

    // Атомарное голосование
    submitVote: async (key, categoryVotes) => {
        const keyData = await Key.findOne({ authKey: key });

        if (!keyData) {
            return { success: false, error: 'Invalid key' };
        }

        if (keyData.voted) {
            return { success: false, error: 'This key has already been used to vote.' };
        }

        const chosenIds = Object.values(categoryVotes);

        // Увеличиваем счетчик голосов у выбранных кандидатов
        await Candidate.updateMany(
            { id: { $in: chosenIds } },
            { $inc: { votes: 1 } }
        );

        // Помечаем ключ как использованный
        keyData.voted = true;
        keyData.votedAt = new Date();
        await keyData.save();

        return { success: true };
    },

    // Топ-5 кандидатов для лидерборда
    getLeaderboard: async () => {
        return await Candidate.find({})
            .sort({ votes: -1 })
            .limit(5)
            .lean();
    }
};