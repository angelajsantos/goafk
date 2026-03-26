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
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.userId.toString() !== req.userId) return res.status(403).json({ error: 'Forbidden' });

        session.endedAt = new Date();
        const wallClockSeconds = Math.floor((session.endedAt - session.startedAt) / 1000);
        const pausedSeconds = Math.max(0, Number(req.body?.pausedSeconds) || 0);
        const totalSeconds = Math.max(0, wallClockSeconds - pausedSeconds);
        session.durationSeconds = totalSeconds;
        session.durationMinutes = Math.floor(totalSeconds / 60);
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
