const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getPlayerSummaries, resolveSteamIdFromInput } = require('../services/steamService');

const router = express.Router();

const TEST_STEAM_ID_64 = '76561197960435530';

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

const getSteamProfileFromResponse = (data) => {
    const player = data?.response?.players?.[0];

    if (!player) {
        const error = new Error('No Steam profile was found for that input.');
        error.statusCode = 404;
        throw error;
    }

    if (player.communityvisibilitystate && player.communityvisibilitystate !== 3) {
        const error = new Error('Steam profile found, but the profile details are private.');
        error.statusCode = 403;
        throw error;
    }

    return {
        steamId: player.steamid,
        personaname: player.personaname,
        avatar: player.avatarfull || player.avatarmedium || player.avatar,
        profileUrl: player.profileurl || `https://steamcommunity.com/profiles/${player.steamid}`,
    };
};

router.get('/test', async (req, res) => {
    try {
        const data = await getPlayerSummaries(TEST_STEAM_ID_64);
        res.json(data);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: error.message || 'Steam API request failed.',
        });
    }
});

router.post('/connect', auth, async (req, res) => {
    try {
        const steamInput = req.body.steamId || req.body.steamProfileUrl || req.body.profileUrl || req.body.input;
        const steamId = await resolveSteamIdFromInput(steamInput);
        const data = await getPlayerSummaries(steamId);
        const steamProfile = getSteamProfileFromResponse(data);
        const connectedSteamProfile = {
            ...steamProfile,
            connectedAt: new Date(),
        };

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        user.steam = connectedSteamProfile;
        await user.save();

        res.json({
            steam: connectedSteamProfile,
            message: 'Steam account connected.',
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: error.message || 'Unable to connect Steam account.',
        });
    }
});

module.exports = router;
