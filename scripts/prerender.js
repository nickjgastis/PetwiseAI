// Renders every marketing route to static HTML inside build/, plus sitemap.xml,
// robots.txt and llms.txt. Runs after `craco build`.

process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'test'; // react-app preset: CommonJS output targeting this Node

const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BUILD = path.join(ROOT, 'build');

const compileJs = Module._extensions['.js'];
Module._extensions['.js'] = function (module, filename) {
    if (!filename.startsWith(SRC)) return compileJs(module, filename);
    const { code } = babel.transformFileSync(filename, {
        babelrc: false,
        configFile: false,
        // Production React has no jsxDEV, which the test preset would emit
        plugins: [[require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic', development: false }]],
        presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]]
    });
    return module._compile(code, filename);
};
for (const ext of ['.css', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp']) {
    Module._extensions[ext] = () => {};
}

const { renderSitePage } = require(path.join(SRC, 'site/ssr.js'));
const { SITE_PAGES } = require(path.join(SRC, 'site/routes.js'));
const { metaToHtml } = require(path.join(SRC, 'site/seo.js'));
const { SITE_URL } = require(path.join(SRC, 'site/siteConfig.js'));
const { POSTS } = require(path.join(SRC, 'content/blog/posts.generated.js'));

const indexHtml = fs.readFileSync(path.join(BUILD, 'index.html'), 'utf8');
const template = indexHtml.includes('<div id="root"></div>')
    ? indexHtml
    : fs.readFileSync(path.join(BUILD, 'app-shell.html'), 'utf8');
fs.writeFileSync(path.join(BUILD, 'app-shell.html'), template);

const urls = SITE_PAGES.flatMap(({ path: p }) => (p === '/blog/:slug' ? POSTS.map((post) => `/blog/${post.slug}`) : [p]));

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const inject = (url, { html, meta }) => {
    if (!meta) throw new Error(`${url}: page did not render a <Seo> component`);
    if (!html.includes('<')) throw new Error(`${url}: rendered empty`);
    return template
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeText(meta.title)}</title>`)
        .replace(/<meta name="description"[^>]*>/, metaToHtml(meta))
        .replace(/<noscript>You need to enable JavaScript to run this app.<\/noscript>/, '')
        .replace('<div id="root"></div>', `<div id="root" data-prerendered="${url}">${html}</div>`);
};

let count = 0;
for (const url of urls) {
    const out = url === '/' ? path.join(BUILD, 'index.html') : path.join(BUILD, url.slice(1), 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, inject(url, renderSitePage(url)));
    count++;
}

const today = new Date().toISOString().slice(0, 10);
const lastmod = (url) => POSTS.find((p) => `/blog/${p.slug}` === url)?.updated || today;
const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${SITE_URL}${u === '/' ? '' : u}</loc><lastmod>${lastmod(u)}</lastmod></url>`),
    '</urlset>',
    ''
].join('\n');
fs.writeFileSync(path.join(BUILD, 'sitemap.xml'), sitemap);

fs.writeFileSync(
    path.join(BUILD, 'robots.txt'),
    ['User-agent: *', 'Allow: /', 'Disallow: /dashboard', 'Disallow: /admin', 'Disallow: /callback', 'Disallow: /refresh', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n')
);

const llms = [
    '# PetWise',
    '',
    '> PetWise is a veterinary AI scribe and clinical assistant built by a practicing veterinarian. It turns appointments and dictation into SOAP notes, callback notes and clinical summaries, and answers clinical questions with PetQuery.',
    '',
    '## Product',
    `- [Veterinary AI scribe](${SITE_URL}/): AI SOAP notes from the appointment or dictation, ready for any PIMS.`,
    `- [Veterinary dictation](${SITE_URL}/veterinary-dictation): dictate on a phone, finished record synced to the desktop.`,
    `- [Veterinary clinical assistant](${SITE_URL}/veterinary-clinical-assistant): PetQuery for dosages, differentials, protocols and client explanations.`,
    `- [Features](${SITE_URL}/features)`,
    `- [Pricing](${SITE_URL}/pricing): 10 days unlimited free, then paid plans or PetWise Free.`,
    '',
    '## Company',
    `- [About](${SITE_URL}/about): founded by Dr. Stacey Gastis, DVM, and Nick Gastis.`,
    `- [Help center](${SITE_URL}/help)`,
    `- [Blog](${SITE_URL}/blog)`,
    ''
].join('\n');
fs.writeFileSync(path.join(BUILD, 'llms.txt'), llms);

console.log(`[prerender] ${count} pages, sitemap.xml, robots.txt, llms.txt`);
