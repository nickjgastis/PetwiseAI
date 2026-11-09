import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiCopy, FiCompass, FiChrome, FiGlobe, FiMoreHorizontal } from 'react-icons/fi';
import { browserLinks, externalSignupUrl } from '../utils/install';

const ICONS = { safari: FiCompass, chrome: FiChrome, default: FiGlobe };

// Shown instead of Auth0 when sign-up is tapped inside Instagram/Facebook webviews,
// which can't install the app and don't share a login with the phone's real browser.
const InAppHandoff = ({ returnTo, loginHint, onContinueHere }) => {
    const url = externalSignupUrl({ returnTo, loginHint });
    const [copied, setCopied] = useState(false);

    const track = (choice) => window.gtag?.('event', 'inapp_handoff', { choice });

    const copy = async () => {
        track('copy');
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            window.prompt('Copy this link', url);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex flex-col overflow-y-auto bg-gradient-to-b from-[#3a72cc] to-[#2d5fb8] text-white"
            style={{ overscrollBehavior: 'contain', fontFamily: 'var(--font-sans)' }}
        >
            <div className="my-auto w-full max-w-sm mx-auto px-6 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] text-center">
                <img src="/apple-touch-icon.png" alt="" className="w-16 h-16 rounded-[18px] mx-auto mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)]" />
                <h1 className="m-0 mb-2 text-[26px] font-bold tracking-[-0.02em] leading-tight">Pick your browser</h1>
                <p className="m-0 mb-6 text-[15px] text-white/85 leading-relaxed">
                    Sign up in your phone’s browser so you can install the PetWise app and stay logged in.
                </p>

                <div className="space-y-3">
                    {browserLinks(url).map(({ id, label, href }, n) => {
                        const Icon = ICONS[id];
                        return (
                            <a
                                key={id}
                                href={href}
                                onClick={() => track(id)}
                                className={`flex items-center justify-center gap-2.5 h-14 rounded-2xl text-[17px] font-semibold no-underline active:scale-[0.98] transition-transform ${
                                    n === 0
                                        ? 'bg-white text-[#2d5fb8] shadow-[0_4px_14px_rgba(0,0,0,0.15)]'
                                        : 'bg-white/15 text-white ring-1 ring-white/25'
                                }`}
                            >
                                <Icon className="text-[20px]" /> {label}
                            </a>
                        );
                    })}
                    <button
                        type="button"
                        onClick={copy}
                        className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-transparent text-[15px] font-semibold text-white ring-1 ring-white/25 active:scale-[0.98] transition-transform"
                    >
                        {copied ? <><FiCheck /> Copied. Paste it in your browser</> : <><FiCopy /> Copy link</>}
                    </button>
                </div>

                <p className="m-0 mt-5 text-[13px] text-white/65 leading-relaxed">
                    Nothing happened? Tap <FiMoreHorizontal className="inline align-[-2px]" /> at the top right, then <strong className="text-white/85">Open in browser</strong>.
                </p>

                <button
                    type="button"
                    onClick={() => {
                        track('continue_here');
                        onContinueHere();
                    }}
                    className="mt-4 px-4 py-2 bg-transparent border-none text-[14px] text-white/55 underline underline-offset-[3px]"
                >
                    Continue here instead
                </button>
            </div>
        </div>,
        document.body
    );
};

export default InAppHandoff;
