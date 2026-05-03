const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const RESOLVE_VANITY_URL = 'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/';
const STEAM_OPENID_LOGIN_URL = 'https://steamcommunity.com/openid/login';
const STEAM_OPENID_IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const STEAM_OPENID_CLAIMED_ID_PATTERN = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
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

const getQueryValue = (query, key) => {
    const value = query?.[key];
    return Array.isArray(value) ? value[0] : value;
};

const buildSteamOpenIdUrl = ({ returnTo, realm }) => {
    const url = new URL(STEAM_OPENID_LOGIN_URL);
    url.searchParams.set('openid.ns', 'http://specs.openid.net/auth/2.0');
    url.searchParams.set('openid.mode', 'checkid_setup');
    url.searchParams.set('openid.return_to', returnTo);
    url.searchParams.set('openid.realm', realm);
    url.searchParams.set('openid.identity', STEAM_OPENID_IDENTIFIER_SELECT);
    url.searchParams.set('openid.claimed_id', STEAM_OPENID_IDENTIFIER_SELECT);

    return url.toString();
};

const verifySteamOpenIdResponse = async (query) => {
    const mode = getQueryValue(query, 'openid.mode');
    const claimedId = getQueryValue(query, 'openid.claimed_id');
    const identity = getQueryValue(query, 'openid.identity');
    const claimedIdMatch = claimedId?.match(STEAM_OPENID_CLAIMED_ID_PATTERN);

    if (mode !== 'id_res') {
        throw createSteamError('Steam OpenID response was not a successful sign-in assertion.', 400);
    }

    if (!claimedIdMatch || identity !== claimedId) {
        throw createSteamError('Steam OpenID response did not include a valid SteamID.', 400);
    }

    const params = new URLSearchParams();
    Object.keys(query || {})
        .filter((key) => key.startsWith('openid.') && key !== 'openid.mode')
        .forEach((key) => {
            params.set(key, getQueryValue(query, key));
        });
    params.set('openid.mode', 'check_authentication');

    let response;
    try {
        response = await fetch(STEAM_OPENID_LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });
    } catch {
        throw createSteamError('Unable to verify Steam OpenID response.', 502);
    }

    if (!response.ok) {
        throw createSteamError(`Steam OpenID verification failed with status ${response.status}.`, response.status);
    }

    const verificationText = await response.text();
    if (!/^is_valid:true$/m.test(verificationText)) {
        throw createSteamError('Steam OpenID verification was rejected.', 401);
    }

    return claimedIdMatch[1];
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

const getOwnedGames = async (steamId64) => {
    const apiKey = getSteamApiKey();

    if (!steamId64) {
        throw createSteamError('A SteamID64 is required.', 400);
    }

    const url = new URL(OWNED_GAMES_URL);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('steamid', steamId64);
    url.searchParams.set('include_appinfo', '1');
    url.searchParams.set('include_played_free_games', '1');

    return callSteamApi(url, 'fetching Steam games');
};

module.exports = {
    buildSteamOpenIdUrl,
    getOwnedGames,
    getPlayerSummaries,
    resolveSteamIdFromInput,
    resolveVanityUrl,
    verifySteamOpenIdResponse,
};
