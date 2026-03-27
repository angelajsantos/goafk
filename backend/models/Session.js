const mongoose = require('mongoose');

const breakReminderSchema = new mongoose.Schema({
    remindedAt: { type: Date, default: Date.now },
    action: {
        type: String,
        enum: ['taken', 'skipped'],
        required: true,
    },
    breakType: {
        type: String,
        enum: ['countdown', 'indefinite'],
        default: null,
    },
    breakStartedAt: { type: Date, default: null },
    breakEndedAt: { type: Date, default: null },
    breakDurationSeconds: { type: Number, default: 0 },
}, { _id: true });

const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    durationMinutes: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    gameName: { type: String, default: 'Gaming Session' },
    endingReason: {
        type: String,
        enum: ['manual_end', 'limit_reached', 'inactive_timeout', 'continued_after_reminder'],
        default: 'manual_end',
    },
    breakReminders: {
        type: [breakReminderSchema],
        default: [],
    },
    breaksTaken: { type: Number, default: 0 },
    breaksSkipped: { type: Number, default: 0 },
    longestBreakSeconds: { type: Number, default: 0 },
    totalBreakSeconds: { type: Number, default: 0 },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

sessionSchema.virtual('startTime')
    .get(function getStartTime() {
        return this.startedAt;
    })
    .set(function setStartTime(value) {
        this.startedAt = value;
    });

sessionSchema.virtual('endTime')
    .get(function getEndTime() {
        return this.endedAt;
    })
    .set(function setEndTime(value) {
        this.endedAt = value;
    });

module.exports = mongoose.model('Session', sessionSchema);
