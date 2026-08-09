const crypto = require('crypto');
const mongoose = require('mongoose');

const { Schema } = mongoose;

const settingsSchema = new Schema({
    votingStartTimestamp: { type: Date, default: () => new Date(Date.now() + 60 * 60 * 1000) },
    leaderboardShowTimestamp: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
    showSoonText: { type: Boolean, default: false },
    allowTestVoting: { type: Boolean, default: false },
    allowTestLeaderboard: { type: Boolean, default: false }
}, { timestamps: true });

const categorySchema = new Schema({
    categoryId: { type: String, required: true, unique: true, index: true },
    name: { type: Schema.Types.Mixed, default: {} },
    image: { type: String, default: '' },
    order: { type: Number, default: () => Date.now() }
}, { timestamps: true });

const candidateSchema = new Schema({
    candidateId: { type: String, required: true, unique: true, index: true },
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    code: { type: String, default: '' },
    image: { type: String, default: '' },
    order: { type: Number, default: () => Date.now() },
    votes: { type: Number, default: 0 }
}, { timestamps: true });

const wonPrizeSchema = new Schema({
    prizeId: { type: String, required: true },
    name: { type: Schema.Types.Mixed, required: true },
    wonAt: { type: Date, default: Date.now }
}, { _id: false });

const prizeSchema = new Schema({
    prizeId: { type: String, required: true, unique: true, index: true },
    name: { type: Schema.Types.Mixed, default: {} },
    amount: { type: Number, required: true, min: 0, default: 0 },
    color: { type: String, default: '#38bdf8' },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const telegramUserSchema = new Schema({
    telegramId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    voted: { type: Boolean, default: false },
    votedAt: { type: Date },
    languageCode: { type: String, default: 'en' },
    allowedPrizes: { type: Boolean, default: false },
    wonPrizes: { type: [wonPrizeSchema], default: [] }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);
const Category = mongoose.model('Category', categorySchema);
const Candidate = mongoose.model('Candidate', candidateSchema);
const Prize = mongoose.model('Prize', prizeSchema);
const TelegramUser = mongoose.model('TelegramUser', telegramUserSchema);

async function generateUniqueFiveDigitId(Model, fieldName) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const value = String(crypto.randomInt(10000, 100000));
        const exists = await Model.exists({ [fieldName]: value });
        if (!exists) {
            return value;
        }
    }

    throw new Error(`Unable to generate a unique ${fieldName}.`);
}

function toDateValue(value) {
    if (!value && value !== 0) {
        return null;
    }

    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const directDate = new Date(trimmed);
        if (!Number.isNaN(directDate.getTime())) {
            return directDate;
        }

        const numericValue = Number(trimmed);
        if (!Number.isNaN(numericValue)) {
            const numericDate = new Date(numericValue);
            return Number.isNaN(numericDate.getTime()) ? null : numericDate;
        }
    }

    return null;
}

function normalizeLanguageCode(languageCode) {
    const value = String(languageCode || 'en').toLowerCase();
    if (['en', 'ru', 'ro'].includes(value)) {
        return value;
    }
    return 'en';
}

function getEnvDate(name, fallbackDate) {
    const envValue = process.env[name];
    const parsed = toDateValue(envValue);
    return parsed || fallbackDate;
}

function resolveLocalizedText(value, fallback = 'en') {
    if (!value) {
        return '';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'object') {
        return value[fallback] || value.en || value.ru || value.ro || '';
    }

    return String(value);
}

function normalizePrizeName(value) {
    if (typeof value === 'string') {
        const name = value.trim();
        if (!name) {
            throw new Error('Prize name is required.');
        }
        return { en: name, ru: name, ro: name };
    }

    const name = {
        en: String(value && value.en || '').trim(),
        ru: String(value && value.ru || '').trim(),
        ro: String(value && value.ro || '').trim()
    };
    if (!name.en && !name.ru && !name.ro) {
        throw new Error('Prize name is required.');
    }
    name.en = name.en || name.ru || name.ro;
    name.ru = name.ru || name.en;
    name.ro = name.ro || name.en;
    return name;
}

function normalizePrizeAmount(value) {
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 0) {
        throw new Error('Prize quantity must be a whole number of zero or greater.');
    }
    return amount;
}

function normalizePrizeColor(value) {
    const color = String(value || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new Error('Prize color must be a six-digit hex color.');
    }
    return color;
}

async function seedDatabaseDefaults() {
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) {
        await Settings.create({
            votingStartTimestamp: getEnvDate('VOTING_START_TIMESTAMP', new Date(Date.now() - 60 * 60 * 1000)),
            leaderboardShowTimestamp: getEnvDate('LEADERBOARD_SHOW_TIMESTAMP', new Date(Date.now() - 60 * 60 * 1000)),
            showSoonText: String(process.env.SHOW_SOON_TEXT || 'false').toLowerCase() === 'true',
            allowTestVoting: String(process.env.ALLOW_TEST_VOTING || 'false').toLowerCase() === 'true',
            allowTestLeaderboard: String(process.env.ALLOW_TEST_LEADERBOARD || 'false').toLowerCase() === 'true'
        });
    }

}

module.exports = {
    normalizeLanguageCode,
    resolveLocalizedText,
    toDateValue,
    seedDatabaseDefaults,

    getSettings: async function getSettings() {
        let settings = await Settings.findOne({}).lean();
        if (!settings) {
            settings = await Settings.create({
                votingStartTimestamp: getEnvDate('VOTING_START_TIMESTAMP', new Date(Date.now() - 60 * 60 * 1000)),
                leaderboardShowTimestamp: getEnvDate('LEADERBOARD_SHOW_TIMESTAMP', new Date(Date.now() - 60 * 60 * 1000)),
                showSoonText: String(process.env.SHOW_SOON_TEXT || 'false').toLowerCase() === 'true',
                allowTestVoting: String(process.env.ALLOW_TEST_VOTING || 'false').toLowerCase() === 'true',
                allowTestLeaderboard: String(process.env.ALLOW_TEST_LEADERBOARD || 'false').toLowerCase() === 'true'
            });
        }
        return settings;
    },

    updateSettings: async function updateSettings(payload = {}) {
        const settings = await Settings.findOne({});
        if (!settings) {
            throw new Error('Settings document not found.');
        }

        if (typeof payload.allowTestVoting === 'boolean') {
            settings.allowTestVoting = payload.allowTestVoting;
        }

        if (typeof payload.allowTestLeaderboard === 'boolean') {
            settings.allowTestLeaderboard = payload.allowTestLeaderboard;
        }

        if (typeof payload.showSoonText === 'boolean') {
            settings.showSoonText = payload.showSoonText;
        }

        const votingStartTimestamp = toDateValue(payload.votingStartTimestamp);
        if (votingStartTimestamp) {
            settings.votingStartTimestamp = votingStartTimestamp;
        }

        const leaderboardShowTimestamp = toDateValue(payload.leaderboardShowTimestamp);
        if (leaderboardShowTimestamp) {
            settings.leaderboardShowTimestamp = leaderboardShowTimestamp;
        }

        await settings.save();
        return settings.toObject();
    },

    getCategories: async function getCategories() {
        return Category.find({}).sort({ order: 1, createdAt: 1 }).lean();
    },

    getCategoryById: async function getCategoryById(categoryId) {
        return Category.findOne({ categoryId }).lean();
    },

    createCategory: async function createCategory({ name, image, order }) {
        const doc = await Category.create({
            categoryId: await generateUniqueFiveDigitId(Category, 'categoryId'),
            name: name || {},
            image: image || '',
            order: order === undefined || order === '' ? Date.now() : Number(order)
        });
        return doc.toObject();
    },

    updateCategory: async function updateCategory(categoryId, payload = {}) {
        const category = await Category.findOne({ categoryId });
        if (!category) {
            return null;
        }

        if (payload.name) {
            category.name = payload.name;
        }

        if (payload.image !== undefined) {
            category.image = payload.image || '';
        }

        if (payload.order !== undefined && payload.order !== null) {
            category.order = Number(payload.order);
        }

        await category.save();
        return category.toObject();
    },

    deleteCategory: async function deleteCategory(categoryId) {
        const category = await Category.findOne({ categoryId });
        if (!category) {
            return false;
        }

        await Candidate.deleteMany({ categoryId });
        await category.deleteOne();
        return true;
    },

    getCandidates: async function getCandidates() {
        const candidates = await Candidate.find({}).sort({ order: 1, createdAt: 1 }).lean();
        return candidates;
    },

    getCandidatesByCategory: async function getCandidatesByCategory(categoryId) {
        return Candidate.find({ categoryId }).sort({ order: 1, createdAt: 1 }).lean();
    },

    getCandidateById: async function getCandidateById(candidateId) {
        return Candidate.findOne({ candidateId }).lean();
    },

    createCandidate: async function createCandidate(payload = {}) {
        const candidateId = await generateUniqueFiveDigitId(Candidate, 'candidateId');
        const categoryId = payload.categoryId || '';

        const category = await Category.exists({ categoryId });
        if (!category) {
            throw new Error('The selected category does not exist.');
        }

        const candidate = await Candidate.create({
            candidateId,
            categoryId,
            name: payload.name || '',
            description: payload.description || '',
            code: payload.code || '',
            image: payload.image || '',
            order: payload.order === undefined || payload.order === '' ? Date.now() : Number(payload.order),
            votes: 0
        });
        return candidate.toObject();
    },

    updateCandidate: async function updateCandidate(candidateId, payload = {}) {
        const currentCategoryId = payload.categoryId || null;
        let candidate = null;

        if (currentCategoryId) {
            candidate = await Candidate.findOne({ candidateId, categoryId: currentCategoryId });
        }

        if (!candidate) {
            const matches = await Candidate.find({ candidateId }).sort({ createdAt: 1 }).lean();
            if (matches.length === 1) {
                candidate = await Candidate.findById(matches[0]._id);
            } else if (matches.length > 1 && currentCategoryId) {
                candidate = await Candidate.findOne({ candidateId, categoryId: currentCategoryId });
            }
        }

        if (!candidate) {
            return null;
        }

        if (payload.categoryId) {
            const category = await Category.exists({ categoryId: payload.categoryId });
            if (!category) {
                throw new Error('The selected category does not exist.');
            }
            candidate.categoryId = payload.categoryId;
        }

        if (payload.name) {
            candidate.name = payload.name;
        }

        if (payload.description !== undefined) {
            candidate.description = payload.description;
        }

        if (payload.code !== undefined) {
            candidate.code = payload.code;
        }

        if (payload.image) {
            candidate.image = payload.image;
        }

        if (payload.order !== undefined && payload.order !== null) {
            candidate.order = Number(payload.order);
        }

        await candidate.save();
        return candidate.toObject();
    },

    deleteCandidate: async function deleteCandidate(candidateId, categoryId = null) {
        let candidate = null;

        if (categoryId) {
            candidate = await Candidate.findOne({ candidateId, categoryId });
        }

        if (!candidate) {
            const matches = await Candidate.find({ candidateId }).sort({ createdAt: 1 }).lean();
            if (matches.length === 1) {
                candidate = await Candidate.findById(matches[0]._id);
            } else if (matches.length > 1 && categoryId) {
                candidate = await Candidate.findOne({ candidateId, categoryId });
            }
        }

        if (!candidate) {
            return false;
        }

        await candidate.deleteOne();
        return true;
    },

    getPrizes: async function getPrizes() {
        return Prize.find({}).sort({ createdAt: 1 }).lean();
    },

    getActivePrizes: async function getActivePrizes() {
        return Prize.find({ amount: { $gt: 0 } }).sort({ createdAt: 1 }).lean();
    },

    createPrize: async function createPrize(payload = {}) {
        const prize = await Prize.create({
            prizeId: await generateUniqueFiveDigitId(Prize, 'prizeId'),
            name: normalizePrizeName(payload.name),
            amount: normalizePrizeAmount(payload.amount),
            color: normalizePrizeColor(payload.color)
        });
        return prize.toObject();
    },

    updatePrize: async function updatePrize(prizeId, payload = {}) {
        const prize = await Prize.findOne({ prizeId });
        if (!prize) {
            return null;
        }

        if (payload.name !== undefined) prize.name = normalizePrizeName(payload.name);
        if (payload.amount !== undefined) prize.amount = normalizePrizeAmount(payload.amount);
        if (payload.color !== undefined) prize.color = normalizePrizeColor(payload.color);
        await prize.save();
        return prize.toObject();
    },

    deletePrize: async function deletePrize(prizeId) {
        const result = await Prize.deleteOne({ prizeId });
        return result.deletedCount === 1;
    },

    getTelegramUsers: async function getTelegramUsers() {
        return TelegramUser.find({}).sort({ createdAt: -1 }).lean();
    },

    updateTelegramUserPrizePermission: async function updateTelegramUserPrizePermission(telegramId, allowedPrizes) {
        const user = await TelegramUser.findOneAndUpdate(
            { telegramId: String(telegramId) },
            { $set: { allowedPrizes: Boolean(allowedPrizes) } },
            { new: true }
        );
        return user ? user.toObject() : null;
    },

    spinPrizes: async function spinPrizes(telegramId, requestedSpinCount) {
        const spinCount = Number(requestedSpinCount);
        if (![1, 5, 10].includes(spinCount)) {
            return { success: false, error: 'Choose 1, 5, or 10 spins.' };
        }

        const user = await TelegramUser.findOne({ telegramId: String(telegramId) }).lean();
        if (!user || !user.allowedPrizes) {
            return { success: false, error: 'Prize access is not enabled for this account.' };
        }

        const wins = [];
        for (let index = 0; index < spinCount; index += 1) {
            let claimedPrize = null;

            // A concurrent spin may claim the selected prize first, so retry with a fresh pool.
            for (let attempt = 0; attempt < 10 && !claimedPrize; attempt += 1) {
                const activePrizes = await Prize.find({ amount: { $gt: 0 } }).lean();
                const totalPool = activePrizes.reduce((total, prize) => total + prize.amount, 0);
                if (totalPool === 0) break;

                let target = crypto.randomInt(totalPool);
                let selectedPrize = activePrizes[activePrizes.length - 1];
                for (const prize of activePrizes) {
                    target -= prize.amount;
                    if (target < 0) {
                        selectedPrize = prize;
                        break;
                    }
                }

                claimedPrize = await Prize.findOneAndUpdate(
                    { prizeId: selectedPrize.prizeId, amount: { $gt: 0 } },
                    { $inc: { amount: -1 } },
                    { new: true }
                ).lean();
            }

            if (!claimedPrize) break;

            const wonAt = new Date();
            const win = { prizeId: claimedPrize.prizeId, name: claimedPrize.name, wonAt };
            const prizeHistoryResult = await TelegramUser.updateOne(
                { _id: user._id, allowedPrizes: true },
                { $push: { wonPrizes: win } }
            );
            if (prizeHistoryResult.matchedCount !== 1) {
                await Prize.updateOne({ prizeId: claimedPrize.prizeId }, { $inc: { amount: 1 } });
                break;
            }
            wins.push(win);
        }

        return wins.length > 0
            ? { success: true, wins, availableSpins: wins.length }
            : { success: false, error: 'No prizes are currently available.' };
    },

    getOrCreateTelegramUser: async function getOrCreateTelegramUser(telegramId, username = '', languageCode = 'en') {
        const normalizedId = String(telegramId);
        const normalizedLanguage = normalizeLanguageCode(languageCode);

        let user = await TelegramUser.findOne({ telegramId: normalizedId });
        if (!user) {
            user = await TelegramUser.create({
                telegramId: normalizedId,
                username: username || '',
                voted: false,
                languageCode: normalizedLanguage
            });
            return user.toObject();
        }

        const updates = {};
        if (username && !user.username) {
            updates.username = username;
        }

        updates.languageCode = normalizedLanguage;

        if (Object.keys(updates).length > 0) {
            await TelegramUser.updateOne({ _id: user._id }, { $set: updates });
            user = await TelegramUser.findById(user._id);
        }

        return user.toObject();
    },

    getTelegramUserStatus: async function getTelegramUserStatus(telegramId) {
        const user = await TelegramUser.findOne({ telegramId: String(telegramId) });
        if (!user) {
            return { valid: false, reason: 'Telegram user does not exist' };
        }
        return { valid: true, voted: !!user.voted, data: user.toObject() };
    },

    isVotingOpen: async function isVotingOpen() {
        const settings = await Settings.findOne({}).lean();
        if (!settings) {
            return { allowed: false, reason: 'Settings missing' };
        }

        if (settings.allowTestVoting === true) {
            return { allowed: true, reason: 'Test mode enabled' };
        }

        const votingStartTimestamp = toDateValue(settings.votingStartTimestamp);
        if (!votingStartTimestamp) {
            return { allowed: false, reason: 'Voting start timestamp missing' };
        }

        const isOpen = Date.now() >= new Date(votingStartTimestamp).getTime();
        if (isOpen) {
            return { allowed: true, reason: 'Voting window open' };
        }

        return { allowed: false, reason: 'Voting has not started yet' };
    },

    submitTelegramVote: async function submitTelegramVote(telegramId, categoryVotes = {}, profile = {}) {
        const normalizedId = String(telegramId);
        let user = await TelegramUser.findOne({ telegramId: normalizedId });

        if (!user) {
            user = await TelegramUser.create({
                telegramId: normalizedId,
                username: profile.username || profile.first_name || '',
                voted: false,
                languageCode: normalizeLanguageCode(profile.language_code || 'en')
            });
        }

        const votingStatus = await module.exports.isVotingOpen();
        if (!votingStatus.allowed) {
            return { success: false, error: 'Voting is not open yet.' };
        }

        const categories = await Category.find({}).select('categoryId').lean();
        const expectedSelectionCount = categories.length;

        if (expectedSelectionCount === 0) {
            return { success: false, error: 'No voting categories are configured yet.' };
        }

        const categoryIds = new Set(categories.map((category) => category.categoryId));
        const selectedPairs = Object.entries(categoryVotes || {})
            .filter(([categoryId, candidateId]) => categoryId && candidateId)
            .map(([categoryId, candidateId]) => ({ categoryId, candidateId }));

        if (selectedPairs.length !== expectedSelectionCount) {
            return { success: false, error: `Please select one candidate in each of the ${expectedSelectionCount} categories before submitting.` };
        }

        const uniqueCategoryIds = new Set(selectedPairs.map((pair) => pair.categoryId));
        if (uniqueCategoryIds.size !== expectedSelectionCount || [...uniqueCategoryIds].some((categoryId) => !categoryIds.has(categoryId))) {
            return { success: false, error: `Please select one candidate in each of the ${expectedSelectionCount} categories before submitting.` };
        }

        const existingCandidates = await Candidate.find({
            $or: selectedPairs.map(({ categoryId, candidateId }) => ({ categoryId, candidateId }))
        }).lean();

        if (existingCandidates.length !== selectedPairs.length) {
            return { success: false, error: 'One or more selected candidates are invalid.' };
        }

        const votedAt = new Date();
        const claimedUser = await TelegramUser.findOneAndUpdate(
            { telegramId: normalizedId, voted: false },
            { $set: { voted: true, votedAt } },
            { new: true }
        );

        if (!claimedUser) {
            return { success: false, error: 'This Telegram account has already voted.' };
        }

        try {
            await Candidate.bulkWrite(selectedPairs.map(({ categoryId, candidateId }) => ({
                updateOne: {
                    filter: { categoryId, candidateId },
                    update: { $inc: { votes: 1 } }
                }
            })));
        } catch (error) {
            await TelegramUser.updateOne(
                { _id: claimedUser._id, votedAt },
                { $set: { voted: false }, $unset: { votedAt: 1 } }
            );
            throw error;
        }

        return {
            success: true,
            user: { telegramId: claimedUser.telegramId, voted: claimedUser.voted, votedAt: claimedUser.votedAt }
        };
    },

    getLeaderboard: async function getLeaderboard() {
        const categories = await Category.find({}).sort({ order: 1, createdAt: 1 }).lean();
        const categoryMap = {};

        categories.forEach((category) => {
            categoryMap[category.categoryId] = category;
        });

        const categoryResults = await Promise.all(categories.map(async (category) => {
            const candidates = await Candidate.find({ categoryId: category.categoryId }).sort({ votes: -1, order: 1 }).limit(3).lean();

            return {
                ...category,
                categoryName: resolveLocalizedText(category.name, 'en'),
                candidates: candidates.map((candidate, index) => ({
                    ...candidate,
                    rank: index + 1,
                    categoryName: resolveLocalizedText(category.name, 'en')
                }))
            };
        }));

        return {
            categories,
            categoryMap,
            categoryResults
        };
    }
};