import React, { useEffect, useState } from 'react';
import { FiX, FiShare, FiMoreHorizontal, FiMoreVertical, FiPlusSquare, FiCopy, FiCheck } from 'react-icons/fi';
import { installPlatform, canPromptInstall, promptInstall } from '../utils/install';

const Icon = ({ children }) => (
    <span className="inline-flex items-center justify-center w-6 h-6 mx-1 rounded-md bg-white text-[#2d5fb8] align-middle text-[14px]">
        {children}
    </span>
);

const STEPS = {
    'ios-safari': [
        <>Tap <Icon><FiShare /></Icon> Share. It’s in Safari’s bottom bar, or under <Icon><FiMoreHorizontal /></Icon></>,
        <>Scroll down and tap <strong>Add to Home Screen</strong> <Icon><FiPlusSquare /></Icon></>,
        <>Tap <strong>Add</strong>, then open PetWise from your home screen</>
    ],
    'ios-chrome': [
        <>Tap <Icon><FiShare /></Icon> Share, at the right of the address bar</>,
        <>Tap <strong>Add to Home Screen</strong> <Icon><FiPlusSquare /></Icon></>,
        <>Tap <strong>Add</strong>, then open PetWise from your home screen</>
    ],
    android: [
        <>Tap <Icon><FiMoreVertical /></Icon> in the top right of Chrome</>,
        <>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong></>,
        <>Open PetWise from your home screen</>
    ],
    'in-app': [
        <>Tap <Icon><FiMoreHorizontal /></Icon> in the top right corner</>,
        <>Tap <strong>Open in browser</strong> (or Open in Safari / Chrome)</>,
        <>Log in, then tap <strong>Get the app</strong> on your Profile again</>
    ],
    other: [
        <>Open your browser menu</>,
        <>Tap <strong>Add to Home Screen</strong> or <strong>Install</strong></>,
        <>Open PetWise from your home screen</>
    ]
};

// User-invoked install instructions (Profile → Get the app). Always dismissible.
const InstallPrompt = ({ onClose }) => {
    const platform = installPlatform();
    const [canPrompt, setCanPrompt] = useState(canPromptInstall);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const onPrompt = (e) => {
            e.preventDefault();
            window.deferredInstallPrompt = e;
            setCanPrompt(true);
        };
        const onInstalled = () => onClose?.();
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, [onClose]);

    const install = async () => {
        if (await promptInstall()) onClose?.();
        else setCanPrompt(false);
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText('https://petwise.vet/dashboard');
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    const inApp = platform === 'in-app';
    const title = inApp ? 'Open in your browser' : 'Get the PetWise app';
    const subtitle = inApp
        ? 'This app’s built-in browser can’t install PetWise. Open it in Safari or Chrome first.'
        : 'Add PetWise to your home screen. It opens full screen, stays logged in, and records faster.';

    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col overflow-y-auto bg-gradient-to-b from-[#3a72cc] to-[#2d5fb8] text-white"
            style={{ overscrollBehavior: 'contain' }}
        >
            <div className="flex justify-end px-4 pt-[max(12px,env(safe-area-inset-top))]">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 active:bg-white/25 text-[18px]"
                >
                    <FiX />
                </button>
            </div>

            <div className="my-auto w-full max-w-sm mx-auto px-6 pt-2 pb-[max(24px,env(safe-area-inset-bottom))] text-center">
                <img src="/apple-touch-icon.png" alt="" className="w-16 h-16 rounded-[18px] mx-auto mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)]" />
                <h1 className="m-0 mb-2 text-[26px] font-bold tracking-[-0.02em] leading-tight">{title}</h1>
                <p className="m-0 mb-5 text-[15px] text-white/85 leading-relaxed">{subtitle}</p>

                {canPrompt && !inApp ? (
                    <button
                        type="button"
                        onClick={install}
                        className="w-full h-14 rounded-2xl bg-white text-[#2d5fb8] text-[17px] font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-transform"
                    >
                        Install PetWise
                    </button>
                ) : (
                    <ol className="m-0 p-4 list-none rounded-2xl bg-white/15 backdrop-blur-md text-left space-y-3.5">
                        {STEPS[platform].map((step, n) => (
                            <li key={n} className="flex items-start gap-3 text-[15px] leading-snug">
                                <span className="w-7 h-7 shrink-0 rounded-full bg-white text-[#2d5fb8] flex items-center justify-center text-[14px] font-bold">
                                    {n + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>
                )}

                {inApp && (
                    <button
                        type="button"
                        onClick={copyLink}
                        className="mt-3 w-full h-12 rounded-2xl bg-white text-[#2d5fb8] text-[15px] font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                        {copied ? <><FiCheck /> Link copied, paste it in Safari</> : <><FiCopy /> Copy link</>}
                    </button>
                )}

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 px-4 py-2 bg-transparent border-none text-[14px] text-white/60 underline underline-offset-[3px]"
                >
                    Maybe later
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;
