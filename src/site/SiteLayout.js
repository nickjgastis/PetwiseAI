import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { FiMenu, FiX } from 'react-icons/fi';
import { FaFacebookF, FaInstagram } from 'react-icons/fa';
import { FOOTER, NAV, SOCIALS } from './siteConfig';
import { ButtonLink, Container } from './ui';
import './site.css';

const Logo = () => (
    <Link to="/" className="flex items-center gap-2.5" aria-label="PetWise home">
        <img src="/PW.png" alt="" className="w-8 h-8 object-contain" width="32" height="32" />
        <span className={`text-[17px] font-semibold tracking-tight transition-colors text-[#13233f]`}>
            PetWise<span className={`font-normal text-[#13233f]/35`}>.vet</span>
        </span>
    </Link>
);

const Header = () => {
    const { isAuthenticated } = useAuth0();
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => setOpen(false), [pathname]);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const navClass = ({ isActive }) =>
        `px-3 py-2 rounded-full text-[14px] transition-colors ${isActive ? 'text-[#2d5fb8]' : 'text-[#13233f]/65 hover:text-[#13233f]'}`;

    return (
        <header className="sticky top-0 z-50 h-[76px] px-3 sm:px-5 pt-3">
            <div
                className={`mx-auto max-w-6xl rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-[#13233f]/[0.06] transition-shadow duration-300 ${
                    scrolled || open ? 'shadow-[0_12px_40px_-12px_rgba(19,35,63,0.25)]' : 'shadow-[0_8px_30px_-14px_rgba(19,35,63,0.18)]'
                }`}
            >
                <div className="h-16 px-4 sm:px-5 flex items-center justify-between">
                    <Logo />
                    <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
                        {NAV.map((n) => (
                            <NavLink key={n.to} to={n.to} className={navClass}>
                                {n.label}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="hidden lg:flex items-center gap-2">
                        {isAuthenticated ? (
                            <ButtonLink to="/dashboard" className="!py-2.5 !px-5 !text-[14px]">
                                Open dashboard
                            </ButtonLink>
                        ) : (
                            <>
                                <Link to="/login" className="px-3 py-2 text-[14px] text-[#13233f]/65 hover:text-[#13233f] transition-colors">
                                    Sign in
                                </Link>
                                <ButtonLink to="/signup" trackAs="signup_header" arrow={false} className="!py-2.5 !px-5 !text-[14px]">
                                    Start free
                                </ButtonLink>
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        className="lg:hidden -mr-2 p-2 text-[#13233f]"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        aria-label={open ? 'Close menu' : 'Open menu'}
                    >
                        {open ? <FiX className="text-[22px]" /> : <FiMenu className="text-[22px]" />}
                    </button>
                </div>
                {open && (
                    <div className="lg:hidden border-t border-[#13233f]/[0.06] px-4 sm:px-5 py-4 flex flex-col">
                        {NAV.map((n) => (
                            <Link key={n.to} to={n.to} className="py-3 text-[17px] text-[#13233f]">
                                {n.label}
                            </Link>
                        ))}
                        <div className="mt-4 pt-4 border-t border-[#13233f]/[0.06] flex flex-col gap-3 pb-2">
                            {isAuthenticated ? (
                                <ButtonLink to="/dashboard">Open dashboard</ButtonLink>
                            ) : (
                                <>
                                    <ButtonLink to="/signup" trackAs="signup_mobile_menu">
                                        Start free for 10 days
                                    </ButtonLink>
                                    <ButtonLink to="/login" variant="outline" arrow={false}>
                                        Sign in
                                    </ButtonLink>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

const Footer = () => (
    <footer className="bg-white">
        <Container className="pt-20 pb-10">
            <div className="grid gap-12 lg:grid-cols-12">
                <div className="lg:col-span-4">
                    <Logo />
                    <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-[#1a2b4a]/55">
                        The veterinary AI scribe and clinical assistant. Built by a veterinarian, for veterinarians.
                    </p>
                    <div className="mt-6 flex gap-2">
                        <a href={SOCIALS.facebook} target="_blank" rel="noopener noreferrer" aria-label="PetWise on Facebook" className="w-9 h-9 rounded-full border border-[#13233f]/10 flex items-center justify-center text-[#13233f]/60 hover:text-[#13233f] hover:border-[#13233f]/30 transition-colors">
                            <FaFacebookF className="text-[13px]" />
                        </a>
                        <a href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer" aria-label="PetWise on Instagram" className="w-9 h-9 rounded-full border border-[#13233f]/10 flex items-center justify-center text-[#13233f]/60 hover:text-[#13233f] hover:border-[#13233f]/30 transition-colors">
                            <FaInstagram className="text-[14px]" />
                        </a>
                    </div>
                </div>
                {FOOTER.map((col) => (
                    <div key={col.title} className="lg:col-span-2 lg:col-start-auto">
                        <h2 className="text-[13px] font-semibold tracking-[0.12em] uppercase text-[#13233f]/40">{col.title}</h2>
                        <ul className="mt-5 space-y-3">
                            {col.links.map((l) => (
                                <li key={l.label}>
                                    {l.href ? (
                                        <a href={l.href} className="text-[15px] text-[#13233f]/70 hover:text-[#13233f] transition-colors">
                                            {l.label}
                                        </a>
                                    ) : (
                                        <Link to={l.to} className="text-[15px] text-[#13233f]/70 hover:text-[#13233f] transition-colors">
                                            {l.label}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className="mt-16 pt-8 border-t border-[#13233f]/[0.06] flex flex-col sm:flex-row gap-3 justify-between text-[13px] text-[#13233f]/40">
                <span>© {new Date().getFullYear()} PetWise. All rights reserved.</span>
                <span>Made for veterinary teams in the US and Canada.</span>
            </div>
        </Container>
    </footer>
);

const SiteLayout = ({ children }) => {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        if (!hash) window.scrollTo(0, 0);
    }, [pathname, hash]);

    return (
        <div className="site min-h-screen bg-white text-[#1a2b4a] antialiased">
            <Header />
            <main>{children}</main>
            <Footer />
        </div>
    );
};

export default SiteLayout;
