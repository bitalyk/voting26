const crypto = require('crypto');
const mongoose = require('mongoose');

const keySchema = new mongoose.Schema({
    authKey: { type: String, required: true, unique: true },
    voted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    votedAt: { type: Date }
});

const telegramUserSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    voted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    votedAt: { type: Date }
});

const candidateSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    categoryId: { type: Number, required: true },
    categoryName: { type: String, required: true },
    name: { type: String, required: true },
    votes: { type: Number, default: 0 }
});

const Key = mongoose.model('Key', keySchema);
const TelegramUser = mongoose.model('TelegramUser', telegramUserSchema);
const Candidate = mongoose.model('Candidate', candidateSchema);

function generate12CharKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(12);
    for (let i = 0; i < 12; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result;
}

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
        console.log('Seeded initial candidate data into MongoDB');
    }
}

module.exports = {
    seedCandidatesIfEmpty,

    createAuthKey: async () => {
        const key = generate12CharKey();
        await Key.create({ authKey: key, voted: false });
        return key;
    },

    getAuthKeyStatus: async (key) => {
        const keyData = await Key.findOne({ authKey: key });
        if (!keyData) {
            return { valid: false, reason: 'Key does not exist' };
        }
        return { valid: true, voted: keyData.voted, data: keyData };
    },

    getCandidates: async () => {
        return await Candidate.find({}).lean();
    },

    submitVote: async (key, categoryVotes) => {
        const keyData = await Key.findOne({ authKey: key });

        if (!keyData) {
            return { success: false, error: 'Invalid key' };
        }

        if (keyData.voted) {
            return { success: false, error: 'This key has already been used to vote.' };
        }

        const chosenIds = Object.values(categoryVotes || {});

        await Candidate.updateMany(
            { id: { $in: chosenIds } },
            { $inc: { votes: 1 } }
        );

        keyData.voted = true;
        keyData.votedAt = new Date();
        await keyData.save();

        return { success: true };
    },

    getLeaderboard: async () => {
        return await Candidate.find({})
            .sort({ votes: -1 })
            .limit(5)
            .lean();
    },

    getOrCreateTelegramUser: async (telegramId, username = '') => {
        const normalizedId = String(telegramId);

        let user = await TelegramUser.findOne({ telegramId: normalizedId }).lean();
        if (!user) {
            user = await TelegramUser.create({
                telegramId: normalizedId,
                username: username || '',
                voted: false
            });
            return user;
        }

        if (username && !user.username) {
            await TelegramUser.updateOne(
                { _id: user._id },
                { $set: { username } }
            );
            user.username = username;
        }

        return user;
    },

    getTelegramUserStatus: async (telegramId) => {
        const user = await TelegramUser.findOne({ telegramId: String(telegramId) }).lean();
        if (!user) {
            return { valid: false, reason: 'Telegram user does not exist' };
        }
        return { valid: true, voted: user.voted, data: user };
    },

    submitTelegramVote: async (telegramId, categoryVotes) => {
        const normalizedId = String(telegramId);
        const user = await TelegramUser.findOne({ telegramId: normalizedId });

        if (!user) {
            return { success: false, error: 'Telegram user not found.' };
        }

        if (user.voted) {
            return { success: false, error: 'This Telegram account has already voted.' };
        }

        const chosenIds = Object.values(categoryVotes || {}).filter(Boolean);
        if (chosenIds.length !== 3) {
            return { success: false, error: 'Please select one candidate in every category.' };
        }

        await Candidate.updateMany(
            { id: { $in: chosenIds } },
            { $inc: { votes: 1 } }
        );

        user.voted = true;
        user.votedAt = new Date();
        await user.save();

        return { success: true, user: { telegramId: user.telegramId, voted: user.voted, votedAt: user.votedAt } };
    }
};