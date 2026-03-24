const express = require('express');
const Session = require('../models/Session');
const jwt = require('jsonwebtoken');
const router = express.Router();

// middleware to verify token
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

// start a session
router.post('/start', auth, async (req, res) => {
    try {
        const session = new Session({ userId: req.userId, gameName: req.body.gameName });
        await session.save();
        res.json(session);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// stop a session
router.put('/stop/:id', auth, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);
        session.endedAt = new Date();
        session.durationMinutes = Math.round((session.endedAt - session.startedAt) / 60000);
        await session.save();
        res.json(session);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// get all sessions for a user
router.get('/', auth, async (req, res) => {
    try {
        const sessions = await Session.find({ userId: req.userId }).sort({ startedAt: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;