import React from 'react';
import { FiCheck } from 'react-icons/fi';
import { PRICES, PLAN_FEATURES } from '../constants/pricing';

const Card = ({ name, price, unit, note, badge, featured, current, button, features }) => (
    <div
        className={`relative h-full rounded-[28px] p-7 flex flex-col ${
            featured ? 'bg-[#13233f] text-white shadow-[0_40px_80px_-40px_rgba(19,35,63,0.7)]' : 'bg-white border border-[#e7ecf3] text-[#13233f]'
        } ${current ? 'ring-2 ring-[#5cccf0]' : ''}`}
    >
        {(badge || current) && (
            <span
                className={`absolute top-7 right-7 rounded-full px-3 py-1 text-[12px] font-semibold ${
                    featured ? 'bg-[#5cccf0]/20 text-[#7fd6f3]' : 'bg-[#e9f6fd] text-[#3468bd]'
                }`}
            >
                {current ? 'Current plan' : badge}
            </span>
        )}
        <h3 className={`text-[15px] font-semibold ${featured ? 'text-white/70' : 'text-[#13233f]/60'}`}>{name}</h3>
        <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[2.75rem] leading-none font-semibold tracking-[-0.04em]">{price}</span>
            <span className={`text-[13px] ${featured ? 'text-white/55' : 'text-[#1a2b4a]/50'}`}>{unit}</span>
        </div>
        <p className={`mt-2.5 text-[13px] ${featured ? 'text-white/55' : 'text-[#1a2b4a]/50'}`}>{note}</p>
        <div className="mt-6">{button}</div>
        <ul className="mt-6 space-y-3">
            {features.map((f) => (
                <li key={f} className="flex gap-3 text-[14px]">
                    <FiCheck className={`mt-0.5 flex-shrink-0 ${featured ? 'text-[#7fd6f3]' : 'text-[#3468bd]'}`} aria-hidden />
                    <span className={featured ? 'text-white/80' : 'text-[#1a2b4a]/75'}>{f}</span>
                </li>
            ))}
        </ul>
    </div>
);

const buttonClass = (featured) =>
    `w-full rounded-full px-6 py-3 text-[14px] font-medium tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        featured ? 'bg-white text-[#13233f] hover:bg-[#e9f6fd]' : 'bg-[#13233f] text-white hover:bg-[#3468bd]'
    }`;

// Monthly + Yearly cards in the petwise.vet pricing style.
// currentPlan: 'monthly' | 'yearly' | null. labels: { monthly, yearly } button text.
const PlanCards = ({ currency, onCheckout, isLoading, currentPlan = null, labels = {} }) => {
    const p = PRICES[currency];
    const savings = p.monthlyAnnual - p.yearlyTotal;

    const button = (plan, featured) => {
        const isCurrent = currentPlan === plan;
        return (
            <button
                onClick={() => onCheckout(plan)}
                disabled={isLoading !== null || isCurrent}
                className={buttonClass(featured)}
            >
                {isLoading === plan ? 'Processing...' : isCurrent ? 'Current plan' : labels[plan]}
            </button>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <Card
                name="Monthly"
                price={`${p.symbol}${p.monthly}`}
                unit={`${p.code} / month`}
                note="Billed monthly. Cancel any time."
                current={currentPlan === 'monthly'}
                button={button('monthly', false)}
                features={PLAN_FEATURES}
            />
            <Card
                featured
                name="Yearly"
                price={`${p.symbol}${p.yearly}`}
                unit={`${p.code} / month`}
                note={`${p.symbol}${p.yearlyTotal.toLocaleString('en-US')} ${p.code} billed yearly`}
                badge={`Save ${p.symbol}${savings}`}
                current={currentPlan === 'yearly'}
                button={button('yearly', true)}
                features={PLAN_FEATURES}
            />
        </div>
    );
};

export const CurrencyToggle = ({ currency, onChange, dark = false }) => (
    <div className={`inline-flex rounded-full p-1 ${dark ? 'bg-white/10 border border-white/15' : 'bg-[#f1f4f8]'}`} role="group" aria-label="Currency">
        {['usd', 'cad'].map((c) => (
            <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                aria-pressed={currency === c}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                    currency === c
                        ? 'bg-white text-[#13233f] shadow-sm'
                        : dark ? 'text-white/65 hover:text-white' : 'text-[#13233f]/50 hover:text-[#13233f]'
                }`}
            >
                {c.toUpperCase()}
            </button>
        ))}
    </div>
);

export default PlanCards;
