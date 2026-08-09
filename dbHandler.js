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
    order: { type: Number, default: 0 }
}, { timestamps: true });

const candidateSchema = new Schema({
    candidateId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    code: { type: String, default: '' },
    image: { type: String, default: '' },
    order: { type: Number, default: 0 },
    votes: { type: Number, default: 0 }
}, { timestamps: true });

candidateSchema.index({ candidateId: 1, categoryId: 1 }, { unique: true, name: 'candidate_id_category_unique' });

const telegramUserSchema = new Schema({
    telegramId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    voted: { type: Boolean, default: false },
    votedAt: { type: Date },
    languageCode: { type: String, default: 'en' }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);
const Category = mongoose.model('Category', categorySchema);
const Candidate = mongoose.model('Candidate', candidateSchema);
const TelegramUser = mongoose.model('TelegramUser', telegramUserSchema);

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

const defaultCategories = [
    {
        categoryId: 'cat_1',
        name: { en: 'Best Innovation', ru: 'Лучшее инновационное решение', ro: 'Cea mai bună inovație' },
        image: '',
        order: 1
    },
    {
        categoryId: 'cat_2',
        name: { en: 'Best Design', ru: 'Лучший дизайн', ro: 'Cel mai bun design' },
        image: '',
        order: 2
    },
    {
        categoryId: 'cat_3',
        name: { en: 'People\'s Choice', ru: 'Выбор людей', ro: 'Alegerea publicului' },
        image: '',
        order: 3
    }
];

const defaultCandidates = [
    { candidateId: 'cand_1', categoryId: 'cat_1', name: 'Project Alpha', description: 'Strong product vision and impact.', code: 'A1', image: '', order: 1, votes: 0 },
    { candidateId: 'cand_2', categoryId: 'cat_1', name: 'Project Beta', description: 'Efficient and scalable execution.', code: 'B1', image: '', order: 2, votes: 0 },
    { candidateId: 'cand_3', categoryId: 'cat_1', name: 'Project Gamma', description: 'High-value innovation with measurable growth.', code: 'G1', image: '', order: 3, votes: 0 },
    { candidateId: 'cand_4', categoryId: 'cat_2', name: 'Design Studio A', description: 'Elegant interface and smooth UX.', code: 'D1', image: '', order: 1, votes: 0 },
    { candidateId: 'cand_5', categoryId: 'cat_2', name: 'Design Studio B', description: 'Creative brand system and polish.', code: 'D2', image: '', order: 2, votes: 0 },
    { candidateId: 'cand_6', categoryId: 'cat_2', name: 'Design Studio C', description: 'Modern visuals with strong clarity.', code: 'D3', image: '', order: 3, votes: 0 },
    { candidateId: 'cand_7', categoryId: 'cat_3', name: 'Team Nova', description: 'Strong community support and momentum.', code: 'N1', image: '', order: 1, votes: 0 },
    { candidateId: 'cand_8', categoryId: 'cat_3', name: 'Team Apex', description: 'Voted for clarity, charm, and execution.', code: 'A2', image: '', order: 2, votes: 0 },
    { candidateId: 'cand_9', categoryId: 'cat_3', name: 'Team Vortex', description: 'High energy and audience engagement.', code: 'V1', image: '', order: 3, votes: 0 }
];

async function ensureCandidateIdentityIndex() {
    try {
        await Candidate.collection.dropIndex('candidateId_1');
    } catch (error) {
        // The legacy global unique index may not exist. Ignore this.
    }

    try {
        await Candidate.collection.createIndex({ candidateId: 1, categoryId: 1 }, { unique: true, name: 'candidate_id_category_unique' });
    } catch (error) {
        // The compound index may already exist or the collection may be empty.
    }
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

    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
        await Category.insertMany(defaultCategories);
    }

    await ensureCandidateIdentityIndex();

    const candidateCount = await Candidate.countDocuments();
    if (candidateCount === 0) {
        await Candidate.insertMany(defaultCandidates);
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

    createCategory: async function createCategory({ categoryId, name, image, order }) {
        const doc = await Category.create({
            categoryId: categoryId || `cat_${Date.now()}`,
            name: name || {},
            image: image || '',
            order: Number(order || 0)
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

    getCandidateById: async function getCandidateById(candidateId) {
        return Candidate.findOne({ candidateId }).lean();
    },

    createCandidate: async function createCandidate(payload = {}) {
        const candidateId = payload.candidateId || `candidate_${Date.now()}`;
        const categoryId = payload.categoryId || '';

        const duplicate = await Candidate.findOne({ candidateId, categoryId });
        if (duplicate) {
            throw new Error(`Candidate ID "${candidateId}" already exists in category "${categoryId}".`);
        }

        const candidate = await Candidate.create({
            candidateId,
            categoryId,
            name: payload.name || '',
            description: payload.description || '',
            code: payload.code || '',
            image: payload.image || '',
            order: Number(payload.order || 0),
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

        const nextCategoryId = payload.categoryId || candidate.categoryId;
        if (payload.categoryId && nextCategoryId !== candidate.categoryId) {
            const duplicate = await Candidate.findOne({ candidateId, categoryId: nextCategoryId });
            if (duplicate && duplicate._id.toString() !== candidate._id.toString()) {
                throw new Error(`Candidate ID "${candidateId}" already exists in category "${nextCategoryId}".`);
            }
        }

        if (payload.categoryId) {
            candidate.categoryId = nextCategoryId;
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

        if (user.voted) {
            return { success: false, error: 'This Telegram account has already voted.' };
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

        for (const { categoryId, candidateId } of selectedPairs) {
            await Candidate.updateOne(
                { categoryId, candidateId },
                { $inc: { votes: 1 } }
            );
        }

        user.voted = true;
        user.votedAt = new Date();
        await user.save();

        return {
            success: true,
            user: { telegramId: user.telegramId, voted: user.voted, votedAt: user.votedAt }
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