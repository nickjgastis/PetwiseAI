const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

let getAccessToken = async () => null;

export function bindSupabaseAccessToken(getter) {
    getAccessToken = getter;
}

async function execute(state) {
    try {
        const token = await getAccessToken();
        if (!token) {
            return { data: null, error: { message: 'Not authenticated', code: '401' } };
        }
        const res = await fetch(`${API_URL}/api/db`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(state),
        });
        const json = await res.json().catch(() => null);
        if (!json || typeof json !== 'object') {
            return { data: null, error: { message: `API ${res.status}`, code: String(res.status) } };
        }
        return json;
    } catch (err) {
        return { data: null, error: { message: err?.message || 'Network error', code: 'NETWORK' } };
    }
}

function from(table) {
    const state = {
        table,
        method: 'select',
        columns: '*',
        filters: [],
        data: null,
        order: null,
        limit: null,
        single: false,
        maybeSingle: false,
        onConflict: null,
    };

    const api = {
        select(cols = '*') {
            state.columns = cols;
            return api;
        },
        insert(data) {
            state.method = 'insert';
            state.data = data;
            return api;
        },
        update(data) {
            state.method = 'update';
            state.data = data;
            return api;
        },
        upsert(data, opts = {}) {
            state.method = 'upsert';
            state.data = data;
            state.onConflict = opts.onConflict || null;
            return api;
        },
        delete() {
            state.method = 'delete';
            return api;
        },
        eq(k, v) {
            state.filters.push({ op: 'eq', k, v });
            return api;
        },
        in(k, v) {
            state.filters.push({ op: 'in', k, v });
            return api;
        },
        is(k, v) {
            state.filters.push({ op: 'is', k, v });
            return api;
        },
        order(col, opts = {}) {
            state.order = { col, ascending: opts.ascending !== false };
            return api;
        },
        limit(n) {
            state.limit = n;
            return api;
        },
        single() {
            state.single = true;
            return api;
        },
        maybeSingle() {
            state.maybeSingle = true;
            return api;
        },
        then(resolve, reject) {
            return execute(state).then(resolve, reject);
        },
    };

    return api;
}

function channel() {
    return {
        on() { return this; },
        subscribe() { return { unsubscribe() {} }; },
        unsubscribe() {},
    };
}

export const supabase = { from, channel };
