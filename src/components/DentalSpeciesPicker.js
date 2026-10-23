import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PiCat, PiDog } from 'react-icons/pi';

const EASE = [0.2, 0.7, 0.2, 1];

export const SPECIES_LABEL = { canine: 'Canine', feline: 'Feline' };

const OPTIONS = [
    { id: 'canine', icon: PiDog },
    { id: 'feline', icon: PiCat }
];

const DentalSpeciesPicker = ({ open, sheet = false, onPick, onClose }) => {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    key="species-picker"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onClose}
                    className={`fixed inset-0 z-[1200] bg-[#0f1b33]/40 backdrop-blur-[2px] flex justify-center ${sheet ? 'items-end' : 'items-center p-4'}`}
                >
                    <motion.div
                        role="dialog"
                        aria-label="Choose species"
                        initial={sheet ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
                        animate={sheet ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                        exit={sheet ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        onClick={(e) => e.stopPropagation()}
                        className={`bg-white shadow-[0_40px_80px_-40px_rgba(19,35,63,0.55)] ${sheet ? 'w-full rounded-t-[28px] px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]' : 'w-full max-w-[400px] rounded-[28px] p-6'}`}
                    >
                        <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-violet-600">Dental record</p>
                        <h3 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-[#13233f]">Canine or feline?</h3>
                        <p className="m-0 mt-1 mb-5 text-[14px] text-[#1a2b4a]/60">The chart is set to this species and can’t be changed after.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {OPTIONS.map(({ id, icon: Icon }) => (
                                <motion.button
                                    key={id}
                                    type="button"
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => onPick(id)}
                                    className="flex flex-col items-center justify-center gap-2 h-[120px] rounded-[22px] border border-[#e7ecf3] bg-white hover:border-violet-300 hover:bg-violet-50/60 text-[#13233f] cursor-pointer transition-colors"
                                >
                                    <Icon className="text-[40px] text-violet-600" />
                                    <span className="text-[16px] font-semibold">{SPECIES_LABEL[id]}</span>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default DentalSpeciesPicker;
