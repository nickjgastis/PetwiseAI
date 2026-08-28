import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth0 } from '@auth0/auth0-react';
import {
    FaBolt,
    FaChevronDown,
    FaClipboardList,
    FaCommentMedical,
    FaComments,
    FaLayerGroup,
    FaMoon,
    FaPhoneAlt,
    FaSearch,
    FaUserMd
} from 'react-icons/fa';
import DemoStage from './DemoStage';
import StepGraphic from './StepGraphic';
import YoutubeEmbed from '../YoutubeEmbed';
import { COPY, PHOTOS, QUOTES, BEST_FOR, FAQS } from './copy';

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
};

const Reveal = ({ children, className = '' }) => (
    <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className={className}
    >
        {children}
    </motion.div>
);

const Photo = ({ src, alt, className = '' }) => (
    <figure className={`overflow-hidden bg-[#e8eef6] ${className}`}>
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />
    </figure>
);

const PrimaryCta = ({ children, onClick, className = '' }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 rounded-full text-[15px] font-medium tracking-tight transition-all duration-200 bg-[#5cccf0] text-white shadow-[0_8px_24px_-6px_rgba(92,204,240,0.7)] hover:-translate-y-0.5 hover:bg-[#47c4ed] hover:shadow-[0_14px_32px_-8px_rgba(92,204,240,0.8)] ${className}`}
    >
        {children}
        <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </button>
);

const GhostCta = ({ children, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="group hidden sm:inline-flex items-center justify-center gap-1.5 px-2 py-3 text-[15px] font-medium text-[#1a2b4a]/65 hover:text-[#1a2b4a] transition-colors"
    >
        {children}
        <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </button>
);

const TURQ = 'text-[#5cccf0]';

const Mark = ({ children }) => <span className={TURQ}>{children}</span>;

const Title = ({ parts, as: Tag = 'h2', className = '' }) => (
    <Tag className={className}>
        {parts[0]}
        <Mark>{parts[1]}</Mark>
    </Tag>
);

const featureIcon = (title) => {
    const t = title.toLowerCase();
    if (t.includes('soap')) return FaClipboardList;
    if (t.includes('callback')) return FaPhoneAlt;
    if (t.includes('assistant')) return FaCommentMedical;
    if (t.includes('research')) return FaSearch;
    if (t.includes('communication')) return FaComments;
    return FaClipboardList;
};

const BEST_ICONS = [FaBolt, FaMoon, FaUserMd, FaLayerGroup];

const CampaignLanding = ({ variant = 'home' }) => {
    const copy = COPY[variant] || COPY.home;
    const { loginWithRedirect } = useAuth0();
    const [openFaq, setOpenFaq] = useState(0);

    const start = (placement) => {
        window.gtag?.('event', 'landing_cta', { page_variant: copy.variant, placement });
        window.fbq?.('track', 'Lead');
        loginWithRedirect({
            authorizationParams: { screen_hint: 'signup' },
            appState: { returnTo: '/dashboard' }
        });
    };

    const logIn = () => loginWithRedirect({ appState: { returnTo: '/dashboard' } });
    const scrollToDemo = () => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="min-h-screen bg-white text-[#1a2b4a] text-base overflow-x-clip">
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/PW.png" alt="PetWise" className="w-9 h-9 object-contain" />
                        <span className="font-extrabold tracking-tight text-lg text-[#1a2b4a]">
                            Petwise<span className="font-light text-[#1a2b4a]/40">.vet</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={logIn} className="px-3.5 py-2 text-sm font-medium text-[#1a2b4a]/60 hover:text-[#1a2b4a] transition-colors">
                            Sign in
                        </button>
                        <button
                            onClick={() => start('header')}
                            className="px-4 py-2 rounded-full bg-[#5cccf0] text-white text-sm font-medium tracking-tight hover:bg-[#47c4ed] transition-colors"
                        >
                            Try for free
                        </button>
                    </div>
                </div>
            </header>

            <section className="relative overflow-hidden bg-white">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,#ffffff_42%,#d7eaf8_100%)]"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-40% to-[#f4f7fb]"
                />
                <div className="relative max-w-7xl mx-auto px-4 pt-8 pb-8 sm:pt-16 sm:pb-16">
                    <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                        <div className="lg:col-span-5 text-left">
                            <Title
                                as="h1"
                                parts={[`${copy.h1[0]} `, copy.h1[1]]}
                                className="text-[2.25rem] leading-[1.1] font-extrabold tracking-tight sm:text-5xl mb-4"
                            />
                            <p className="text-lg text-[#1a2b4a]/70 leading-relaxed mb-6">
                                {copy.sub}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <PrimaryCta onClick={() => start('hero')}>{copy.cta}</PrimaryCta>
                                <GhostCta onClick={scrollToDemo}>See how it works</GhostCta>
                            </div>
                            <p className="text-sm text-[#1a2b4a]/50 mt-3 text-center sm:text-left">{copy.micro}</p>
                        </div>
                        <div className="lg:col-span-6 mt-6 lg:mt-0 lg:col-start-7">
                            <img
                                src={copy.heroImg}
                                alt={copy.heroAlt}
                                className="w-full h-auto"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-[#f4f7fb] px-4 pt-2 pb-10 sm:pt-2 sm:pb-14">
                <div className="max-w-xl mx-auto sm:max-w-3xl">
                    <Title
                        parts={['Dr. Stacey ', 'Gastis']}
                        className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4 text-center"
                    />
                    <YoutubeEmbed />
                    <div className="mt-5 flex justify-center">
                        <PrimaryCta onClick={() => start('vsl')}>{copy.cta}</PrimaryCta>
                    </div>
                </div>
            </section>

            <section className="bg-[#f4f7fb] py-12 sm:py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <Reveal className="max-w-2xl mb-8">
                        <Title parts={copy.featuresTitle} className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3" />
                        <p className="text-base text-[#1a2b4a]/65">{copy.featuresSub}</p>
                    </Reveal>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {copy.features.map((f, i) => {
                            const Icon = featureIcon(f.title);
                            const featured = i === 0;
                            return (
                                <Reveal key={f.title} className={featured ? 'sm:col-span-2' : ''}>
                                    <div
                                        className={`h-full rounded-3xl p-6 sm:p-7 transition-all duration-200 ${
                                            featured
                                                ? 'bg-[#1a2b4a] text-white shadow-[0_24px_50px_-20px_rgba(26,43,74,0.55)]'
                                                : 'bg-white border border-white shadow-[0_10px_32px_-14px_rgba(26,43,74,0.18)] hover:-translate-y-1 hover:shadow-[0_20px_44px_-16px_rgba(52,104,189,0.28)]'
                                        }`}
                                    >
                                        <div
                                            className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                                                featured ? 'bg-[#5cccf0] text-[#1a2b4a]' : 'bg-[#5cccf0]/25 text-[#1a2b4a]'
                                            }`}
                                        >
                                            <Icon className="text-lg" />
                                        </div>
                                        {featured && (
                                            <p className="text-[#5cccf0] text-xs font-semibold tracking-[0.18em] uppercase mb-2">
                                                Start here
                                            </p>
                                        )}
                                        <h3 className={`font-extrabold tracking-tight mb-2 ${featured ? 'text-2xl' : 'text-lg'}`}>
                                            {f.title}
                                        </h3>
                                        <p className={`text-base leading-relaxed ${featured ? 'text-white/70 max-w-md' : 'text-[#1a2b4a]/60'}`}>
                                            {f.body}
                                        </p>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="py-12 sm:py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <Reveal className="mb-8">
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Best for <Mark>you</Mark></h2>
                    </Reveal>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {BEST_FOR.map((b, i) => {
                            const Icon = BEST_ICONS[i];
                            return (
                                <Reveal key={b.title}>
                                    <div className="group relative overflow-hidden h-full rounded-3xl border border-gray-100 bg-white p-7 shadow-[0_10px_32px_-14px_rgba(26,43,74,0.12)] hover:-translate-y-1 hover:border-[#5cccf0]/50 hover:shadow-[0_20px_44px_-16px_rgba(52,104,189,0.22)] transition-all duration-200">
                                        <span className="pointer-events-none absolute -right-1 -top-3 text-[6.5rem] font-extrabold leading-none text-[#5cccf0]/20 select-none">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <div className="w-11 h-11 rounded-2xl bg-[#1a2b4a] text-[#5cccf0] flex items-center justify-center mb-4">
                                            <Icon />
                                        </div>
                                        <h3 className="relative font-extrabold text-xl tracking-tight mb-2">{b.title}</h3>
                                        <p className="relative text-base text-[#1a2b4a]/65 leading-relaxed">{b.body}</p>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Outcomes */}
            <section className="bg-[#f4f7fb] py-12 sm:py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <Reveal className="mb-8">
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Real outcomes from <Mark>veterinarians</Mark></h2>
                        <p className="text-base text-[#1a2b4a]/60">Real vets. Real records. Here’s how PetWise shows up in the clinic.</p>
                    </Reveal>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {QUOTES.map((q) => (
                            <Reveal key={q.name}>
                                <div className="bg-white rounded-2xl p-6 h-full border border-gray-100">
                                    <p className="text-base leading-relaxed text-[#1a2b4a]/80 mb-5">“{q.text}”</p>
                                    <p className="text-base font-bold text-[#3468bd]">{q.name}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Product graphic — CoVet’s desktop/mobile UI block */}
            <section id="how-it-works" className="hidden md:block py-12 sm:py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <Reveal className="text-center mb-8">
                        <Title parts={copy.stepsTitle} className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" />
                        <p className="text-base text-[#1a2b4a]/65 max-w-lg mx-auto">{copy.howCloser}</p>
                    </Reveal>
                    <div className="max-w-md mx-auto mb-10">
                        <DemoStage />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {copy.steps.map((s) => (
                            <Reveal key={s.n}>
                                <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white">
                                    <StepGraphic n={s.n} />
                                    <div className="p-5">
                                        <p className="text-[#3468bd] font-bold text-sm tracking-widest mb-1">{s.n}</p>
                                        <h3 className="font-bold mb-1">{s.title}</h3>
                                        <p className="text-base text-[#1a2b4a]/60 leading-relaxed">{s.body}</p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Dark band — Keep your evenings */}
            <section className="bg-[#20447f] text-white">
                <div className="max-w-6xl mx-auto px-4 py-14 sm:py-16 grid md:grid-cols-2 gap-8 items-center">
                    <div>
                        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">Keep your <Mark>evenings</Mark> to yourself</h2>
                        <p className="text-white/75 text-lg mb-6">{copy.nextLine}</p>
                        <PrimaryCta light onClick={() => start('evenings')}>
                            {copy.cta}
                        </PrimaryCta>
                    </div>
                    <Photo
                        src={PHOTOS.close.src}
                        alt={PHOTOS.close.alt}
                        className="rounded-2xl aspect-[16/10] hidden md:block"
                    />
                </div>
            </section>

            {/* Built by a vet */}
            <section className="py-12 sm:py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <Reveal className="grid md:grid-cols-[auto_1fr] gap-6 items-center">
                        <Photo
                            src={PHOTOS.quote.src}
                            alt={PHOTOS.quote.alt}
                            className="w-24 h-24 rounded-2xl"
                        />
                        <div>
                            <h2 className="text-2xl font-extrabold tracking-tight mb-2">Built by a veterinarian, for <Mark>veterinarians</Mark></h2>
                            <p className="text-base text-[#1a2b4a]/65 leading-relaxed">
                                Created by Dr. Stacey Gastis, DVM. 30+ years in clinical practice. PetWise is shaped around how you actually work, not how a generic scribe thinks a SOAP should look.
                            </p>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* Trial, not pricing */}
            <section className="bg-[#f4f7fb] py-12 sm:py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <Reveal className="mb-8">
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2"><Mark>10 days</Mark> unlimited. Then you decide.</h2>
                        <p className="text-base text-[#1a2b4a]/65">No credit card. You’re not paying for another system. You’re trying the whole case, not a capped demo.</p>
                    </Reveal>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { t: '10 days unlimited', d: 'Every feature. No SOAP limits.' },
                            { t: 'No credit card', d: 'Start now. Decide later.' },
                            { t: 'Then Free or paid', d: 'You don’t lose PetWise when the trial ends.' }
                        ].map((c) => (
                            <div key={c.t} className="bg-white rounded-2xl p-6 border border-gray-100">
                                <h3 className="font-bold mb-1">{c.t}</h3>
                                <p className="text-base text-[#1a2b4a]/60">{c.d}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8">
                        <PrimaryCta onClick={() => start('trial-band')}>{copy.closeCta}</PrimaryCta>
                    </div>
                </div>
            </section>

            <section className="py-12 sm:py-16">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-6">Frequently asked <Mark>questions</Mark></h2>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                        {FAQS.map((item, i) => (
                            <button
                                key={item.q}
                                type="button"
                                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                                className="w-full text-left py-5"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <span className="font-semibold">{item.q}</span>
                                    <FaChevronDown className={`text-[#3468bd] text-xs transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                                </div>
                                {openFaq === i && (
                                    <p className="mt-2 text-base text-[#1a2b4a]/65 leading-relaxed">{item.a}</p>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-[#3468bd] text-white">
                <div className="max-w-6xl mx-auto px-4 py-14 text-center">
                    <Title parts={copy.closeTitle} className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3" />
                    <p className="text-lg text-white/80 max-w-xl mx-auto mb-7">{copy.closeMicro}</p>
                    <PrimaryCta light onClick={() => start('footer')}>
                        {copy.cta}
                    </PrimaryCta>
                </div>
            </section>

            <footer className="bg-white border-t border-gray-100">
                <div className="max-w-6xl mx-auto px-4 py-8 flex flex-wrap items-center justify-between gap-3 text-sm text-[#1a2b4a]/40">
                    <span>© {new Date().getFullYear()} Petwise.vet</span>
                    <div className="flex gap-4">
                        <a href="/privacy" className="hover:text-[#3468bd]">Privacy</a>
                        <a href="/terms" className="hover:text-[#3468bd]">Terms</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default CampaignLanding;
