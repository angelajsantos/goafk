const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    durationMinutes: { type: Number },
    gameName: { type: String, default: 'Gaming Session' },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);