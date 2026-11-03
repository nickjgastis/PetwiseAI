import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import CasePicker from '../../components/CasePicker.jsx';
import { extensionStorage, sessionRecordStorage } from '../../platform/browser.js';
import { activeTabSite, disableSite, enableSite } from '../../platform/siteAccess.js';
import { createRecordStore } from '../../services/recordStore.js';
import '../../styles/smartpaste.css';
import './popup.css';

const store = createRecordStore({ storage: extensionStorage, liveStorage: sessionRecordStorage });

function SiteAccess() {
    const [site, setSite] = useState(null);
    const [error, setError] = useState('');
    const refresh = () => activeTabSite().then(setSite, () => setSite({ status: 'unsupported' }));
    useEffect(() => {
        refresh();
    }, []);

    if (!site) return null;
    if (site.status === 'unsupported') return <div className="sp-site">SmartPaste can't run on this page.</div>;
    if (site.status === 'built-in') return <div className="sp-site is-on">Always on for the mock PIMS ({site.host}).</div>;

    const toggle = async () => {
        setError('');
        try {
            if (site.status === 'enabled') await disableSite(site.pattern);
            else if (!(await enableSite(site.pattern))) setError('Chrome did not grant access to this site.');
        } catch (err) {
            setError(String(err?.message || err));
        }
        refresh();
    };

    const on = site.status === 'enabled';
    return (
        <div className={`sp-site${on ? ' is-on' : ''}`}>
            <div>
                <strong>{site.host}</strong>
                <div className="sp-site-state">{on ? 'SmartPaste is on for this site.' : 'SmartPaste is off for this site.'}</div>
                {on && <div className="sp-site-note">Turning it off takes effect after the page reloads.</div>}
            </div>
            <button type="button" className={`sp-action${on ? '' : ' is-primary'}`} onClick={toggle}>
                {on ? 'Turn off for this site' : 'Enable on this site'}
            </button>
            {error && <div className="sp-site-error">{error}</div>}
        </div>
    );
}

function Popup() {
    const state = useSyncExternalStore(store.subscribe, store.getState);
    return (
        <div className="sp-root sp-popup">
            <header className="sp-popup-header">
                <span aria-hidden="true">{'\ud83d\udc3e'}</span>
                <strong>PetWise SmartPaste</strong>
            </header>
            <SiteAccess />
            <label className="sp-toggle">
                <input type="checkbox" checked={state.enabled} onChange={(e) => store.setEnabled(e.target.checked)} />
                <span>{state.enabled ? 'SmartPaste on' : 'SmartPaste off everywhere'}</span>
            </label>
            <div className="sp-menu-title">Active PetWise case</div>
            <CasePicker
                cases={store.listCases()}
                activeCaseId={store.getActiveCase()?.id}
                activeRecordId={state.activeRecordId}
                onSelectCase={store.selectCase}
                onSelectRecord={store.selectRecord}
            />
            {state.live ? (
                <div className="sp-popup-note">
                    Records you opened in PetWise in this browser session. They are kept in memory only and cleared when
                    Chrome closes.
                    <button type="button" className="sp-link" onClick={store.clearLive}>
                        Clear PetWise records now
                    </button>
                </div>
            ) : (
                <p className="sp-popup-note">Demo records (fictional). Open a record in PetWise to use it here.</p>
            )}
        </div>
    );
}

createRoot(document.getElementById('root')).render(<Popup />);
