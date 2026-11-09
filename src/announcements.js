import { FiFolder } from 'react-icons/fi';
import { PiTooth } from 'react-icons/pi';
import UpgradeAnnouncement from './components/UpgradeAnnouncement';
import { markAnnouncementSeen } from './supabaseClient';

// Oldest first. The newest active one shows once to every account created before its publishedAt.
// Accounts created after it get the app tour instead; "what's new" means nothing to them.
// To ship a new one: add an entry with a new id. Never reuse or rename an id.
// To stop the popup for one: set active: false, or let it pass expiresAt. It stays on the Help page's What's new card.
export const ANNOUNCEMENTS = [
    {
        id: 'cases-dental-2026-10',
        active: true,
        publishedAt: '2026-10-24T16:40:00Z',
        expiresAt: '2026-11-11T08:00:00Z', // end of Nov 10, Pacific
        title: 'Cases and Dental Records',
        summary: 'Every visit is now a case, and you can dictate a full dental chart. See what changed.',
        icons: [FiFolder, PiTooth],
        Component: UpgradeAnnouncement,
    },
];

export const latestAnnouncement = ANNOUNCEMENTS[ANNOUNCEMENTS.length - 1];

const localKey = (id, sub) => `petwise_announcement:${id}:${sub || 'anon'}`;

const unseen = (userData, sub) => {
    if (!userData) return [];
    const seen = userData.seen_announcements || {};
    const live = (a) => a.active && (!a.expiresAt || Date.now() < Date.parse(a.expiresAt));
    const predates = (a) => !a.publishedAt || !userData.created_at || Date.parse(userData.created_at) < Date.parse(a.publishedAt);
    return ANNOUNCEMENTS.filter((a) => live(a) && predates(a) && !seen[a.id] && !localStorage.getItem(localKey(a.id, sub)));
};

export const markSeen = (ids, sub) => {
    ids.forEach((id) => {
        localStorage.setItem(localKey(id, sub), new Date().toISOString());
        markAnnouncementSeen(id);
    });
};

// Someone back after missing several updates only gets the newest.
export const nextAnnouncement = (userData, sub) => {
    const list = unseen(userData, sub);
    return list[list.length - 1] || null;
};

export const dismissAnnouncements = (userData, sub) => markSeen(unseen(userData, sub).map((a) => a.id), sub);
