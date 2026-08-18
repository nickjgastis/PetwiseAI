import { useEffect } from 'react';

// Old PWA bundles don't have this route — use /refresh.html for those.
// After this deploy, /refresh just hands off to the static purge page.
const Refresh = () => {
    useEffect(() => {
        window.location.replace('/refresh.html');
    }, []);

    return (
        <div className="min-h-screen bg-[#3369bd] flex items-center justify-center">
            <div className="text-white text-xl">Updating…</div>
        </div>
    );
};

export default Refresh;
