const express = require('express');
const fetch = require('node-fetch');
const { TRIAL_DAYS } = require('../usage');
const hubspot = require('../utils/hubspot');

const router = express.Router();

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || process.env.REACT_APP_AUTH0_DOMAIN;
const tokenCache = new Map();

const TABLES = new Set(['users', 'saved_reports', 'templates', 'onboarding', 'cases']);
const METHODS = new Set(['select', 'insert', 'update', 'upsert', 'delete']);

const USERS_WRITE = new Set([
    'nickname',
    'email',
    'dvm_name',
    'phone_number',
    'has_accepted_terms',
    'has_completed_onboarding',
    'has_seen_app_tour',
    'custom_physical_exam_template',
    'email_opt_out',
]);

const REPORTS_WRITE = new Set([
    'report_name',
    'report_text',
    'form_data',
    'record_type',
    'case_id',
]);

const TEMPLATES_WRITE = new Set(['template_name', 'template_text']);

const CASES_WRITE = new Set(['pet_name', 'title']);

const ONBOARDING_WRITE = new Set([
    'status',
    'current_step',
    'quiz_answers',
    'completed_at',
    'updated_at',
]);

const FILTER_OPS = new Set(['eq', 'in', 'is']);

const FILTER_COLS = {
    users: new Set(['auth0_user_id', 'id']),
    saved_reports: new Set(['id', 'user_id', 'record_type', 'report_text', 'case_id']),
    templates: new Set(['id', 'user_id']),
    cases: new Set(['id', 'user_id']),
    onboarding: new Set(['id', 'auth0_user_id']),
};

function pick(obj, allowed) {
    const out = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
    for (const [k, v] of Object.entries(obj)) {
        if (allowed.has(k)) out[k] = v;
    }
    return out;
}

function sanitizeColumns(cols) {
    if (!cols || cols === '*') return '*';
    const parts = String(cols).split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return '*';
    for (const p of parts) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p)) return null;
    }
    return parts.join(',');
}

function fail(status, message, code) {
    const err = new Error(message);
    err.status = status;
    err.code = code || String(status);
    return err;
}

const requireUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ data: null, error: { message: 'Missing Authorization header', code: '401' } });
        }
        if (!AUTH0_DOMAIN) {
            return res.status(500).json({ data: null, error: { message: 'AUTH0_DOMAIN is not set', code: '500' } });
        }

        const token = authHeader.split(' ')[1];
        if (tokenCache.has(token)) {
            const cached = tokenCache.get(token);
            if (Date.now() < cached.expiresAt) {
                req.auth0Sub = cached.sub;
                req.auth0Email = cached.email;
                req.auth0Nickname = cached.nickname;
                return next();
            }
            tokenCache.delete(token);
        }

        const userInfoRes = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!userInfoRes.ok) {
            return res.status(401).json({ data: null, error: { message: 'Invalid token', code: '401' } });
        }
        const userInfo = await userInfoRes.json();
        if (!userInfo.sub) {
            return res.status(401).json({ data: null, error: { message: 'Invalid token', code: '401' } });
        }

        tokenCache.set(token, {
            sub: userInfo.sub,
            email: userInfo.email,
            nickname: userInfo.nickname || userInfo.name,
            expiresAt: Date.now() + 5 * 60 * 1000,
        });
        req.auth0Sub = userInfo.sub;
        req.auth0Email = userInfo.email;
        req.auth0Nickname = userInfo.nickname || userInfo.name;
        next();
    } catch (err) {
        console.error('[api/db] auth error:', err);
        return res.status(401).json({ data: null, error: { message: 'Authentication failed', code: '401' } });
    }
};

async function userUuid(supabase, sub) {
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('auth0_user_id', sub)
        .maybeSingle();
    if (error) throw error;
    return data?.id || null;
}

function applyFilters(q, filters, allowedCols) {
    for (const f of filters) {
        if (!FILTER_OPS.has(f.op) || !allowedCols.has(f.k)) {
            throw fail(400, `Unsupported filter ${f.op} ${f.k}`, '400');
        }
        if (f.op === 'eq') q = q.eq(f.k, f.v);
        else if (f.op === 'in') q = q.in(f.k, f.v);
        else if (f.op === 'is') q = q.is(f.k, f.v);
    }
    return q;
}

router.post('/', requireUser, async (req, res) => {
    const supabase = req.app.locals.supabase;
    const sub = req.auth0Sub;
    const {
        table,
        method = 'select',
        columns = '*',
        filters = [],
        data,
        order,
        limit,
        single,
        maybeSingle,
    } = req.body || {};

    try {
        if (!TABLES.has(table) || !METHODS.has(method)) {
            throw fail(400, 'Unknown table or method', '400');
        }
        if (table === 'users' && method === 'delete') {
            throw fail(403, 'Account deletion is not allowed here', '403');
        }
        if (table === 'onboarding' && method === 'delete') {
            throw fail(403, 'Cannot delete onboarding rows', '403');
        }
        if ((method === 'delete') && !filters.some((f) => f.op === 'eq' && f.k === 'id')) {
            throw fail(400, 'Delete requires eq(id)', '400');
        }

        const cols = sanitizeColumns(columns);
        if (!cols) throw fail(400, 'Invalid select columns', '400');

        const rows = Array.isArray(data) ? data : (data == null ? [] : [data]);
        let q;

        if (table === 'users') {
            if (method === 'select') {
                q = supabase.from('users').select(cols).eq('auth0_user_id', sub);
            } else if (method === 'insert') {
                const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
                const payload = rows.map((row) => {
                    const fields = pick(row, USERS_WRITE);
                    return {
                        ...fields,
                        auth0_user_id: sub,
                        email: fields.email || req.auth0Email || undefined,
                        nickname: fields.nickname || req.auth0Nickname || undefined,
                        subscription_status: 'active',
                        subscription_interval: 'trial',
                        subscription_end_date: trialEnd,
                        has_used_trial: true,
                    };
                });
                q = supabase.from('users').insert(payload).select(cols);
            } else if (method === 'update') {
                q = supabase.from('users')
                    .update(pick(rows[0] || {}, USERS_WRITE))
                    .eq('auth0_user_id', sub)
                    .select(cols);
            } else {
                throw fail(403, 'users only supports select/insert/update', '403');
            }
        } else if (table === 'onboarding') {
            if (method === 'select') {
                q = supabase.from('onboarding').select(cols).eq('auth0_user_id', sub);
            } else if (method === 'insert' || method === 'upsert') {
                const payload = rows.map((row) => ({
                    ...pick(row, ONBOARDING_WRITE),
                    auth0_user_id: sub,
                }));
                q = method === 'upsert'
                    ? supabase.from('onboarding').upsert(payload, { onConflict: 'auth0_user_id' })
                    : supabase.from('onboarding').insert(payload);
                q = q.select(cols);
            } else if (method === 'update') {
                q = supabase.from('onboarding')
                    .update(pick(rows[0] || {}, ONBOARDING_WRITE))
                    .eq('auth0_user_id', sub);
            } else {
                throw fail(403, 'onboarding method not allowed', '403');
            }
        } else {
            const uid = await userUuid(supabase, sub);
            if (!uid) {
                return res.json({
                    data: method === 'select' && !single && !maybeSingle ? [] : null,
                    error: method === 'select' && single
                        ? { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows' }
                        : (method === 'select' ? null : { message: 'User not found', code: '404' }),
                });
            }

            const writeSet = table === 'saved_reports' ? REPORTS_WRITE : table === 'cases' ? CASES_WRITE : TEMPLATES_WRITE;
            const extraFilters = (filters || []).filter((f) => f.k !== 'user_id' && f.k !== 'auth0_user_id');

            if (table === 'saved_reports' && (method === 'insert' || method === 'update')) {
                const caseIds = [...new Set(rows.map((r) => r && r.case_id).filter(Boolean))];
                if (caseIds.length) {
                    const { data: owned, error: caseErr } = await supabase
                        .from('cases').select('id').eq('user_id', uid).in('id', caseIds);
                    if (caseErr) throw caseErr;
                    if ((owned || []).length !== caseIds.length) throw fail(403, 'Unknown case', '403');
                }
            }

            if (method === 'select') {
                q = supabase.from(table).select(cols).eq('user_id', uid);
                q = applyFilters(q, extraFilters, FILTER_COLS[table]);
            } else if (method === 'insert') {
                const payload = rows.map((row) => ({ ...pick(row, writeSet), user_id: uid }));
                q = supabase.from(table).insert(payload).select(cols);
            } else if (method === 'update') {
                q = supabase.from(table).update(pick(rows[0] || {}, writeSet)).eq('user_id', uid);
                q = applyFilters(q, extraFilters, FILTER_COLS[table]);
                q = q.select(cols);
            } else if (method === 'delete') {
                q = supabase.from(table).delete().eq('user_id', uid);
                q = applyFilters(q, extraFilters, FILTER_COLS[table]);
            } else {
                throw fail(403, `${table} method not allowed`, '403');
            }
        }

        if (order?.col && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(order.col)) {
            q = q.order(order.col, { ascending: order.ascending !== false });
        }
        if (typeof limit === 'number' && limit > 0) {
            q = q.limit(Math.min(limit, 100));
        }
        if (single) q = q.single();
        else if (maybeSingle) q = q.maybeSingle();

        const { data: result, error } = await q;
        if (error) {
            return res.json({ data: null, error: { message: error.message, code: error.code, details: error.details } });
        }

        if (table === 'users' && method === 'insert') {
            const row = Array.isArray(result) ? result[0] : result;
            const src = row || rows[0] || {};
            hubspot.runInBackground(hubspot.syncSignup({
                auth0_user_id: sub,
                email: src.email || req.auth0Email,
                nickname: src.nickname || req.auth0Nickname,
                dvm_name: src.dvm_name,
                phone_number: src.phone_number,
                subscription_status: 'active',
                subscription_interval: 'trial',
                subscription_end_date: src.subscription_end_date
                    || new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
            }));
        }

        return res.json({ data: result, error: null });
    } catch (err) {
        const status = err.status || 500;
        console.error('[api/db]', err.message || err);
        return res.status(status).json({
            data: null,
            error: { message: err.message || 'Query failed', code: err.code || String(status) },
        });
    }
});

// Paged lists. PostgREST caps a select at 1000 rows, so the generic route can't serve full histories.
const PAGE_SIZE = 50;
const MAX_PAGE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Raw Postgres timestamps: re-serializing through Date would drop microseconds and skip rows.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/;
const RECORD_FILTERS = {
    quicksoap: ['quicksoap', 'soap'],
    petsoap: ['generator'],
    summary: ['summary'],
    callback: ['callback'],
    dental: ['dental'],
};

const pageSize = (n) => Math.min(Math.max(parseInt(n, 10) || PAGE_SIZE, 1), MAX_PAGE);

// Characters that would break PostgREST's or() syntax or act as wildcards.
const searchTerm = (q) => String(q || '').replace(/[,()"\\%*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);

// Newest first, ties broken by id so a cursor never skips or repeats a row.
// A cursor with only a phase (search moving from name matches to text matches) starts that phase at the top.
const afterCursor = (q, col, cursor) => {
    if (!cursor || (cursor.phase && !cursor[col])) return q;
    const at = cursor[col];
    if (!TIMESTAMP.test(at || '') || !UUID.test(cursor.id || '')) throw fail(400, 'Invalid cursor', '400');
    return q.or(`${col}.lt."${at}",and(${col}.eq."${at}",id.lt.${cursor.id})`);
};

const nextCursor = (rows, col, hasMore) => {
    const last = rows[rows.length - 1];
    return hasMore && last ? { [col]: last[col], id: last.id } : null;
};

// Day or month range picked by the client in the vet's own timezone.
const dateRange = (q, col, from, to) => {
    if (!from && !to) return q;
    if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) throw fail(400, 'Invalid date range', '400');
    return q.gte(col, new Date(from).toISOString()).lt(col, new Date(to).toISOString());
};

const newestFirst = async (q, col, cursor, limit) => {
    const { data, error } = await afterCursor(q, col, cursor)
        .order(col, { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
};

const listRoute = (handler) => async (req, res) => {
    try {
        const uid = await userUuid(req.app.locals.supabase, req.auth0Sub);
        if (!uid) return res.json({ data: [], nextCursor: null, error: null });
        return res.json({ ...(await handler(req.app.locals.supabase, uid, req.body || {})), error: null });
    } catch (err) {
        const status = err.status || 500;
        console.error('[api/db list]', err.message || err);
        return res.status(status).json({ data: null, nextCursor: null, error: { message: err.message || 'Query failed', code: err.code || String(status) } });
    }
};

const RECORD_COLUMNS = 'id, report_name, report_text, form_data, record_type, case_id, created_at';

// Saved Records: { cursor, limit, q, type, from, to } -> { data, nextCursor }. Search covers the whole history.
// A search lists records named after the term (record name or patient) first, then ones that only
// mention it in the text. Text matches start a word, so "ned" finds Ned but not "planned".
router.post('/records', requireUser, listRoute(async (supabase, uid, { cursor, limit, q, type, from, to }) => {
    const size = pageSize(limit);
    if (type && type !== 'all' && !RECORD_FILTERS[type]) throw fail(400, 'Unknown record type', '400');
    const base = () => {
        let query = supabase.from('saved_reports').select(RECORD_COLUMNS).eq('user_id', uid);
        if (type && type !== 'all') query = query.in('record_type', RECORD_FILTERS[type]);
        return dateRange(query, 'created_at', from, to);
    };
    // Drafts still generating on desktop stay hidden; dropped after paging so the cursor stays exact.
    const visible = (rows) => rows.filter((r) => r.report_text || r.form_data?.sent_to_desktop !== true);

    const term = searchTerm(q);
    if (!term) {
        const rows = await newestFirst(base(), 'created_at', cursor, size + 1);
        const page = rows.slice(0, size);
        return { data: visible(page), nextCursor: nextCursor(page, 'created_at', rows.length > size) };
    }

    const like = `%${term}%`;
    // \m is Postgres's start-of-word; regex characters in the term are treated as "any character".
    const word = `\\m${term.replace(/[.^$|?+{}[\]]/g, '.')}`;
    const byName = () => base().or(`report_name.ilike.${like},form_data->>petName.ilike.${like}`);
    const byTextOnly = () => base()
        .filter('report_text', 'imatch', word)
        .or(`report_name.is.null,report_name.not.ilike.${like}`)
        .or(`form_data->>petName.is.null,form_data->>petName.not.ilike.${like}`);

    let page = [];
    let next = null;
    if (!cursor || cursor.phase !== 'text') {
        const rows = await newestFirst(byName(), 'created_at', cursor, size + 1);
        page = rows.slice(0, size);
        if (rows.length > size) next = { phase: 'name', ...nextCursor(page, 'created_at', true) };
        else if (page.length === size) next = { phase: 'text' };
    }
    if (!next && page.length < size) {
        const textCursor = cursor?.phase === 'text' ? cursor : null;
        const room = size - page.length;
        const rows = await newestFirst(byTextOnly(), 'created_at', textCursor, room + 1);
        const more = rows.slice(0, room);
        page = page.concat(more);
        if (rows.length > room) next = { phase: 'text', ...nextCursor(more, 'created_at', true) };
    }
    return { data: visible(page), nextCursor: next };
}));

// Cases: { cursor, limit, q, from, to } -> { data, notes, nextCursor }. notes covers only the returned cases.
// A date search matches the visit day (created_at), not the last edit.
router.post('/cases', requireUser, listRoute(async (supabase, uid, { cursor, limit, q, from, to }) => {
    const size = pageSize(limit);
    let query = supabase
        .from('cases')
        .select('id, pet_name, title, created_at, updated_at')
        .eq('user_id', uid);
    const term = searchTerm(q);
    if (term) query = query.or(`pet_name.ilike.%${term}%,title.ilike.%${term}%`);
    query = dateRange(query, 'created_at', from, to);
    const data = await newestFirst(query, 'updated_at', cursor, size + 1);
    const page = data.slice(0, size);

    let notes = [];
    if (page.length) {
        const { data: rows, error: notesErr } = await supabase
            .from('saved_reports')
            .select('id, case_id, record_type, report_text, form_data, created_at')
            .eq('user_id', uid)
            .in('case_id', page.map((c) => c.id));
        if (notesErr) throw notesErr;
        // Only the fields the list reads; report_text becomes a has-text flag to keep the payload small.
        notes = rows.map((n) => ({
            id: n.id,
            case_id: n.case_id,
            record_type: n.record_type,
            created_at: n.created_at,
            report_text: n.report_text ? true : null,
            form_data: {
                from_mobile: n.form_data?.from_mobile,
                generated_at: n.form_data?.generated_at,
                sent_to_desktop: n.form_data?.sent_to_desktop,
            },
        }));
    }
    return { data: page, notes, nextCursor: nextCursor(page, 'updated_at', data.length > size) };
}));

module.exports = router;
module.exports.requireUser = requireUser;
