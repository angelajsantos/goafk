const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const EMAIL_PATTERN = /^(?=.{6,254}$)(?=.{1,64}@)(?!.*\.\.)([a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*)@((?!-)[a-zA-Z0-9-]+(?<!-)(?:\.(?!-)[a-zA-Z0-9-]+(?<!-))+)$/ 
const normalizeUsername = (value = '') => value.trim().toLowerCase()
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const isValidEmail = (email = '') => {
    if (!EMAIL_PATTERN.test(email)) {
        return false;
    }

    const domain = email.split('@')[1] || '';
    const topLevelDomain = domain.split('.').pop() || '';
    return topLevelDomain.length >= 2;
};

const validateSignupPayload = ({ username, email, password }) => {
    if (!username?.trim()) {
        return 'Please enter a username.';
    }

    if (!email?.trim()) {
        return 'Please enter an email address.';
    }

    if (!isValidEmail(normalizeEmail(email))) {
        return 'Please enter a valid email address.';
    }

    if (!password?.trim()) {
        return 'Please enter a password.';
    }

    if (password.trim().length < 6) {
        return 'Password must be at least 6 characters.';
    }

    return null;
};

const mapAuthError = (error) => {
    if (error?.code === 11000) {
        if (error.keyPattern?.email) {
            return 'That email is already in use.';
        }

        if (error.keyPattern?.username || error.keyPattern?.usernameKey) {
            return 'That username is already taken.';
        }

        return 'That account already exists.';
    }

    if (error?.name === 'ValidationError') {
        const firstMessage = Object.values(error.errors || {})[0]?.message;
        return firstMessage || 'Please check your details and try again.';
    }

    return error?.message || 'Something went wrong. Please try again.';
};

router.post('/signup', async (req, res) => {
    try {
        const username = req.body.username?.trim() || '';
        const usernameKey = normalizeUsername(username);
        const email = normalizeEmail(req.body.email);
        const password = req.body.password || '';

        const validationError = validateSignupPayload({ username, email, password });
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const existingEmailUser = await User.findOne({ email });
        if (existingEmailUser) {
            return res.status(400).json({ error: 'That email is already in use.' });
        }

        const existingUsernameUser = await User.findOne({
            username: {
                $regex: `^${escapeRegex(username)}$`,
                $options: 'i',
            },
        });

        if (existingUsernameUser) {
            return res.status(400).json({ error: 'That username is already taken.' });
        }

        const existingUsernameKeyUser = await User.findOne({ usernameKey });
        if (existingUsernameKeyUser) {
            return res.status(400).json({ error: 'That username is already taken.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, usernameKey, email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            userId: user._id,
            username: user.username,
            message: 'Account created successfully.',
        });
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

router.post('/login', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const password = req.body.password || '';

        if (!email || !password.trim()) {
            return res.status(400).json({ error: 'Please enter both email and password.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'We could not find an account with that email.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect password. Please try again.' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            userId: user._id,
            username: user.username,
            message: 'Signed in successfully.',
        });
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

module.exports = router;
