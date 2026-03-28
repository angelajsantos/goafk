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
}, { timestamps: true });

userSchema.pre('validate', function setUsernameKey(next) {
    this.usernameKey = normalizeUsername(this.username);
    next();
});

module.exports = mongoose.model('User', userSchema);
