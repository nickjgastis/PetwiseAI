// Meta Conversions API. Fail-open: missing token or API errors never throw
// to callers. Unset META_CAPI_TOKEN = no server events sent.

const crypto = require('crypto');
const fetch = require('node-fetch');

const PIXEL_ID = process.env.META_PIXEL_ID || '691293719968426';
const TOKEN = process.env.META_CAPI_TOKEN;
const TEST_CODE = process.env.META_TEST_EVENT_CODE;
const API_VERSION = 'v21.0';

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const norm = (v) => (v ? String(v).trim().toLowerCase() : '');
const hash = (v) => (norm(v) ? sha256(norm(v)) : undefined);
const hashPhone = (v) => {
    const digits = String(v || '').replace(/\D/g, '');
    if (!digits) return undefined;
    // Meta needs country code; bare 10-digit numbers are US/CA.
    return sha256(digits.length === 10 ? `1${digits}` : digits);
};

const clientIp = (req) =>
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

const reqContext = (req) => ({
    ip: clientIp(req),
    ua: req.headers['user-agent'],
});

const sendEvent = async ({ eventName, eventId, sourceUrl, user = {}, customData, actionSource = 'website' }) => {
    if (!TOKEN) return;
    const [first, ...rest] = norm(user.name).split(/\s+/);
    const userData = {
        em: hash(user.email) && [hash(user.email)],
        ph: hashPhone(user.phone) && [hashPhone(user.phone)],
        external_id: hash(user.externalId) && [hash(user.externalId)],
        fn: hash(first),
        ln: hash(rest.join(' ')),
        fbp: user.fbp || undefined,
        fbc: user.fbc || undefined,
        client_ip_address: user.ip || undefined,
        client_user_agent: user.ua || undefined,
    };
    const body = {
        data: [{
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            event_source_url: sourceUrl,
            action_source: actionSource,
            user_data: userData,
            custom_data: customData,
        }],
        ...(TEST_CODE && { test_event_code: TEST_CODE }),
    };
    try {
        const res = await fetch(
            `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${TOKEN}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), timeout: 8000 }
        );
        if (!res.ok) console.error('Meta CAPI error:', res.status, await res.text());
    } catch (err) {
        console.error('Meta CAPI request failed:', err.message);
    }
};

module.exports = { sendEvent, reqContext };
