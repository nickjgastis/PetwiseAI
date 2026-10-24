import { FiFolder } from 'react-icons/fi';
import { PiTooth } from 'react-icons/pi';
import UpgradeAnnouncement from './components/UpgradeAnnouncement';
import { markAnnouncementSeen } from './supabaseClient';

// Oldest first. The newest active one shows once to every account, new or old, after the app tour.
// To ship a new one: add an entry with a new id. Never reuse or rename an id.
// To stop the popup for one: set active: false. It stays on the Help page's What's new card.
export const ANNOUNCEMENTS = [
    {
        id: 'cases-dental-2026-10',
        active: true,
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
    return ANNOUNCEMENTS.filter((a) => a.active && !seen[a.id] && !localStorage.getItem(localKey(a.id, sub)));
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
