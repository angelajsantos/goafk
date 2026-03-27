const express = require('express');
const Session = require('../models/Session');
const jwt = require('jsonwebtoken');

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

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

const toDate = (value, fallback = new Date()) => {
    const candidate = value ? new Date(value) : fallback;
    return Number.isNaN(candidate.getTime()) ? fallback : candidate;
};

const getSessionSummary = (session) => {
    const reminders = Array.isArray(session.breakReminders) ? session.breakReminders : [];
    const breaksTaken = reminders.filter((entry) => entry.action === 'taken').length;
    const breaksSkipped = reminders.filter((entry) => entry.action === 'skipped').length;
    const totalBreakSeconds = reminders.reduce((sum, entry) => sum + Math.max(0, Number(entry.breakDurationSeconds) || 0), 0);
    const longestBreakSeconds = reminders.reduce(
        (longest, entry) => Math.max(longest, Math.max(0, Number(entry.breakDurationSeconds) || 0)),
        0,
    );

    return {
        breaksTaken,
        breaksSkipped,
        totalBreakSeconds,
        longestBreakSeconds,
    };
};

const applySummaryFields = (session) => {
    const summary = getSessionSummary(session);
    session.breaksTaken = summary.breaksTaken;
    session.breaksSkipped = summary.breaksSkipped;
    session.totalBreakSeconds = summary.totalBreakSeconds;
    session.longestBreakSeconds = summary.longestBreakSeconds;
    return session;
};

const finalizeSession = (session, payload = {}) => {
    const endedAt = toDate(payload.endTime || payload.endedAt, new Date());
    const pausedSeconds = Math.max(0, Number(payload.pausedSeconds) || 0);
    const startedAt = toDate(session.startedAt, endedAt);
    const wallClockSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
    const summary = getSessionSummary(session);
    const totalSeconds = Math.max(0, wallClockSeconds - pausedSeconds);

    session.endedAt = endedAt;
    session.durationSeconds = totalSeconds;
    session.durationMinutes = Math.floor(totalSeconds / 60);
    session.endingReason = payload.endingReason || session.endingReason || 'manual_end';
    session.breaksTaken = summary.breaksTaken;
    session.breaksSkipped = summary.breaksSkipped;
    session.totalBreakSeconds = summary.totalBreakSeconds;
    session.longestBreakSeconds = summary.longestBreakSeconds;

    return session;
};

const getCompletedSessions = (sessions) => sessions.filter((session) => session.endedAt);

const getRangeStart = (daysBack) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - daysBack);
    return date;
};

const getPeriodLabel = (hour) => {
    if (hour >= 0 && hour < 5) return 'Late night';
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
};

const sumDurationSeconds = (sessions) => sessions.reduce((sum, session) => sum + Math.max(0, Number(session.durationSeconds) || 0), 0);

const buildStreakDays = (completedSessions) => {
    const totalsByDate = new Map();

    completedSessions.forEach((session) => {
        const dayKey = toDate(session.startedAt).toISOString().slice(0, 10);
        const current = totalsByDate.get(dayKey) || 0;
        totalsByDate.set(dayKey, current + Math.max(0, Number(session.durationSeconds) || 0));
    });

    return Array.from(totalsByDate.entries())
        .map(([dateKey, durationSeconds]) => ({ dateKey, durationSeconds }))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

const buildLimitStreak = (completedSessions, dailyLimitMinutes) => {
    if (!(dailyLimitMinutes > 0)) {
        return null;
    }

    const limitSeconds = dailyLimitMinutes * 60;
    const totalsByDay = buildStreakDays(completedSessions);
    const compliantDayKeys = new Set(
        totalsByDay
            .filter((day) => day.durationSeconds <= limitSeconds)
            .map((day) => day.dateKey),
    );

    const compliantDays = totalsByDay.filter((day) => compliantDayKeys.has(day.dateKey));
    let best = 0;
    let currentRun = 0;
    let previousDate = null;

    compliantDays.forEach((day) => {
        const currentDate = new Date(`${day.dateKey}T00:00:00.000Z`);
        if (previousDate && currentDate - previousDate === DAY_MS) {
            currentRun += 1;
        } else {
            currentRun = 1;
        }

        best = Math.max(best, currentRun);
        previousDate = currentDate;
    });

    let current = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validDayKeys = new Set(compliantDays.map((day) => day.dateKey));
    let cursor = new Date(today);

    while (validDayKeys.has(cursor.toISOString().slice(0, 10))) {
        current += 1;
        cursor = new Date(cursor.getTime() - DAY_MS);
    }

    return {
        type: 'within_daily_limit',
        label: 'Days within daily limit',
        current,
        best,
    };
};

const buildSessionStreak = (completedSessions) => {
    let current = 0;
    let best = 0;

    completedSessions
        .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
        .forEach((session) => {
            if ((session.breaksTaken || 0) > 0) {
                current += 1;
                best = Math.max(best, current);
            } else {
                current = 0;
            }
        });

    const reverseOrdered = [...completedSessions].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    let trailing = 0;
    for (const session of reverseOrdered) {
        if ((session.breaksTaken || 0) > 0) {
            trailing += 1;
        } else {
            break;
        }
    }

    return {
        type: 'break_sessions',
        label: 'Sessions with a break',
        current: trailing,
        best,
    };
};

const buildStatistics = (sessions, dailyLimitMinutes) => {
    const completedSessions = getCompletedSessions(sessions);
    const weekStart = getRangeStart(6);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const weeklySessions = completedSessions.filter((session) => toDate(session.startedAt) >= weekStart);
    const monthlySessions = completedSessions.filter((session) => toDate(session.startedAt) >= monthStart);
    const totalPlaytimeSeconds = sumDurationSeconds(completedSessions);
    const totalBreaksTaken = completedSessions.reduce((sum, session) => sum + (session.breaksTaken || 0), 0);
    const totalBreaksSkipped = completedSessions.reduce((sum, session) => sum + (session.breaksSkipped || 0), 0);
    const longestSession = completedSessions.reduce((longest, session) => {
        if (!longest || (session.durationSeconds || 0) > (longest.durationSeconds || 0)) {
            return session;
        }
        return longest;
    }, null);
    const longestBreak = completedSessions.reduce((longest, session) => {
        const value = session.longestBreakSeconds || 0;
        if (!longest || value > longest.seconds) {
            return {
                seconds: value,
                gameName: session.gameName,
                sessionId: session._id,
            };
        }
        return longest;
    }, null);

    const gameTotals = completedSessions.reduce((map, session) => {
        const key = session.gameName || 'Gaming Session';
        const current = map.get(key) || 0;
        map.set(key, current + Math.max(0, Number(session.durationSeconds) || 0));
        return map;
    }, new Map());

    const mostPlayedGame = Array.from(gameTotals.entries()).reduce((top, entry) => {
        if (!top || entry[1] > top.totalSeconds) {
            return { gameName: entry[0], totalSeconds: entry[1] };
        }
        return top;
    }, null);

    const timePatterns = completedSessions.reduce((map, session) => {
        const period = getPeriodLabel(toDate(session.startedAt).getHours());
        map.set(period, (map.get(period) || 0) + 1);
        return map;
    }, new Map());

    const commonPlayTime = Array.from(timePatterns.entries()).reduce((top, entry) => {
        if (!top || entry[1] > top.count) {
            return { label: entry[0], count: entry[1] };
        }
        return top;
    }, null);

    const endingReasonCounts = completedSessions.reduce((counts, session) => {
        const reason = session.endingReason || 'manual_end';
        counts[reason] = (counts[reason] || 0) + 1;
        return counts;
    }, {});

    const streak = buildLimitStreak(completedSessions, dailyLimitMinutes) || buildSessionStreak(completedSessions);

    return {
        totals: {
            sessionsCompleted: completedSessions.length,
            totalPlaytimeSeconds,
            totalPlaytimeWeekSeconds: sumDurationSeconds(weeklySessions),
            totalPlaytimeMonthSeconds: sumDurationSeconds(monthlySessions),
            averageSessionSeconds: completedSessions.length ? Math.round(totalPlaytimeSeconds / completedSessions.length) : 0,
            totalBreaksTaken,
            totalBreaksSkipped,
            averageBreaksPerSession: completedSessions.length ? Number((totalBreaksTaken / completedSessions.length).toFixed(1)) : 0,
            longestSessionSeconds: longestSession?.durationSeconds || 0,
            longestBreakSeconds: longestBreak?.seconds || 0,
            endingReasonCounts,
        },
        highlights: {
            mostPlayedGame,
            commonPlayTime,
            longestSession: longestSession ? {
                id: longestSession._id,
                gameName: longestSession.gameName,
                durationSeconds: longestSession.durationSeconds || 0,
                startedAt: longestSession.startedAt,
                endedAt: longestSession.endedAt,
            } : null,
            longestBreak: longestBreak?.seconds ? longestBreak : null,
        },
        streak,
    };
};

router.post('/start', auth, async (req, res) => {
    try {
        const existingActive = await Session.findOne({ userId: req.userId, endedAt: null }).sort({ startedAt: -1 });
        if (existingActive) {
            return res.status(409).json({ error: 'An active session already exists.' });
        }

        const session = new Session({
            userId: req.userId,
            gameName: req.body.gameName || 'Gaming Session',
            startedAt: toDate(req.body.startTime || req.body.startedAt),
        });

        applySummaryFields(session);
        await session.save();
        res.json(session);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/:id/reminders', auth, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.userId.toString() !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        if (session.endedAt) return res.status(409).json({ error: 'Session already ended' });

        const action = req.body.action;
        if (!['taken', 'skipped'].includes(action)) {
            return res.status(400).json({ error: 'Invalid reminder action' });
        }

        const breakStartedAt = req.body.breakStartedAt ? toDate(req.body.breakStartedAt) : null;
        const breakEndedAt = req.body.breakEndedAt ? toDate(req.body.breakEndedAt) : null;
        const breakDurationSeconds = Math.max(
            0,
            Number(req.body.breakDurationSeconds)
            || (breakStartedAt && breakEndedAt ? Math.floor((breakEndedAt - breakStartedAt) / 1000) : 0),
        );

        session.breakReminders.push({
            remindedAt: toDate(req.body.remindedAt),
            action,
            breakType: req.body.breakType || null,
            breakStartedAt,
            breakEndedAt,
            breakDurationSeconds,
        });

        applySummaryFields(session);
        await session.save();
        res.json(session);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/stop/:id', auth, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.userId.toString() !== req.userId) return res.status(403).json({ error: 'Forbidden' });

        finalizeSession(session, req.body);
        await session.save();
        res.json(session);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/recent', auth, async (req, res) => {
    try {
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
        const sessions = await Session.find({ userId: req.userId, endedAt: { $ne: null } })
            .sort({ startedAt: -1 })
            .limit(limit);

        res.json(sessions);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/stats', auth, async (req, res) => {
    try {
        const sessions = await Session.find({ userId: req.userId, endedAt: { $ne: null } }).sort({ startedAt: -1 });
        const dailyLimitMinutes = Number(req.query.dailyLimitMinutes) || 0;
        res.json(buildStatistics(sessions, dailyLimitMinutes));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const sessions = await Session.find({ userId: req.userId }).sort({ startedAt: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
