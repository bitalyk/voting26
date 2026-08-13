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
    scheduleNotificationsEnabled: { type: Boolean, default: false },
    allowedPrizes: { type: Boolean, default: false },
    wonPrizes: { type: [wonPrizeSchema], default: [] }
}, { timestamps: true });

telegramUserSchema.index({ username: 1 });

const mapLegendSchema = new Schema({
    eventTypeId: { type: String, required: true },
    customName: { type: Schema.Types.Mixed, default: {} },
    symbolIcon: { type: String, default: '' },
    order: { type: Number, default: 0 }
}, { _id: false });

const placedEventSchema = new Schema({
    instanceId: { type: String, required: true },
    eventTypeId: { type: String, required: true },
    xPercent: { type: Number, required: true, min: 0, max: 100 },
    yPercent: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const mapSchema = new Schema({
    mapId: { type: String, required: true, unique: true, index: true },
    name: { type: Schema.Types.Mixed, default: {} },
    imageUrl: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    legend: { type: [mapLegendSchema], default: [] },
    placedEvents: { type: [placedEventSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const mapEventTypeSchema = new Schema({
    eventTypeId: { type: String, required: true, unique: true, index: true },
    name: { type: Schema.Types.Mixed, default: {} },
    description: { type: Schema.Types.Mixed, default: {} },
    symbolIcon: { type: String, default: '' }
}, { timestamps: true });

const scheduleEventSchema = new Schema({
    eventId: { type: String, required: true, unique: true, index: true },
    title: { type: Schema.Types.Mixed, required: true },
    description: { type: Schema.Types.Mixed, default: {} },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, default: null },
    order: { type: Number, required: true, default: 0 },
    notified: { type: Boolean, default: false, index: true }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);
const Category = mongoose.model('Category', categorySchema);
const Candidate = mongoose.model('Candidate', candidateSchema);
const Prize = mongoose.model('Prize', prizeSchema);
const TelegramUser = mongoose.model('TelegramUser', telegramUserSchema);
const Map = mongoose.model('Map', mapSchema);
const MapEventType = mongoose.model('MapEventType', mapEventTypeSchema);
const ScheduleEvent = mongoose.model('ScheduleEvent', scheduleEventSchema);

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

function normalizeLocalizedValue(value, label, required = false) {
    if (typeof value === 'string') {
        const text = value.trim();
        if (required && !text) throw new Error(`${label} is required.`);
        return { en: text, ru: text, ro: text };
    }

    const localized = {
        en: String(value && value.en || '').trim(),
        ru: String(value && value.ru || '').trim(),
        ro: String(value && value.ro || '').trim()
    };
    if (required && !localized.en && !localized.ru && !localized.ro) throw new Error(`${label} is required.`);
    return localized;
}

function normalizeScheduleEventPayload(payload = {}) {
    const startTime = toDateValue(payload.startTime);
    if (!startTime) {
        throw new Error('A valid event start time is required.');
    }

    const hasEndTime = payload.endTime !== undefined && payload.endTime !== null && String(payload.endTime).trim() !== '';
    const endTime = hasEndTime ? toDateValue(payload.endTime) : null;
    if (hasEndTime && !endTime) {
        throw new Error('Event end time must be valid.');
    }
    if (endTime && endTime.getTime() <= startTime.getTime()) {
        throw new Error('Event end time must be after its start time.');
    }

    const title = normalizeLocalizedValue(payload.title, 'Event title', true);
    if (!title.en) {
        throw new Error('Event title in English is required.');
    }
    title.ru = title.ru || title.en;
    title.ro = title.ro || title.en;
    const description = normalizeLocalizedValue(payload.description, 'Event description');
    description.en = description.en || '';
    description.ru = description.ru || description.en;
    description.ro = description.ro || description.en;
    return { title, description, startTime, endTime };
}

function normalizePercent(value, label) {
    const percent = Number(value);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error(`${label} must be between 0 and 100.`);
    return Math.round(percent * 1000) / 1000;
}

function normalizeMapEditorPayload(payload = {}) {
    const instances = new Set();
    const placedEvents = Array.isArray(payload.placedEvents) ? payload.placedEvents.map((event) => {
        const instanceId = String(event && event.instanceId || '').trim();
        const eventTypeId = String(event && event.eventTypeId || '').trim();
        if (!instanceId || !eventTypeId || instances.has(instanceId)) throw new Error('Each placed event must have a unique instance and event type.');
        instances.add(instanceId);
        return { instanceId, eventTypeId, xPercent: normalizePercent(event.xPercent, 'Event X coordinate'), yPercent: normalizePercent(event.yPercent, 'Event Y coordinate') };
    }) : [];
    const legends = new Set();
    const legend = Array.isArray(payload.legend) ? payload.legend.map((item, index) => {
        const eventTypeId = String(item && item.eventTypeId || '').trim();
        if (!eventTypeId || legends.has(eventTypeId)) throw new Error('Legend entries must reference unique event types.');
        legends.add(eventTypeId);
        return { eventTypeId, customName: normalizeLocalizedValue(item.customName, 'Legend name'), symbolIcon: String(item.symbolIcon || '').trim(), order: Number.isFinite(Number(item.order)) ? Number(item.order) : index };
    }) : [];
    return { placedEvents, legend };
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

    getScheduleEvents: async function getScheduleEvents() {
        return ScheduleEvent.find({}).sort({ startTime: 1, eventId: 1 }).lean();
    },

    createScheduleEvent: async function createScheduleEvent(payload = {}) {
        const event = await ScheduleEvent.create({
            eventId: await generateUniqueFiveDigitId(ScheduleEvent, 'eventId'),
            ...normalizeScheduleEventPayload(payload),
            order: 0,
            notified: false
        });
        event.order = event.startTime.getTime();
        await event.save();
        return event.toObject();
    },

    updateScheduleEvent: async function updateScheduleEvent(eventId, payload = {}) {
        const normalizedEventId = String(eventId || '').trim();
        if (!/^\d{5}$/.test(normalizedEventId)) return null;
        const event = await ScheduleEvent.findOne({ eventId: normalizedEventId });
        if (!event) return null;
        const normalized = normalizeScheduleEventPayload({
            title: payload.title === undefined ? event.title : payload.title,
            description: payload.description === undefined ? event.description : payload.description,
            startTime: payload.startTime === undefined ? event.startTime : payload.startTime,
            endTime: payload.endTime === undefined ? event.endTime : payload.endTime
        });
        event.title = normalized.title;
        event.description = normalized.description;
        const startTimeChanged = event.startTime.getTime() !== normalized.startTime.getTime();
        event.startTime = normalized.startTime;
        event.endTime = normalized.endTime;
        event.order = normalized.startTime.getTime();
        if (startTimeChanged) event.notified = false;
        await event.save();
        return event.toObject();
    },

    deleteScheduleEvent: async function deleteScheduleEvent(eventId) {
        const result = await ScheduleEvent.deleteOne({ eventId: String(eventId || '').trim() });
        return result.deletedCount === 1;
    },

    getDueUnnotifiedScheduleEvents: async function getDueUnnotifiedScheduleEvents(now = new Date()) {
        return ScheduleEvent.find({ startTime: { $lte: now }, notified: false }).sort({ startTime: 1, eventId: 1 }).lean();
    },

    markScheduleEventNotified: async function markScheduleEventNotified(eventId) {
        const result = await ScheduleEvent.updateOne({ eventId: String(eventId || '').trim(), notified: false }, { $set: { notified: true } });
        return result.modifiedCount === 1;
    },

    getScheduleNotificationUsers: async function getScheduleNotificationUsers() {
        return TelegramUser.find({ scheduleNotificationsEnabled: true }).select('telegramId languageCode').lean();
    },

    updateScheduleNotifications: async function updateScheduleNotifications(telegramId, enabled) {
        const user = await TelegramUser.findOneAndUpdate(
            { telegramId: String(telegramId) },
            { $set: { scheduleNotificationsEnabled: Boolean(enabled) } },
            { new: true }
        );
        return user ? user.toObject() : null;
    },

    getMaps: async function getMaps() {
        return Map.find({}).sort({ isDefault: -1, createdAt: 1 }).lean();
    },

    getPublicMaps: async function getPublicMaps() {
        return Map.find({ isVisible: { $ne: false } }).sort({ isDefault: -1, createdAt: 1 }).lean();
    },

    getMapById: async function getMapById(mapId) {
        const normalizedMapId = String(mapId || '').trim();
        if (!/^\d{5}$/.test(normalizedMapId)) return null;
        return Map.findOne({ mapId: normalizedMapId }).lean();
    },

    createMap: async function createMap(payload = {}) {
        const map = await Map.create({
            mapId: await generateUniqueFiveDigitId(Map, 'mapId'),
            name: normalizeLocalizedValue(payload.name, 'Map name'),
            imageUrl: String(payload.imageUrl || '').trim(),
            isDefault: Boolean(payload.isDefault),
            isVisible: payload.isVisible !== false,
            legend: [],
            
            placedEvents: []
        });
        if (map.isDefault) await Map.updateMany({ _id: { $ne: map._id } }, { $set: { isDefault: false } });
        return map.toObject();
    },

    updateMap: async function updateMap(mapId, payload = {}) {
        const normalizedMapId = String(mapId || '').trim();
        if (!/^\d{5}$/.test(normalizedMapId)) return null;
        const map = await Map.findOne({ mapId: normalizedMapId });
        if (!map) return null;
        if (payload.name !== undefined) map.name = normalizeLocalizedValue(payload.name, 'Map name');
        if (payload.imageUrl !== undefined) map.imageUrl = String(payload.imageUrl || '').trim();
        if (payload.isDefault !== undefined) map.isDefault = Boolean(payload.isDefault);
        if (payload.isVisible !== undefined) map.isVisible = Boolean(payload.isVisible);
        if (payload.legend !== undefined || payload.placedEvents !== undefined) {
            const editor = normalizeMapEditorPayload({ legend: payload.legend === undefined ? map.legend : payload.legend, placedEvents: payload.placedEvents === undefined ? map.placedEvents : payload.placedEvents });
            const typeIds = [...new Set([...editor.legend.map((item) => item.eventTypeId), ...editor.placedEvents.map((item) => item.eventTypeId)])];
            const validTypes = await MapEventType.countDocuments({ eventTypeId: { $in: typeIds } });
            if (validTypes !== typeIds.length) throw new Error('One or more selected event types no longer exist.');
            map.legend = editor.legend;
            map.placedEvents = editor.placedEvents;
        }
        await map.save();
        if (map.isDefault) await Map.updateMany({ _id: { $ne: map._id } }, { $set: { isDefault: false } });
        return map.toObject();
    },

    deleteMap: async function deleteMap(mapId) {
        const normalizedMapId = String(mapId || '').trim();
        if (!/^\d{5}$/.test(normalizedMapId)) return false;
        const result = await Map.deleteOne({ mapId: normalizedMapId });
        return result.deletedCount === 1;
    },

    getMapEventTypes: async function getMapEventTypes() {
        return MapEventType.find({}).sort({ createdAt: 1 }).lean();
    },

    createMapEventType: async function createMapEventType(payload = {}) {
        const eventType = await MapEventType.create({
            eventTypeId: await generateUniqueFiveDigitId(MapEventType, 'eventTypeId'),
            name: normalizeLocalizedValue(payload.name, 'Event type name', true),
            description: normalizeLocalizedValue(payload.description, 'Event type description'),
            symbolIcon: String(payload.symbolIcon || '').trim()
        });
        return eventType.toObject();
    },

    updateMapEventType: async function updateMapEventType(eventTypeId, payload = {}) {
        const normalizedEventTypeId = String(eventTypeId || '').trim();
        if (!/^\d{5}$/.test(normalizedEventTypeId)) return null;
        const eventType = await MapEventType.findOne({ eventTypeId: normalizedEventTypeId });
        if (!eventType) return null;
        if (payload.name !== undefined) eventType.name = normalizeLocalizedValue(payload.name, 'Event type name', true);
        if (payload.description !== undefined) eventType.description = normalizeLocalizedValue(payload.description, 'Event type description');
        if (payload.symbolIcon !== undefined) eventType.symbolIcon = String(payload.symbolIcon || '').trim();
        await eventType.save();
        if (payload.symbolIcon !== undefined) await Map.updateMany({ 'legend.eventTypeId': eventType.eventTypeId }, { $set: { 'legend.$[entry].symbolIcon': eventType.symbolIcon } }, { arrayFilters: [{ 'entry.eventTypeId': eventType.eventTypeId }] });
        return eventType.toObject();
    },

    deleteMapEventType: async function deleteMapEventType(eventTypeId) {
        const normalizedEventTypeId = String(eventTypeId || '').trim();
        if (!/^\d{5}$/.test(normalizedEventTypeId)) return false;
        const result = await MapEventType.deleteOne({ eventTypeId: normalizedEventTypeId });
        if (result.deletedCount !== 1) return false;
        await Map.updateMany({}, { $pull: { placedEvents: { eventTypeId: normalizedEventTypeId }, legend: { eventTypeId: normalizedEventTypeId } } });
        return true;
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

    getTelegramUserCount: async function getTelegramUserCount() {
        return TelegramUser.countDocuments();
    },

    searchTelegramUsers: async function searchTelegramUsers(query, limit = 20) {
        const username = String(query || '').trim().replace(/^@/, '');
        if (!username) {
            return [];
        }

        const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return TelegramUser.find({ username: { $regex: escapedUsername, $options: 'i' } })
            .select('telegramId username allowedPrizes wonPrizes createdAt')
            .sort({ username: 1, createdAt: -1 })
            .limit(Math.min(Math.max(Number(limit) || 20, 1), 50))
            .lean();
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