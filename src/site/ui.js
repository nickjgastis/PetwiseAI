import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheck, FiPlus } from 'react-icons/fi';
import { TESTIMONIALS } from './siteConfig';

export const Container = ({ className = '', children }) => (
    <div className={`max-w-6xl mx-auto px-5 sm:px-8 ${className}`}>{children}</div>
);

export const Section = ({ id, tone = 'white', className = '', children }) => {
    const bg = { white: 'bg-white', tint: 'bg-[#f6f8fb]', navy: 'bg-[#13233f] text-white' }[tone];
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
    primary: 'bg-[#13233f] text-white hover:bg-[#3468bd] shadow-[0_10px_30px_-12px_rgba(19,35,63,0.6)]',
    light: 'bg-white text-[#13233f] hover:bg-[#e9f6fd]',
    ghost: 'text-[#13233f] hover:bg-[#13233f]/5',
    outline: 'border border-[#13233f]/15 text-[#13233f] hover:border-[#13233f]/40'
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

export const PageHero = ({ eyebrow, title, body, image, imageAlt, photo, photoClassName = '', children, center = false }) => (
    <section className="relative overflow-hidden bg-white">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(60%_60%_at_70%_10%,#e3f3fd_0%,rgba(255,255,255,0)_70%)]" />
        <Container className={`relative pt-14 sm:pt-24 ${image ? 'pb-16 sm:pb-24' : 'pb-12 sm:pb-20'}`}>
            <div className={image ? 'grid lg:grid-cols-12 gap-12 lg:gap-8 items-center' : ''}>
                <div className={image ? 'lg:col-span-5' : `max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
                    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
                    <h1 className="text-[2.6rem] sm:text-[3.75rem] leading-[1.03] font-semibold tracking-[-0.035em] text-[#13233f]">
                        {title}
                    </h1>
                    {body && <p className="mt-6 text-lg sm:text-xl leading-relaxed text-[#1a2b4a]/65 max-w-xl">{body}</p>}
                    {children && <div className={`mt-9 flex flex-col sm:flex-row gap-3 ${center ? 'sm:justify-center' : ''}`}>{children}</div>}
                </div>
                {image && (
                    <div className="lg:col-span-7">
                        {photo ? (
                            <RoundedPhoto src={image} alt={imageAlt} className={photoClassName} />
                        ) : (
                            <img src={image} alt={imageAlt} className="w-full h-auto" width="1800" height="1272" />
                        )}
                    </div>
                )}
            </div>
        </Container>
    </section>
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
        <div className="relative overflow-hidden rounded-[32px] bg-[#13233f] text-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_85%_0%,rgba(92,204,240,0.28)_0%,rgba(19,35,63,0)_70%)]" />
            <Container className="relative py-20 sm:py-28 text-center">
                <Reveal>
                    <h2 className="mx-auto max-w-3xl text-[2rem] sm:text-[3rem] leading-[1.06] font-semibold tracking-[-0.03em]">{title}</h2>
                    <p className="mx-auto mt-5 max-w-xl text-lg text-white/65">{body}</p>
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
