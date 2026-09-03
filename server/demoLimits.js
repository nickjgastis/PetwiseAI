const crypto = require('crypto');

const COOKIE = 'pw_demo';
const QUERY_LIMIT = Number(process.env.DEMO_QUERY_LIMIT || 3);
const SOAP_LIMIT = Number(process.env.DEMO_SOAP_LIMIT || 3);
const IP_LIMIT = Number(process.env.DEMO_IP_DAILY_LIMIT || 15);
const SECRET = process.env.SECRET_SALT || process.env.CRON_SECRET || 'local-demo-secret';

const ipHits = new Map();
const sessions = new Map();

const todayUtc = () => new Date().toISOString().slice(0, 10);

const signId = (id) => {
    const body = Buffer.from(JSON.stringify({ id })).toString('base64url');
    const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    return `${body}.${mac}`;
};

const readId = (token) => {
    if (!token || !token.includes('.')) return null;
    const [body, mac] = token.split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const data = JSON.parse(Buffer.from(body, 'base64url').toString());
        return data.id || null;
    } catch {
        return null;
    }
};

const parseCookies = (header) => {
    const out = {};
    String(header || '').split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i === -1) return;
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
};

const clientIp = (req) => {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
};

const sessionOf = (id) => {
    const day = todayUtc();
    let row = sessions.get(id);
    if (!row || row.d !== day) {
        row = { q: 0, s: 0, d: day };
        sessions.set(id, row);
    } else if (row.s == null) {
        row.s = 0;
    }
    return row;
};

const ipCount = (ip) => {
    const day = todayUtc();
    const row = ipHits.get(ip);
    if (!row || row.d !== day) return 0;
    return row.n;
};

const bumpIp = (ip) => {
    const day = todayUtc();
    const row = ipHits.get(ip);
    if (!row || row.d !== day) ipHits.set(ip, { d: day, n: 1 });
    else row.n += 1;
};

const getState = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = req.headers['x-demo-token'] || cookies[COOKIE];
    const id = readId(token) || crypto.randomUUID();
    const row = sessionOf(id);
    return { id, token: signId(id), q: row.q, s: row.s || 0, ip: clientIp(req) };
};

const remainingQuery = (state) => Math.max(0, Math.min(QUERY_LIMIT - state.q, IP_LIMIT - ipCount(state.ip)));
const remainingSoap = (state) => Math.max(0, Math.min(SOAP_LIMIT - state.s, IP_LIMIT - ipCount(state.ip)));

const consumeQuery = (state) => {
    const row = sessionOf(state.id);
    row.q += 1;
    bumpIp(state.ip);
    return { ...state, q: row.q, s: row.s || 0 };
};

const consumeSoap = (state) => {
    const row = sessionOf(state.id);
    row.s += 1;
    bumpIp(state.ip);
    return { ...state, q: row.q, s: row.s };
};

const setCookie = (res, token) => {
    const prod = process.env.NODE_ENV === 'production';
    const parts = [
        `${COOKIE}=${token}`,
        'HttpOnly',
        'Path=/',
        'Max-Age=2592000',
        prod ? 'SameSite=None' : 'SameSite=Lax',
        prod ? 'Secure' : ''
    ].filter(Boolean);
    res.setHeader('Set-Cookie', parts.join('; '));
};

module.exports = {
    QUERY_LIMIT,
    SOAP_LIMIT,
    remaining: remainingQuery,
    remainingQuery,
    remainingSoap,
    consume: consumeQuery,
    consumeQuery,
    consumeSoap,
    getState,
    setCookie
};
