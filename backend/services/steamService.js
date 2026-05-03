const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
const RESOLVE_VANITY_URL = 'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/';
const STEAM_ID_64_PATTERN = /^\d{17}$/;

const createSteamError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getSteamApiKey = () => {
    const apiKey = process.env.STEAM_API_KEY;

    if (!apiKey) {
        throw createSteamError('STEAM_API_KEY is not configured on the backend.', 500);
    }

    return apiKey;
};

const callSteamApi = async (url, action) => {
    let response;
    try {
        response = await fetch(url);
    } catch {
        throw createSteamError(`Unable to reach Steam API while ${action}.`, 502);
    }

    if (!response.ok) {
        const message = await response.text();
        throw createSteamError(`Steam API request failed with status ${response.status}: ${message}`, response.status);
    }

    try {
        return await response.json();
    } catch {
        throw createSteamError('Steam API returned an unreadable response.', 502);
    }
};

const parseSteamInput = (input) => {
    const value = String(input || '').trim();

    if (!value) {
        throw createSteamError('Enter a Steam profile URL or SteamID64.', 400);
    }

    if (STEAM_ID_64_PATTERN.test(value)) {
        return { steamId: value };
    }

    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    try {
        const url = new URL(withProtocol);
        const hostname = url.hostname.toLowerCase();
        const pathParts = url.pathname.split('/').filter(Boolean);
        const profileType = pathParts[0]?.toLowerCase();
        const profileValue = pathParts[1];

        if (hostname !== 'steamcommunity.com' && !hostname.endsWith('.steamcommunity.com')) {
            throw new Error('Not a Steam Community URL.');
        }

        if (profileType === 'profiles' && STEAM_ID_64_PATTERN.test(profileValue || '')) {
            return { steamId: profileValue };
        }

        if (profileType === 'id' && profileValue) {
            return { vanityUrl: decodeURIComponent(profileValue) };
        }
    } catch {
        throw createSteamError('Enter a valid SteamID64 or steamcommunity.com profile URL.', 400);
    }

    throw createSteamError('Enter a valid SteamID64 or steamcommunity.com profile URL.', 400);
};

const resolveVanityUrl = async (vanityUrl) => {
    const apiKey = getSteamApiKey();

    if (!vanityUrl) {
        throw createSteamError('A Steam vanity URL is required.', 400);
    }

    const url = new URL(RESOLVE_VANITY_URL);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('vanityurl', vanityUrl);

    const data = await callSteamApi(url, 'resolving Steam vanity URL');
    const result = data?.response;

    if (result?.success !== 1 || !result.steamid) {
        throw createSteamError(result?.message || 'Could not resolve that Steam vanity URL.', 400);
    }

    return result.steamid;
};

const resolveSteamIdFromInput = async (input) => {
    const parsedInput = parseSteamInput(input);

    if (parsedInput.steamId) {
        return parsedInput.steamId;
    }

    return resolveVanityUrl(parsedInput.vanityUrl);
};

const getPlayerSummaries = async (steamId64) => {
    const apiKey = getSteamApiKey();

    if (!steamId64) {
        throw createSteamError('A SteamID64 is required.', 400);
    }

    const url = new URL(PLAYER_SUMMARIES_URL);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('steamids', steamId64);

    return callSteamApi(url, 'fetching Steam profile');
};

module.exports = {
    getPlayerSummaries,
    resolveSteamIdFromInput,
    resolveVanityUrl,
};
