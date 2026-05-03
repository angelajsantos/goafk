const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
    buildSteamOpenIdUrl,
    getOwnedGames,
    getPlayerSummaries,
    resolveSteamIdFromInput,
    verifySteamOpenIdResponse,
} = require('../services/steamService');

const router = express.Router();

const TEST_STEAM_ID_64 = '76561197960435530';
const STEAM_STATE_PURPOSE = 'steam-connect';
const STEAM_STATE_EXPIRES_IN = '10m';

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

const getRequestValue = (query, key) => {
    const value = query?.[key];
    return Array.isArray(value) ? value[0] : value;
};

const createHttpError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getApiBaseUrl = (req) => (
    process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`
).replace(/\/+$/, '');

const getFrontendSettingsUrl = (params = {}) => {
    const frontendBaseUrl = (process.env.STEAM_AUTH_REDIRECT_URL || process.env.FRONTEND_URL || 'http://localhost:5173')
        .replace(/\/+$/, '');
    const url = new URL('/settings', frontendBaseUrl);

    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
};

const createSteamStateToken = (userId) => jwt.sign(
    {
        userId,
        purpose: STEAM_STATE_PURPOSE,
    },
    process.env.JWT_SECRET,
    { expiresIn: STEAM_STATE_EXPIRES_IN },
);

const verifySteamStateToken = (state) => {
    if (!state) {
        throw createHttpError('Missing Steam connection state.', 400);
    }

    let decoded;
    try {
        decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch {
        throw createHttpError('Steam sign-in expired. Please try again.', 400);
    }

    if (decoded.purpose !== STEAM_STATE_PURPOSE || !decoded.userId) {
        throw createHttpError('Invalid Steam connection state.', 400);
    }

    return decoded;
};

const assertOpenIdReturnToMatchesState = (req, state) => {
    const returnTo = getRequestValue(req.query, 'openid.return_to');
    if (!returnTo) {
        throw createHttpError('Steam OpenID response did not include a return URL.', 400);
    }

    const returnToUrl = new URL(returnTo);
    if (returnToUrl.searchParams.get('state') !== state) {
        throw createHttpError('Steam OpenID response state did not match this connection request.', 400);
    }
};

const getSteamProfileFromResponse = (data) => {
    const player = data?.response?.players?.[0];

    if (!player) {
        throw createHttpError('No Steam profile was found for that account.', 404);
    }

    return {
        steamId: player.steamid,
        personaName: player.personaname,
        avatar: player.avatarfull || player.avatarmedium || player.avatar,
        profileUrl: player.profileurl || `https://steamcommunity.com/profiles/${player.steamid}`,
    };
};

const getSteamImageUrl = (appId, imageHash) => {
    if (!appId || !imageHash) {
        return null;
    }

    return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${imageHash}.jpg`;
};

const getSteamGamesFromResponse = (data) => {
    const response = data?.response;
    const games = response?.games;

    if (Array.isArray(games)) {
        return games.map((game) => ({
            appId: game.appid,
            name: game.name || 'Untitled Steam Game',
            playtimeForever: game.playtime_forever || 0,
            playtime2Weeks: game.playtime_2weeks || 0,
            icon: getSteamImageUrl(game.appid, game.img_icon_url),
            logo: getSteamImageUrl(game.appid, game.img_logo_url),
        }));
    }

    if (response?.game_count === 0) {
        return [];
    }

    throw createHttpError('Your Steam profile is private or your game details are not public.', 403);
};

const getSteamAuthEntryUrl = (req, state) => {
    const url = new URL('/api/steam/auth', getApiBaseUrl(req));
    url.searchParams.set('state', state);
    return url.toString();
};

const getSteamOpenIdRedirectUrl = (req, state) => {
    const callbackUrl = new URL('/api/steam/callback', getApiBaseUrl(req));
    callbackUrl.searchParams.set('state', state);

    return buildSteamOpenIdUrl({
        returnTo: callbackUrl.toString(),
        realm: getApiBaseUrl(req),
    });
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

router.get('/games', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        if (!user.steam?.steamId || !user.steam?.verified) {
            return res.status(400).json({ error: 'Connect your Steam account before importing games.' });
        }

        const data = await getOwnedGames(user.steam.steamId);
        const games = getSteamGamesFromResponse(data);

        res.json({
            games,
            gameCount: games.length,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: statusCode === 403
                ? 'Your Steam profile is private or your game details are not public.'
                : error.message || 'Unable to import Steam games.',
        });
    }
});

router.delete('/disconnect', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        user.set('steam', undefined);
        await user.save();

        res.json({
            steam: null,
            message: 'Steam account disconnected.',
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: error.message || 'Unable to disconnect Steam account.',
        });
    }
});

router.get('/auth/state', auth, (req, res) => {
    try {
        const state = createSteamStateToken(req.userId);

        res.json({
            authUrl: getSteamAuthEntryUrl(req, state),
            expiresInSeconds: 600,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: error.message || 'Unable to start Steam authentication.',
        });
    }
});

router.get('/auth', (req, res) => {
    try {
        let state = getRequestValue(req.query, 'state');

        if (!state) {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.redirect(getFrontendSettingsUrl({
                    steam_error: 'Please sign in before connecting Steam.',
                }));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            state = createSteamStateToken(decoded.userId);
        }

        verifySteamStateToken(state);
        res.redirect(getSteamOpenIdRedirectUrl(req, state));
    } catch (error) {
        res.redirect(getFrontendSettingsUrl({
            steam_error: error.message || 'Unable to start Steam authentication.',
        }));
    }
});

router.get('/callback', async (req, res) => {
    try {
        const state = getRequestValue(req.query, 'state');
        const decodedState = verifySteamStateToken(state);
        assertOpenIdReturnToMatchesState(req, state);
        const steamId = await verifySteamOpenIdResponse(req.query);
        const profileData = await getPlayerSummaries(steamId);
        const steamProfile = getSteamProfileFromResponse(profileData);

        const user = await User.findById(decodedState.userId);
        if (!user) {
            throw createHttpError('Account not found.', 404);
        }

        const existingSteamUser = await User.findOne({
            _id: { $ne: user._id },
            'steam.steamId': steamId,
        });
        if (existingSteamUser) {
            throw createHttpError('That Steam account is already connected to another GoAFK account.', 409);
        }

        user.steam = {
            ...steamProfile,
            connectedAt: new Date(),
            verified: true,
        };
        await user.save();

        res.redirect(getFrontendSettingsUrl({ steam: 'connected' }));
    } catch (error) {
        const message = error?.code === 11000
            ? 'That Steam account is already connected to another GoAFK account.'
            : error.message || 'Unable to connect Steam account.';
        res.redirect(getFrontendSettingsUrl({ steam_error: message }));
    }
});

router.post('/connect', auth, (req, res) => {
    res.status(410).json({
        error: 'Manual Steam linking is disabled. Use Sign in with Steam to verify account ownership.',
    });
});

router.post('/preview', auth, async (req, res) => {
    try {
        const steamInput = req.body.steamId || req.body.steamProfileUrl || req.body.profileUrl || req.body.input;
        const steamId = await resolveSteamIdFromInput(steamInput);
        const data = await getPlayerSummaries(steamId);

        res.json({
            steam: {
                ...getSteamProfileFromResponse(data),
                verified: false,
            },
            message: 'Steam profile preview loaded. Use Sign in with Steam to connect it.',
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: error.message || 'Unable to preview Steam profile.',
        });
    }
});

module.exports = router;
