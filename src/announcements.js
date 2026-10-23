import { FiFolder } from 'react-icons/fi';
import { PiTooth } from 'react-icons/pi';
import UpgradeAnnouncement from './components/UpgradeAnnouncement';
import { markAnnouncementSeen } from './supabaseClient';

// Oldest first. Each one shows once per account, and only to accounts created before releasedAt.
// To ship a new one: add an entry with a new id. Never reuse or rename an id.
export const ANNOUNCEMENTS = [
    {
        id: 'cases-dental-2026-10',
        releasedAt: '2026-10-24T12:00:00Z',
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
    const created = userData.created_at ? Date.parse(userData.created_at) : 0;
    const seen = userData.seen_announcements || {};
    return ANNOUNCEMENTS.filter((a) => !seen[a.id] && !localStorage.getItem(localKey(a.id, sub)) && (!created || created < Date.parse(a.releasedAt)));
};

export const markSeen = (ids, sub) => {
    ids.forEach((id) => {
        localStorage.setItem(localKey(id, sub), new Date().toISOString());
        markAnnouncementSeen(id);
    });
};

// Someone back after missing several updates only gets the newest.
export const nextAnnouncement = (userData, sub) => {
    if (userData?.has_seen_app_tour === false) return null;
    const list = unseen(userData, sub);
    return list[list.length - 1] || null;
};

export const dismissAnnouncements = (userData, sub) => markSeen(unseen(userData, sub).map((a) => a.id), sub);
