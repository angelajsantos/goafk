const mongoose = require('mongoose');

const EMAIL_PATTERN = /^(?=.{6,254}$)(?=.{1,64}@)(?!.*\.\.)([a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*)@((?!-)[a-zA-Z0-9-]+(?<!-)(?:\.(?!-)[a-zA-Z0-9-]+(?<!-))+)$/;
const normalizeUsername = (value = '') => value.trim().toLowerCase();

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true },
    usernameKey: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [EMAIL_PATTERN, 'Enter a valid email address.'],
    },
    password: { type: String, required: true },
    emailPreferences: {
        weeklySummary: { type: Boolean, default: true },
        breakInsights: { type: Boolean, default: true },
        productUpdates: { type: Boolean, default: false },
    },
    securityPreferences: {
        loginAlerts: { type: Boolean, default: true },
        sessionWarnings: { type: Boolean, default: true },
    },
    steam: {
        steamId: { type: String, trim: true },
        personaName: { type: String, trim: true },
        avatar: { type: String, trim: true },
        profileUrl: { type: String, trim: true },
        connectedAt: { type: Date },
        verified: { type: Boolean, default: false },
    },
}, { timestamps: true });

userSchema.index({ 'steam.steamId': 1 }, { unique: true, sparse: true });

userSchema.pre('validate', function setUsernameKey() {
    this.usernameKey = normalizeUsername(this.username);
});

module.exports = mongoose.model('User', userSchema);
