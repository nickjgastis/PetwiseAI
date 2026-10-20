import { createContext, useContext, useEffect } from 'react';
import { DEFAULT_IMAGE, SITE_NAME, SITE_URL, SOCIALS, SUPPORT_EMAIL } from './siteConfig';
import { PRICES } from '../constants/pricing';

// During prerendering this context holds a plain object the Seo component
// writes into, so the build script can inject the tags into the static HTML.
export const SeoContext = createContext(null);

const absolute = (url) => (url.startsWith('http') ? url : `${SITE_URL}${url}`);

export const buildMeta = ({ title, description, path = '/', image = DEFAULT_IMAGE, type = 'website', jsonLd = [], noindex = false }) => ({
    title,
    description,
    canonical: `${SITE_URL}${path === '/' ? '' : path}`,
    image: absolute(image),
    type,
    noindex,
    jsonLd: [].concat(jsonLd).filter(Boolean)
});

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const metaToHtml = (meta) => {
    const tags = [
        `<meta name="description" content="${escapeAttr(meta.description)}" data-seo />`,
        `<link rel="canonical" href="${meta.canonical}" data-seo />`,
        `<meta property="og:site_name" content="${SITE_NAME}" data-seo />`,
        `<meta property="og:type" content="${meta.type}" data-seo />`,
        `<meta property="og:title" content="${escapeAttr(meta.title)}" data-seo />`,
        `<meta property="og:description" content="${escapeAttr(meta.description)}" data-seo />`,
        `<meta property="og:url" content="${meta.canonical}" data-seo />`,
        `<meta property="og:image" content="${meta.image}" data-seo />`,
        `<meta name="twitter:card" content="summary_large_image" data-seo />`
    ];
    if (meta.noindex) tags.push('<meta name="robots" content="noindex" data-seo />');
    for (const block of meta.jsonLd) {
        tags.push(`<script type="application/ld+json" data-seo>${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`);
    }
    return tags.join('\n    ');
};

const applyMeta = (meta) => {
    document.title = meta.title;
    document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
    document.head.querySelector('meta[name="description"]')?.remove();
    const tpl = document.createElement('template');
    tpl.innerHTML = metaToHtml(meta);
    document.head.append(...tpl.content.childNodes);
};

export const Seo = (props) => {
    const collector = useContext(SeoContext);
    const meta = buildMeta(props);
    if (collector) collector.meta = meta;
    const key = JSON.stringify(meta);
    useEffect(() => {
        applyMeta(JSON.parse(key));
    }, [key]);
    return null;
};

export const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/PW.png`,
    email: SUPPORT_EMAIL,
    sameAs: [SOCIALS.facebook, SOCIALS.instagram],
    founder: [
        { '@type': 'Person', name: 'Nick Gastis', jobTitle: 'CEO and Chief Developer' },
        { '@type': 'Person', name: 'Dr. Stacey Gastis', jobTitle: 'Co-Founder, DVM' }
    ]
};

export const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PetWise',
    applicationCategory: 'HealthApplication',
    applicationSubCategory: 'Veterinary AI scribe',
    operatingSystem: 'Web, iOS, Android',
    url: SITE_URL,
    description:
        'PetWise is a veterinary AI scribe and clinical assistant. It turns appointments and dictation into SOAP notes, callback notes and clinical summaries, and answers clinical questions with PetQuery.',
    offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '0',
        highPrice: String(PRICES.usd.monthly),
        offerCount: 3
    },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL }
};

export const faqLd = (faqs) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
});

export const articleLd = (post) => ({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated,
    image: post.cover ? absolute(post.cover) : absolute(DEFAULT_IMAGE),
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}/PW.png` } },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`
});
