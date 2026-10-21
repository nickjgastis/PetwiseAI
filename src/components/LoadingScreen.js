import React from 'react';

const KEYFRAMES = `
@keyframes pw-load-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes pw-load-breathe { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.06) } }
@keyframes pw-load-bar { 0% { transform: translateX(-100%) } 100% { transform: translateX(250%) } }
@media (prefers-reduced-motion: reduce) { .pw-load-anim { animation: none !important } }
`;

// Full-screen app loader. Pure CSS so it paints instantly; fades in after a beat
// so fast loads don't flash it.
const LoadingScreen = ({ label }) => (
    <div
        role="status"
        aria-live="polite"
        className="min-h-screen flex flex-col items-center justify-center"
        style={{
            background:
                'radial-gradient(90% 50% at 50% 0%, rgba(92,204,240,0.22) 0%, rgba(45,95,184,0) 70%), linear-gradient(180deg, #2d5fb8 0%, #1e4a94 55%, #183d7a 100%)'
        }}
    >
        <style>{KEYFRAMES}</style>
        <div className="flex flex-col items-center" style={{ opacity: 0, animation: 'pw-load-in 300ms ease-out 150ms forwards' }}>
            <img
                src="/apple-touch-icon.png"
                alt=""
                width="56"
                height="56"
                className="pw-load-anim w-14 h-14 rounded-[16px] shadow-[0_12px_32px_-8px_rgba(8,20,48,0.55)]"
                style={{ animation: 'pw-load-breathe 1.8s ease-in-out infinite' }}
            />
            <div className="mt-6 h-[3px] w-24 rounded-full bg-white/15 overflow-hidden">
                <div
                    className="pw-load-anim h-full w-2/5 rounded-full bg-white/80"
                    style={{ animation: 'pw-load-bar 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                />
            </div>
            <span className={label ? 'mt-4 text-[13px] font-medium tracking-tight text-white/70' : 'sr-only'}>
                {label || 'Loading'}
            </span>
        </div>
    </div>
);

export default LoadingScreen;
