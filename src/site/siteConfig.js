import { STUDENT_PROGRAM } from '../constants/features';

export const SITE_URL = 'https://petwise.vet';
export const SITE_NAME = 'PetWise';
export const SUPPORT_EMAIL = 'support@petwise.vet';
export const DEFAULT_IMAGE = '/site/hero-desk-phone.png';

export const SOCIALS = {
    facebook: 'https://www.facebook.com/petwise.vet',
    instagram: 'https://www.instagram.com/petwise.vet/'
};

export const NAV = [
    { label: 'Dictation', to: '/veterinary-dictation' },
    { label: 'Clinical Assistant', to: '/veterinary-clinical-assistant' },
    { label: 'Features', to: '/features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Blog', to: '/blog' },
    { label: 'About', to: '/about' }
];

export const FOOTER = [
    {
        title: 'Product',
        links: [
            { label: 'Veterinary AI scribe', to: '/' },
            { label: 'Veterinary dictation', to: '/veterinary-dictation' },
            { label: 'Clinical assistant', to: '/veterinary-clinical-assistant' },
            { label: 'All features', to: '/features' },
            { label: 'Pricing', to: '/pricing' },
            { label: 'Get the app', to: '/install' }
        ]
    },
    {
        title: 'Company',
        links: [
            { label: 'About', to: '/about' },
            { label: 'Blog', to: '/blog' },
            { label: 'Updates', to: '/updates' },
            ...(STUDENT_PROGRAM ? [{ label: 'Vet students', to: '/students' }] : [])
        ]
    },
    {
        title: 'Support',
        links: [
            { label: 'Help center', to: '/help' },
            { label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
            { label: 'Privacy', to: '/privacy' },
            { label: 'Terms', to: '/terms' }
        ]
    }
];

export const TESTIMONIALS = [
    {
        quote: 'I am absolutely obsessed with PetWise! It is super user friendly, and provides me with fast and accurate information. I have been reluctant to use AI for records because I like things written a certain way. I am impressed, and I am comfortable distributing the information I get from PetWise to my clients.',
        name: 'Dr. Amanda Wright, DVM',
        photo: '/site/dr-amanda-wright.png'
    },
    {
        quote: 'Without PetWise I could not possibly be as productive or efficient. The important medical and legal details are covered so I can enjoy time with the clients and patients.',
        name: 'Dr. Tammi Whelan, DVM',
        initials: 'TW'
    },
    {
        quote: 'PetWise is my go to whenever I need current veterinary information. I use the search query feature the most because it pulls from multiple sources and shows the references clearly, which I really like. It makes it easy to find what I need quickly and feel confident that the information is reliable and up to date.',
        name: 'Dr. Johnson, DVM',
        initials: 'J'
    }
];

export const PRESS = [{ name: "NAVC's VetFolio", logo: '/site/press-vetfolio.png' }];

export const AUTHOR_PHOTOS = {
    'Nick Gastis': '/site/nick-gastis.png'
};
