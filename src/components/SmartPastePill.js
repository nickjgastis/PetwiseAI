import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmartPasteInstalled } from '../utils/smartPasteBridge';

// Desktop only: shows when the SmartPaste extension is installed and connected. Opens the SmartPaste page.
const SmartPastePill = ({ title = 'Click a notes field in your practice software to paste this record' }) => {
    const navigate = useNavigate();
    const installed = useSmartPasteInstalled();
    if (!installed) return null;
    return (
        <button
            type="button"
            onClick={() => navigate('/dashboard/smartpaste')}
            title={title}
            className="hidden lg:inline-flex shrink-0 items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[12px] font-semibold text-[#13233f] bg-white border border-[#c3ddf5] hover:border-[#3f8ddb] cursor-pointer transition-colors"
        >
            <img src="/favicon-96x96.png" alt="" className="w-5 h-5 rounded-full" />
            SmartPaste ready
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
        </button>
    );
};

export default SmartPastePill;
