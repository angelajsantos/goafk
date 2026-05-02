const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const EMAIL_PATTERN = /^(?=.{6,254}$)(?=.{1,64}@)(?!.*\.\.)([a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*)@((?!-)[a-zA-Z0-9-]+(?<!-)(?:\.(?!-)[a-zA-Z0-9-]+(?<!-))+)$/ 
const normalizeUsername = (value = '') => value.trim().toLowerCase()
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};

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

const getUserPayload = (user) => ({
    userId: user._id,
    username: user.username,
    email: user.email,
    emailPreferences: {
        weeklySummary: user.emailPreferences?.weeklySummary ?? true,
        breakInsights: user.emailPreferences?.breakInsights ?? true,
        productUpdates: user.emailPreferences?.productUpdates ?? false,
    },
    securityPreferences: {
        loginAlerts: user.securityPreferences?.loginAlerts ?? true,
        sessionWarnings: user.securityPreferences?.sessionWarnings ?? true,
    },
});

router.get('/public-stats', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        res.json({ userCount });
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

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
        const userCount = await User.countDocuments();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            ...getUserPayload(user),
            userCount,
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
            ...getUserPayload(user),
            message: 'Signed in successfully.',
        });
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        res.json(getUserPayload(user));
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

router.put('/profile', auth, async (req, res) => {
    try {
        const username = req.body.username?.trim() || '';
        if (!username) {
            return res.status(400).json({ error: 'Please enter a display name.' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        const existingUsernameUser = await User.findOne({
            _id: { $ne: req.userId },
            username: {
                $regex: `^${escapeRegex(username)}$`,
                $options: 'i',
            },
        });

        if (existingUsernameUser) {
            return res.status(400).json({ error: 'That username is already taken.' });
        }

        user.username = username;
        await user.save();

        res.json({
            ...getUserPayload(user),
            message: 'Profile updated.',
        });
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

router.put('/password', auth, async (req, res) => {
    try {
        const currentPassword = req.body.currentPassword || '';
        const nextPassword = req.body.newPassword || '';

        if (!currentPassword.trim() || !nextPassword.trim()) {
            return res.status(400).json({ error: 'Please enter both your current and new password.' });
        }

        if (nextPassword.trim().length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect.' });
        }

        user.password = await bcrypt.hash(nextPassword, 10);
        await user.save();

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

router.put('/preferences/email', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        user.emailPreferences = {
            weeklySummary: Boolean(req.body.weeklySummary),
            breakInsights: Boolean(req.body.breakInsights),
            productUpdates: Boolean(req.body.productUpdates),
        };

        await user.save();
        res.json({
            emailPreferences: getUserPayload(user).emailPreferences,
            message: 'Email preferences saved.',
        });
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

router.put('/preferences/security', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        user.securityPreferences = {
            loginAlerts: Boolean(req.body.loginAlerts),
            sessionWarnings: Boolean(req.body.sessionWarnings),
        };

        await user.save();
        res.json({
            securityPreferences: getUserPayload(user).securityPreferences,
            message: 'Security preferences saved.',
        });
    } catch (error) {
        res.status(400).json({ error: mapAuthError(error) });
    }
});

module.exports = router;
