// Loads active Stripe-paying users into a Resend audience and creates the weekend-upgrade broadcast as a draft.
// Never sends. Read-only against Supabase.
//   node scripts/upgrade-email-draft.js          dry run: counts only
//   node scripts/upgrade-email-draft.js --apply  create audience, contacts and draft broadcast
// Needs RESEND_ADMIN_API_KEY (full access); the app's RESEND_API_KEY is send-only.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const AUDIENCE_NAME = 'Paying customers, Oct 2026';
const BROADCAST_NAME = 'Weekend upgrade: cases, dental, new look';
const SUBJECT = 'PetWise is getting a big upgrade this weekend';
const PREVIEW = 'Cases, dental charts and a whole new look. No downtime, nothing to do.';
const REPLY_TO = 'support@petwise.vet';
// nickname is skipped: Auth0 fills it from the email, so it makes greetings like "Hi Drjsmith42".
const NAME_COLUMNS = ['first_name', 'given_name', 'full_name', 'name', 'display_name'];

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const resend = async (method, url, body) => {
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(`https://api.resend.com${url}`, {
            method,
            headers: { Authorization: `Bearer ${process.env.RESEND_ADMIN_API_KEY}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        if (res.status === 429) {
            await sleep(1000 * (attempt + 1));
            continue;
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${method} ${url} ${res.status}: ${json.message || JSON.stringify(json)}`);
        return json;
    }
    throw new Error(`${method} ${url}: rate limited`);
};

const firstName = (u, col) => {
    const raw = (col && u[col]) || '';
    const first = String(raw).trim().split(/\s+/)[0] || '';
    if (!first || first.includes('@') || first.length > 30) return undefined;
    return first.charAt(0).toUpperCase() + first.slice(1);
};

async function loadUsers() {
    const { data: sample, error: sErr } = await supabase.from('users').select('*').limit(1);
    if (sErr) throw sErr;
    const cols = Object.keys(sample[0] || {});
    const nameCol = NAME_COLUMNS.find((c) => cols.includes(c));
    const select = ['email', nameCol].filter(Boolean).join(', ');

    const users = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from('users')
            .select(select)
            .eq('subscription_status', 'active')
            .not('stripe_customer_id', 'is', null)
            .range(from, from + 999);
        if (error) throw error;
        users.push(...data);
        if (data.length < 1000) break;
    }
    const seen = new Set();
    const unique = users.filter((u) => {
        const e = (u.email || '').trim().toLowerCase();
        if (!e || !e.includes('@') || seen.has(e)) return false;
        seen.add(e);
        return true;
    });
    return { users: unique, nameCol, total: users.length };
}

async function main() {
    const { users, nameCol, total } = await loadUsers();
    const named = users.filter((u) => firstName(u, nameCol)).length;
    console.log(`name column: ${nameCol || 'none'}`);
    console.log(`active paying rows: ${total}, unique emails: ${users.length}, with first name: ${named}`);
    if (!APPLY) return console.log('dry run, nothing created. Re-run with --apply.');
    if (!process.env.RESEND_ADMIN_API_KEY) throw new Error('Set RESEND_ADMIN_API_KEY (full access key) in .env');

    const audience = await resend('POST', '/audiences', { name: AUDIENCE_NAME });
    console.log(`audience created: ${AUDIENCE_NAME}`);

    let added = 0;
    for (const u of users) {
        await resend('POST', `/audiences/${audience.id}/contacts`, { email: u.email.trim().toLowerCase(), first_name: firstName(u, nameCol), unsubscribed: false });
        added++;
        if (added % 25 === 0) console.log(`  contacts: ${added}/${users.length}`);
        await sleep(550);
    }
    console.log(`contacts added: ${added}`);

    const html = fs.readFileSync(path.join(__dirname, '../emails/weekend-upgrade.html'), 'utf8');
    const broadcast = await resend('POST', '/broadcasts', {
        audience_id: audience.id,
        from: process.env.RESEND_FROM_EMAIL,
        reply_to: REPLY_TO,
        subject: SUBJECT,
        preview_text: PREVIEW,
        name: BROADCAST_NAME,
        html
    });
    console.log(`draft broadcast created: ${BROADCAST_NAME} (${broadcast.id}). Not sent.`);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
