import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheck, FiPlus } from 'react-icons/fi';
import { TESTIMONIALS } from './siteConfig';
import { BRAND_WASH } from '../brand';

export const Container = ({ className = '', children }) => (
    <div className={`max-w-6xl mx-auto px-5 sm:px-8 ${className}`}>{children}</div>
);

export const Section = ({ id, tone = 'white', className = '', children }) => {
    const bg = { white: 'bg-white', tint: 'bg-[#f6f8fb]', wash: BRAND_WASH, navy: 'bg-[linear-gradient(160deg,#3f7ad6_0%,#2d5fb8_45%,#2350a3_100%)] text-white' }[tone];
    return (
        <section id={id} className={`${bg} py-20 sm:py-28 ${className}`}>
            <Container>{children}</Container>
        </section>
    );
};

export const Reveal = ({ as: Tag = 'div', className = '', delay = 0, children }) => {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        if (!('IntersectionObserver' in window)) {
            el.classList.add('in');
            return undefined;
        }
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.classList.add('in');
                    io.disconnect();
                }
            },
            { rootMargin: '0px 0px -8% 0px' }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <Tag ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
            {children}
        </Tag>
    );
};

export const Eyebrow = ({ children, light = false }) => (
    <p className={`text-[13px] font-semibold tracking-[0.14em] uppercase mb-4 ${light ? 'text-[#7fd6f3]' : 'text-[#3468bd]'}`}>
        {children}
    </p>
);

export const SectionHeading = ({ eyebrow, title, body, align = 'left', light = false, className = '' }) => (
    <Reveal className={`${align === 'center' ? 'text-center mx-auto' : ''} max-w-2xl mb-12 sm:mb-16 ${className}`}>
        {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
        <h2 className="text-[2rem] sm:text-[2.75rem] leading-[1.08] font-semibold tracking-[-0.025em]">{title}</h2>
        {body && <p className={`mt-5 text-lg leading-relaxed ${light ? 'text-white/70' : 'text-[#1a2b4a]/65'}`}>{body}</p>}
    </Reveal>
);

const track = (label) => {
    if (typeof window === 'undefined') return;
    window.gtag?.('event', 'site_cta', { label, page_path: window.location.pathname });
    if (label.startsWith('signup')) window.fbq?.('track', 'Lead');
};

const BUTTON_STYLES = {
    primary: 'bg-[#2d5fb8] text-white hover:bg-[#2350a3] shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)]',
    light: 'bg-white text-[#13233f] hover:bg-[#e9f6fd]',
    ghost: 'text-[#13233f] hover:bg-[#13233f]/5',
    outline: 'border border-[#13233f]/15 text-[#13233f] hover:border-[#13233f]/40',
    glass: 'border border-white/20 bg-white/[0.06] text-white backdrop-blur hover:bg-white/[0.12] hover:border-white/30'
};

export const ButtonLink = ({ to, href, variant = 'primary', trackAs, arrow = true, className = '', children }) => {
    const cls = `group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium tracking-tight transition-all duration-200 ${BUTTON_STYLES[variant]} ${className}`;
    const inner = (
        <>
            {children}
            {arrow && <FiArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />}
        </>
    );
    const onClick = () => trackAs && track(trackAs);
    if (href) {
        return (
            <a href={href} className={cls} onClick={onClick}>
                {inner}
            </a>
        );
    }
    return (
        <Link to={to} className={cls} onClick={onClick}>
            {inner}
        </Link>
    );
};

export const SignupButton = ({ placement, variant = 'primary', children = 'Start free for 10 days', className = '' }) => (
    <ButtonLink to="/signup" variant={variant} trackAs={`signup_${placement}`} className={className}>
        {children}
    </ButtonLink>
);

export const Highlight = ({ dark = false, children }) => (
    <span
        className={`bg-clip-text text-transparent ${
            dark ? 'bg-gradient-to-r from-[#2d5fb8] via-[#3a7be0] to-[#4fb8e6]' : 'bg-gradient-to-r from-[#c6f1ff] via-[#9fe3fb] to-white'
        }`}
    >
        {children}
    </span>
);

// Photo bleeds off the right edge and fades into the background behind the copy. Below lg it stacks under the copy.
export const PhotoHero = ({ eyebrow, title, body, children, microcopy, image, imageAlt, imagePosition = 'center', badge }) => (
    <section className="relative -mt-[76px] overflow-hidden bg-[#f6f1ec]">
        <div className="hidden lg:block absolute inset-y-0 right-0 w-[62%] [mask-image:linear-gradient(to_right,transparent_8%,black_52%)]">
            <img src={image} alt={imageAlt} className="w-full h-full object-cover" style={{ objectPosition: imagePosition }} fetchpriority="high" />
        </div>
        <Container className="relative pt-32 sm:pt-44 lg:pt-40 pb-0 lg:pb-24 lg:min-h-[720px] lg:flex lg:flex-col lg:justify-center">
            <div className="site-hero-in max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
                {eyebrow && <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#2d5fb8]">{eyebrow}</p>}
                <h1 className="mt-5 text-[2.75rem] sm:text-[4rem] lg:text-[4.5rem] leading-[1.02] font-semibold tracking-[-0.04em] text-[#13233f] text-balance">
                    {title}
                </h1>
                {body && <p className="mt-6 max-w-lg mx-auto lg:mx-0 text-lg sm:text-xl leading-relaxed text-[#1a2b4a]/70">{body}</p>}
                {children && <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:justify-center lg:justify-start">{children}</div>}
                {microcopy && <p className="mt-5 text-sm text-[#1a2b4a]/55">{microcopy}</p>}
            </div>
            {badge && <div className="site-hero-media mt-10 flex justify-center lg:block lg:mt-0 lg:absolute lg:right-8 lg:bottom-32">{badge}</div>}
        </Container>
        <img src={image} alt="" aria-hidden className="lg:hidden relative mt-10 w-full aspect-[4/3] sm:aspect-[16/9] object-cover" style={{ objectPosition: imagePosition }} />
    </section>
);

const OVERLAP = {
    sm: ['-mb-16 sm:-mb-24', 'h-16 sm:h-24'],
    md: ['-mb-24 sm:-mb-40', 'h-24 sm:h-40'],
    lg: ['-mb-32 sm:-mb-56', 'h-32 sm:h-56']
};

// Brand blue, centered page hero. The floating header sits over its top edge.
// media hangs off the bottom edge into the white section below by `overlap`.
export const Hero = ({ eyebrow, title, body, children, microcopy, media, mediaClassName = 'max-w-5xl', overlap = 'md', below = 'white', after }) => {
    const [pull, spacer] = OVERLAP[overlap];
    return (
        <>
            <section className="relative -mt-[76px] text-white">
                <div aria-hidden className="absolute inset-0 overflow-hidden bg-[linear-gradient(160deg,#3f7ad6_0%,#2d5fb8_45%,#2350a3_100%)]">
                    <div className="absolute inset-0 bg-[radial-gradient(55%_60%_at_50%_-5%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_70%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(35%_45%_at_90%_25%,rgba(92,204,240,0.4)_0%,rgba(92,204,240,0)_70%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(35%_45%_at_5%_75%,rgba(92,204,240,0.22)_0%,rgba(92,204,240,0)_70%)]" />
                </div>
                <Container className={`relative flow-root pt-32 sm:pt-44 text-center ${media ? '' : 'pb-24 sm:pb-32'}`}>
                    <div className="site-hero-in max-w-4xl mx-auto">
                        {eyebrow && (
                            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[13px] text-white/80 backdrop-blur">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#5cccf0] shadow-[0_0_10px_rgba(92,204,240,0.9)]" />
                                {eyebrow}
                            </p>
                        )}
                        <h1 className="mt-7 text-[2.9rem] sm:text-[4.5rem] lg:text-[5.25rem] leading-[1] font-semibold tracking-[-0.045em] text-balance">
                            {title}
                        </h1>
                        {body && <p className="mx-auto mt-7 max-w-2xl text-lg sm:text-xl leading-relaxed text-white/70 text-balance">{body}</p>}
                        {children && <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">{children}</div>}
                        {microcopy && <p className="mt-5 text-sm text-white/60">{microcopy}</p>}
                        {after}
                    </div>
                    {media && (
                        <div className={`site-hero-media relative z-10 mx-auto mt-16 sm:mt-20 ${mediaClassName} ${pull}`}>
                            <div aria-hidden className="absolute -inset-x-4 sm:-inset-x-16 -top-16 bottom-1/3 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(92,204,240,0.35)_0%,rgba(92,204,240,0)_70%)] blur-2xl" />
                            <div className="relative">{media}</div>
                        </div>
                    )}
                </Container>
            </section>
            {media && <div aria-hidden className={`${below === 'tint' ? 'bg-[#f6f8fb]' : 'bg-white'} ${spacer}`} />}
        </>
    );
};

export const SplitHero = ({ eyebrow, title, body, children, microcopy, image, imageAlt, imageClassName = '', media, badge, badgeClassName = 'left-3 bottom-3 sm:-left-8 sm:bottom-10', aspect = 'aspect-[4/3] lg:aspect-[5/6]' }) => (
    <section className="relative -mt-[76px] overflow-hidden bg-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(45%_60%_at_82%_35%,#e2edfc_0%,rgba(255,255,255,0)_70%)]" />
        <Container className="relative pt-28 sm:pt-40 pb-14 sm:pb-24 grid lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            <div className="site-hero-in lg:col-span-6 text-center lg:text-left">
                {eyebrow && <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#2d5fb8]">{eyebrow}</p>}
                <h1 className="mt-5 text-[2.75rem] sm:text-[3.75rem] lg:text-[4rem] leading-[1.03] font-semibold tracking-[-0.04em] text-[#13233f] text-balance">
                    {title}
                </h1>
                {body && <p className="mt-6 max-w-lg mx-auto lg:mx-0 text-lg sm:text-xl leading-relaxed text-[#1a2b4a]/70">{body}</p>}
                {children && <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:justify-center lg:justify-start">{children}</div>}
                {microcopy && <p className="mt-5 text-sm text-[#1a2b4a]/55">{microcopy}</p>}
            </div>
            <div className="site-hero-media relative lg:col-span-6 lg:col-start-7">
                {media || (
                    <div className="relative">
                        <div aria-hidden className="absolute -right-3 -bottom-3 sm:-right-6 sm:-bottom-6 w-2/3 h-2/3 rounded-[36px] bg-[linear-gradient(160deg,#3f7ad6_0%,#2d5fb8_45%,#2350a3_100%)]" />
                        <div className={`relative overflow-hidden rounded-[32px] shadow-[0_40px_80px_-30px_rgba(19,35,63,0.45)] ${aspect}`}>
                            <img src={image} alt={imageAlt} className={`w-full h-full object-cover ${imageClassName}`} fetchpriority="high" />
                        </div>
                        {badge && <div className={`absolute ${badgeClassName}`}>{badge}</div>}
                    </div>
                )}
            </div>
        </Container>
    </section>
);

export const HeroPhoto = ({ src, alt, className = '', aspect = 'aspect-[16/10] sm:aspect-[2/1]' }) => (
    <div className={`overflow-hidden rounded-[28px] ring-1 ring-white/15 shadow-[0_60px_120px_-40px_rgba(19,35,63,0.55)] ${aspect}`}>
        <img src={src} alt={alt} className={`w-full h-full object-cover ${className}`} fetchpriority="high" />
    </div>
);

export const PageHero = ({ image, imageAlt, photo, photoClassName = '', media, ...props }) => (
    <Hero
        {...props}
        media={
            media ||
            (image &&
                (photo ? (
                    <HeroPhoto src={image} alt={imageAlt} className={photoClassName} />
                ) : (
                    <img src={image} alt={imageAlt} className="w-full h-auto" width="1800" height="1272" fetchpriority="high" />
                )))
        }
    />
);

export const Microcopy = ({ children, light = false, center = false }) => (
    <p className={`mt-4 text-sm ${light ? 'text-white/55' : 'text-[#1a2b4a]/45'} ${center ? 'text-center' : ''}`}>{children}</p>
);

export const FeatureGrid = ({ items, columns = 3 }) => (
    <div className={`grid gap-4 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''}`}>
        {items.map(({ icon: Icon, title, body, to }, i) => {
            const card = (
                <div className="h-full rounded-[28px] border border-[#e7ecf3] bg-white p-7 sm:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(19,35,63,0.25)]">
                    {Icon && (
                        <div className="w-11 h-11 rounded-2xl bg-[#e9f6fd] text-[#3468bd] flex items-center justify-center mb-6">
                            <Icon className="text-[19px]" aria-hidden />
                        </div>
                    )}
                    <h3 className="text-lg font-semibold tracking-tight text-[#13233f]">{title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#1a2b4a]/60">{body}</p>
                    {to && (
                        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#3468bd]">
                            Learn more <FiArrowRight aria-hidden />
                        </span>
                    )}
                </div>
            );
            return (
                <Reveal key={title} delay={(i % 3) * 70}>
                    {to ? (
                        <Link to={to} className="block h-full">
                            {card}
                        </Link>
                    ) : (
                        card
                    )}
                </Reveal>
            );
        })}
    </div>
);

export const Steps = ({ items, light = false }) => (
    <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {items.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 90}>
                <span className={`block text-sm font-semibold tabular-nums ${light ? 'text-[#7fd6f3]' : 'text-[#3468bd]'}`}>
                    {String(i + 1).padStart(2, '0')}
                </span>
                <div className={`mt-3 h-px ${light ? 'bg-white/15' : 'bg-[#13233f]/10'}`} />
                <h3 className="mt-6 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className={`mt-2 text-[15px] leading-relaxed ${light ? 'text-white/65' : 'text-[#1a2b4a]/60'}`}>{s.body}</p>
            </Reveal>
        ))}
    </ol>
);

export const CheckList = ({ items, light = false }) => (
    <ul className="space-y-3.5">
        {items.map((item) => (
            <li key={item} className="flex gap-3 text-[15px] leading-relaxed">
                <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${light ? 'bg-white/10 text-[#7fd6f3]' : 'bg-[#e9f6fd] text-[#3468bd]'}`}>
                    <FiCheck className="text-[12px]" aria-hidden />
                </span>
                <span className={light ? 'text-white/80' : 'text-[#1a2b4a]/75'}>{item}</span>
            </li>
        ))}
    </ul>
);

export const SplitFeature = ({ eyebrow, title, body, points, image, imageAlt, media, photo, photoClassName, placeholder, reverse = false, children }) => (
    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <Reveal className={reverse ? 'lg:order-2' : ''}>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h2 className="text-[1.9rem] sm:text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.025em] text-[#13233f]">{title}</h2>
            {body && <p className="mt-5 text-lg leading-relaxed text-[#1a2b4a]/65">{body}</p>}
            {points && (
                <div className="mt-8">
                    <CheckList items={points} />
                </div>
            )}
            {children}
        </Reveal>
        <Reveal className={reverse ? 'lg:order-1' : ''} delay={120}>
            {media ||
                (photo ? (
                    <RoundedPhoto src={photo} alt={imageAlt} className={photoClassName} />
                ) : image ? (
                    <ProductFrame src={image} alt={imageAlt} />
                ) : (
                    <Placeholder label={placeholder} />
                ))}
        </Reveal>
    </div>
);

export const ProductFrame = ({ src, alt }) => (
    <div className="rounded-[28px] bg-gradient-to-br from-[#e9f6fd] to-[#f6f8fb] p-3 sm:p-5">
        <img src={src} alt={alt} loading="lazy" className="w-full h-auto rounded-[18px] shadow-[0_30px_60px_-30px_rgba(19,35,63,0.35)]" />
    </div>
);

export const Photo = ({ src, alt, className = '' }) => (
    <img src={src} alt={alt} loading="lazy" className={`w-full h-full object-cover ${className}`} />
);

export const RoundedPhoto = ({ src, alt, className = '', aspect = 'aspect-[4/3]' }) => (
    <div className={`overflow-hidden rounded-[28px] ${aspect}`}>
        <Photo src={src} alt={alt} className={className} />
    </div>
);

export const ImageBand = ({ src, alt, title, body, imageClassName = '', children }) => (
    <section className="bg-white px-3 sm:px-5">
        <div className="relative overflow-hidden rounded-[32px] min-h-[420px] sm:min-h-[520px]">
            <Photo src={src} alt={alt} className={`absolute inset-0 ${imageClassName}`} />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#13233f]/85 via-[#13233f]/50 to-transparent" />
            <Container className="relative py-20 sm:py-28">
                <Reveal className="max-w-md text-white">
                    <h2 className="text-[2rem] sm:text-[2.75rem] leading-[1.08] font-semibold tracking-[-0.03em]">{title}</h2>
                    {body && <p className="mt-5 text-lg text-white/75">{body}</p>}
                    {children}
                </Reveal>
            </Container>
        </div>
    </section>
);

export const PhotoStrip = ({ photos }) => (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        {photos.map((p, i) => (
            <Reveal key={p.src} delay={i * 90} className={`overflow-hidden rounded-[24px] aspect-[4/3] ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
                <Photo src={p.src} alt={p.alt} className={p.className} />
            </Reveal>
        ))}
    </div>
);

export const Placeholder = ({ label = 'Image placeholder', className = 'aspect-[4/3]' }) => (
    <div
        className={`rounded-[28px] border border-dashed border-[#3468bd]/25 bg-[linear-gradient(135deg,#f6f8fb,#e9f6fd)] flex items-center justify-center p-8 text-center ${className}`}
        role="img"
        aria-label={label}
    >
        <span className="text-sm font-medium text-[#3468bd]/60">{label}</span>
    </div>
);

export const FaqList = ({ faqs }) => (
    <div className="divide-y divide-[#13233f]/10 border-y border-[#13233f]/10">
        {faqs.map((f) => (
            <details key={f.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                    <h3 className="text-[17px] font-medium tracking-tight text-[#13233f]">{f.q}</h3>
                    <FiPlus className="mt-1 flex-shrink-0 text-[#3468bd] transition-transform duration-200 group-open:rotate-45" aria-hidden />
                </summary>
                <p className="mt-4 pr-10 text-[15px] leading-relaxed text-[#1a2b4a]/65">{f.a}</p>
            </details>
        ))}
    </div>
);

export const FaqSection = ({ faqs, title = 'Questions, answered', tone = 'white' }) => (
    <Section tone={tone}>
        <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
                <Reveal>
                    <h2 className="text-[2rem] sm:text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.025em] text-[#13233f]">{title}</h2>
                    <p className="mt-4 text-[15px] text-[#1a2b4a]/60">
                        Something else on your mind? Email{' '}
                        <a href="mailto:support@petwise.vet" className="text-[#3468bd] underline underline-offset-4">
                            support@petwise.vet
                        </a>
                        .
                    </p>
                </Reveal>
            </div>
            <div className="lg:col-span-8">
                <FaqList faqs={faqs} />
            </div>
        </div>
    </Section>
);

export const Testimonials = ({ tone = 'white' }) => (
    <Section tone={tone}>
        <SectionHeading eyebrow="From the clinic" title="Vets who stopped charting at night." />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
                <Reveal key={t.name} delay={i * 90}>
                    <figure className={`h-full rounded-[28px] p-8 sm:p-9 flex flex-col ${tone === 'tint' ? 'bg-white' : 'bg-[#f6f8fb]'}`}>
                        <blockquote className="text-[17px] leading-relaxed text-[#13233f] tracking-[-0.01em] flex-1">
                            “{t.quote}”
                        </blockquote>
                        <figcaption className="mt-8 flex items-center gap-3">
                            {t.photo ? (
                                <img src={t.photo} alt={t.name} loading="lazy" className="w-11 h-11 rounded-full object-cover" />
                            ) : (
                                <span className="w-11 h-11 rounded-full bg-[#13233f] text-white text-sm font-semibold flex items-center justify-center">
                                    {t.initials}
                                </span>
                            )}
                            <span className="text-[15px] font-medium text-[#13233f]">{t.name}</span>
                        </figcaption>
                    </figure>
                </Reveal>
            ))}
        </div>
    </Section>
);

export const CtaBand = ({ title = 'Your next appointment can be your first PetWise record.', body = '10 days unlimited. No credit card. Keep PetWise Free when the trial ends.' }) => (
    <section className="bg-white px-3 sm:px-5 pb-3 sm:pb-5">
        <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(160deg,#3f7ad6_0%,#2d5fb8_45%,#2350a3_100%)] text-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_85%_0%,rgba(92,204,240,0.4)_0%,rgba(92,204,240,0)_70%)]" />
            <Container className="relative py-20 sm:py-28 text-center">
                <Reveal>
                    <h2 className="mx-auto max-w-3xl text-[2rem] sm:text-[3rem] leading-[1.06] font-semibold tracking-[-0.03em]">{title}</h2>
                    <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">{body}</p>
                    <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                        <SignupButton placement="cta_band" variant="light" />
                        <ButtonLink to="/pricing" variant="ghost" className="!text-white hover:!bg-white/10">
                            See pricing
                        </ButtonLink>
                    </div>
                </Reveal>
            </Container>
        </div>
    </section>
);
