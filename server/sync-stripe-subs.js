// Reconcile Supabase subscription fields with Stripe (live).
// Dry run by default; pass --apply to write. Users without a stripe_customer_id (comps) are skipped.
//   node sync-stripe-subs.js [--apply]
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];
const INTERVALS = { month: 'monthly', year: 'yearly' };

async function main() {
    const subsByCustomer = new Map();
    for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
        if (!LIVE_STATUSES.includes(s.status)) continue;
        const list = subsByCustomer.get(s.customer) || [];
        list.push(s);
        subsByCustomer.set(s.customer, list);
    }

    const users = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, stripe_customer_id, subscription_status, subscription_interval, subscription_end_date, cancel_at_period_end')
            .not('stripe_customer_id', 'is', null)
            .range(from, from + 999);
        if (error) throw error;
        users.push(...data);
        if (data.length < 1000) break;
    }

    let changed = 0;
    for (const u of users) {
        const subs = subsByCustomer.get(u.stripe_customer_id) || [];
        const sub = subs.find((s) => s.status === 'active') || subs[0];
        let patch = {};

        if (!sub) {
            if (u.subscription_status === 'active' || u.subscription_status === 'past_due') {
                patch = { subscription_status: 'inactive', subscription_interval: null, cancel_at_period_end: false };
            }
        } else if (sub.status !== 'trialing') {
            const item = sub.items.data[0];
            const periodEnd = sub.current_period_end || item.current_period_end;
            const want = {
                subscription_status: sub.status,
                subscription_interval: INTERVALS[item.price.recurring.interval] || u.subscription_interval,
                cancel_at_period_end: sub.cancel_at_period_end,
                subscription_end_date: new Date(periodEnd * 1000).toISOString()
            };
            for (const [k, v] of Object.entries(want)) {
                const cur = u[k];
                const same = k === 'subscription_end_date'
                    ? cur && Math.abs(new Date(cur) - new Date(v)) < 60 * 1000
                    : cur === v;
                if (!same) patch[k] = v;
            }
        }

        if (!Object.keys(patch).length) continue;
        changed++;
        const diff = Object.entries(patch).map(([k, v]) => `${k}: ${u[k]} -> ${v}`).join(', ');
        console.log(`${u.email} (${u.stripe_customer_id})\n    ${diff}`);
        if (APPLY) {
            const { error } = await supabase.from('users').update(patch).eq('id', u.id);
            if (error) console.error('    update failed:', error.message);
        }
    }

    console.log(`\n${changed} user(s) out of sync${APPLY ? ', updated' : ' (dry run, pass --apply to write)'}`);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
