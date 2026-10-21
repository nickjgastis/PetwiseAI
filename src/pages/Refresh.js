import { useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';

// Old PWA bundles don't have this route — use /refresh.html for those.
// After this deploy, /refresh just hands off to the static purge page.
const Refresh = () => {
    useEffect(() => {
        window.location.replace('/refresh.html');
    }, []);

    return (
        <LoadingScreen label="Updating PetWise" />
    );
};

export default Refresh;
