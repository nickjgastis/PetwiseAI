import { matchPath } from 'react-router-dom';
import { POST_REDIRECTS } from '../content/blog/posts.generated';
import { STUDENT_PROGRAM } from '../constants/features';

export const SITE_PAGES = [
    { path: '/', page: 'Home' },
    { path: '/veterinary-dictation', page: 'Dictation' },
    { path: '/veterinary-clinical-assistant', page: 'ClinicalAssistant' },
    { path: '/features', page: 'Features' },
    { path: '/pricing', page: 'Pricing' },
    ...(STUDENT_PROGRAM ? [{ path: '/students', page: 'Students' }] : []),
    { path: '/about', page: 'About' },
    { path: '/help', page: 'Help' },
    { path: '/updates', page: 'Updates' },
    { path: '/install', page: 'Install' },
    { path: '/blog', page: 'Blog' },
    { path: '/blog/:slug', page: 'BlogPost' },
    { path: '/privacy', page: 'Privacy' },
    { path: '/terms', page: 'Terms' }
];

// Old Squarespace and in-app URLs. Mirrored as 301s in vercel.json at deploy time.
export const SITE_REDIRECTS = {
    '/home': '/',
    '/veterinary-ai-scribe': '/',
    '/solutions': '/',
    '/product': '/',
    '/membership': '/pricing',
    '/support': '/help',
    '/privacy-policy': '/privacy',
    '/terms-of-service': '/terms',
    '/app': '/install',
    '/vet-students': STUDENT_PROGRAM ? '/students' : '/pricing',
    ...(STUDENT_PROGRAM ? {} : { '/students': '/pricing' }),
    '/demo': '/signup',
    '/complimentary-demos': '/signup',
    '/webinar-earn-1-ce-hour': '/signup',
    '/free-trial': '/signup',
    '/new-page': '/',
    '/test-12345': '/',
    '/blog/earn-1-hour-of-free-ce-join-our-weekly-1-hour-webinar': '/blog',
    ...Object.fromEntries(Object.entries(POST_REDIRECTS).map(([from, to]) => [`/blog/${from}`, `/blog/${to}`]))
};

export const findSitePage = (pathname) => SITE_PAGES.find((p) => matchPath({ path: p.path, end: true }, pathname)) || null;
