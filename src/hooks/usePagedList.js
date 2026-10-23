import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPage } from '../supabaseClient';
import { parseSearchDate } from '../utils/searchDate';

const SEARCH_DELAY = 250;
const MAX_REFRESH = 200;

const asRange = (r) => ({ from: r.from.toISOString(), to: r.to.toISOString() });

// A typed date ("Oct 21", "10/21") searches that day. It can lead or follow a name: "Ned 10/21", "Oct 21 Bella".
const searchBody = (query) => {
    const whole = parseSearchDate(query);
    if (whole) return asRange(whole);
    const words = query.split(/\s+/).filter(Boolean);
    for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
        const tail = parseSearchDate(words.slice(-n).join(' '));
        if (tail) return { q: words.slice(0, -n).join(' '), ...asRange(tail) };
        const head = parseSearchDate(words.slice(0, n).join(' '));
        if (head) return { q: words.slice(n).join(' '), ...asRange(head) };
    }
    return { q: query };
};

// Server-paged list for /api/db/records and /api/db/cases. A search or filter change starts over at
// page 1 and searches the whole history, by name, text or date. `initial` paints instantly (e.g. a cached first page).
export default function usePagedList(list, { q = '', type, enabled = true, initial = null } = {}) {
    const [state, setState] = useState(() => initial || { items: [], notes: [], nextCursor: null });
    const [loading, setLoading] = useState(!initial);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState(q);
    const requestId = useRef(0);
    const itemCount = useRef(0);
    itemCount.current = state.items.length;

    useEffect(() => {
        if (q === query) return undefined;
        const id = setTimeout(() => setQuery(q), q ? SEARCH_DELAY : 0);
        return () => clearTimeout(id);
    }, [q, query]);

    // keep: refetch everything currently shown (for polling) instead of resetting to one page.
    const load = useCallback(async ({ keep = false } = {}) => {
        const id = ++requestId.current;
        if (!keep) setLoading(true);
        const limit = keep ? Math.min(Math.max(itemCount.current, 50), MAX_REFRESH) : undefined;
        const res = await fetchPage(list, { ...searchBody(query), type, limit });
        if (id !== requestId.current) return;
        if (res.error) {
            setError(res.error.message || 'Could not load.');
        } else {
            setError('');
            setState({ items: res.data || [], notes: res.notes || [], nextCursor: res.nextCursor || null });
        }
        setLoading(false);
    }, [list, query, type]);

    useEffect(() => {
        if (enabled) load();
    }, [enabled, load]);

    const loadMore = useCallback(async () => {
        if (!state.nextCursor || loadingMore) return;
        const id = requestId.current;
        setLoadingMore(true);
        const res = await fetchPage(list, { ...searchBody(query), type, cursor: state.nextCursor });
        setLoadingMore(false);
        if (id !== requestId.current) return;
        if (res.error) return setError(res.error.message || 'Could not load more.');
        setState((s) => {
            const seen = new Set(s.items.map((r) => r.id));
            return {
                items: [...s.items, ...(res.data || []).filter((r) => !seen.has(r.id))],
                notes: [...s.notes, ...(res.notes || [])],
                nextCursor: res.nextCursor || null,
            };
        });
    }, [list, query, type, state.nextCursor, loadingMore]);

    const setItems = useCallback((fn) => setState((s) => ({ ...s, items: typeof fn === 'function' ? fn(s.items) : fn })), []);

    return {
        items: state.items,
        notes: state.notes,
        snapshot: state,
        setItems,
        hasMore: !!state.nextCursor,
        loading,
        loadingMore,
        searching: q !== query,
        error,
        loadMore,
        reload: load,
    };
}
