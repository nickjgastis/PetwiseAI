import React from 'react';
import { FaClipboardList, FaFileAlt, FaPhoneAlt } from 'react-icons/fa';

const TYPE_INFO = {
    soap: { icon: FaClipboardList, iconClass: 'text-blue-600', chip: 'SOAP Record', noun: 'SOAP report' },
    summary: { icon: FaFileAlt, iconClass: 'text-emerald-600', chip: 'Summary', noun: 'summary' },
    callback: { icon: FaPhoneAlt, iconClass: 'text-amber-600', chip: 'Callback', noun: 'callback notes' }
};

const ORBS = [
    { size: 'w-32 h-32', color: '#3b82f6', opacity: 'opacity-70', anim: 'genFloat1 20s' },
    { size: 'w-28 h-28', color: '#10b981', opacity: 'opacity-70', anim: 'genFloat2 25s' },
    { size: 'w-36 h-36', color: '#f59e0b', opacity: 'opacity-60', anim: 'genFloat3 22s' },
    { size: 'w-24 h-24', color: '#ef4444', opacity: 'opacity-60', anim: 'genFloat4 28s' }
];

const GeneratingLoader = ({ recordType = 'soap', left = 0, subtitle = 'This will be automatically saved to your records' }) => {
    const info = TYPE_INFO[recordType] || TYPE_INFO.soap;
    const Icon = info.icon;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{ left }}>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white">
                {ORBS.map((o) => (
                    <div
                        key={o.color}
                        className={`absolute ${o.size} rounded-full ${o.opacity} blur-2xl`}
                        style={{ background: o.color, animation: `${o.anim} ease-in-out infinite` }}
                    />
                ))}
            </div>
            <div className="relative z-10 text-center px-6">
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm shadow-lg">
                        <Icon className={info.iconClass} />
                        <span className="font-semibold text-primary-700">{info.chip}</span>
                    </div>
                </div>
                <h2 className="text-3xl font-bold text-primary-700 mb-3">Generating your {info.noun}...</h2>
                <p className="text-primary-600/70 text-lg">{subtitle}</p>
            </div>
            <style>{`
                @keyframes genFloat1 {
                    0%, 100% { top: 15%; left: 20%; transform: scale(1); }
                    25% { top: 60%; left: 70%; transform: scale(1.2); }
                    50% { top: 75%; left: 25%; transform: scale(0.8); }
                    75% { top: 30%; left: 65%; transform: scale(1.1); }
                }
                @keyframes genFloat2 {
                    0%, 100% { top: 70%; left: 60%; transform: scale(1); }
                    25% { top: 20%; left: 15%; transform: scale(0.9); }
                    50% { top: 40%; left: 75%; transform: scale(1.3); }
                    75% { top: 80%; left: 35%; transform: scale(1); }
                }
                @keyframes genFloat3 {
                    0%, 100% { top: 40%; left: 80%; transform: scale(1); }
                    25% { top: 75%; left: 40%; transform: scale(1.1); }
                    50% { top: 10%; left: 55%; transform: scale(0.9); }
                    75% { top: 55%; left: 10%; transform: scale(1.2); }
                }
                @keyframes genFloat4 {
                    0%, 100% { top: 85%; left: 15%; transform: scale(1); }
                    25% { top: 25%; left: 50%; transform: scale(1.2); }
                    50% { top: 65%; left: 85%; transform: scale(0.85); }
                    75% { top: 10%; left: 30%; transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
};

export default GeneratingLoader;
