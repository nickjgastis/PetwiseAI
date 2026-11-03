import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import CasePicker from '../../components/CasePicker.jsx';
import PetWiseLogo from '../../components/PetWiseLogo.jsx';
import { extensionStorage, openHelp, openTab, PETWISE_APP_URL, sessionRecordStorage } from '../../platform/browser.js';
import { activeTabSite, disableSite, enableSite } from '../../platform/siteAccess.js';
import { createRecordStore } from '../../services/recordStore.js';
import '../../styles/smartpaste.css';
import './popup.css';

const store = createRecordStore({ storage: extensionStorage, liveStorage: sessionRecordStorage });

const useActiveSite = () => {
    const [site, setSite] = useState(null);
    const refresh = () => activeTabSite().then(setSite, () => setSite({ status: 'unsupported' }));
    useEffect(() => {
        refresh();
    }, []);
    return [site, refresh];
};

// One card, one sentence, at most one button: what SmartPaste is doing on the tab the vet is looking at.
function SiteCard({ paused }) {
    const [site, refresh] = useActiveSite();
    const [error, setError] = useState('');
    const [turnedOff, setTurnedOff] = useState(false);

    if (paused) {
        return (
            <div className="sp-site is-paused">
                <div className="sp-site-title">SmartPaste is paused</div>
                <div className="sp-site-text">Paste buttons are hidden on every site.</div>
                <button type="button" className="sp-pop-button" onClick={() => store.setEnabled(true)}>
                    Resume
                </button>
            </div>
        );
    }
    if (!site) return <div className="sp-site is-loading" aria-hidden="true" />;

    if (site.status === 'unsupported') {
        return (
            <div className="sp-site">
                <div className="sp-site-title">Open your practice software</div>
                <div className="sp-site-text">Then click this icon there to turn SmartPaste on for it.</div>
            </div>
        );
    }

    if (site.status === 'disabled') {
        const enable = async () => {
            setError('');
            try {
                if (!(await enableSite(site.pattern))) setError('Chrome did not allow it. Try again and choose Allow.');
            } catch (err) {
                setError(String(err?.message || err));
            }
            setTurnedOff(false);
            refresh();
        };
        return (
            <div className="sp-site">
                <div className="sp-site-title">Use SmartPaste on {site.host}?</div>
                <div className="sp-site-text">
                    {turnedOff ? 'Turned off. Reload the page to remove the button.' : 'Chrome asks once. SmartPaste only runs on sites you turn on.'}
                </div>
                <button type="button" className="sp-pop-button" onClick={enable}>
                    Turn on for this site
                </button>
                {error && <div className="sp-site-error">{error}</div>}
            </div>
        );
    }

    const disable = async () => {
        await disableSite(site.pattern).catch(() => {});
        setTurnedOff(true);
        refresh();
    };
    return (
        <div className="sp-site is-on">
            <div className="sp-site-title">
                <span className="sp-dot" aria-hidden="true" />
                On for {site.host}
            </div>
            <div className="sp-site-text">Click a notes field and the paste button appears beside it.</div>
            {site.status === 'enabled' && (
                <button type="button" className="sp-text-button" onClick={disable}>
                    Turn off for this site
                </button>
            )}
        </div>
    );
}

function Records({ live }) {
    const cases = store.listCases();
    return (
        <section className="sp-pop-card" aria-label="Records">
            <div className="sp-pop-card-head">
                <span className="sp-pop-card-title">Paste from</span>
                <span className={`sp-source${live ? ' is-live' : ''}`}>{live ? 'From PetWise' : 'Sample records'}</span>
            </div>
            {!live && (
                <div className="sp-empty">
                    Open a record in PetWise and it shows up here, ready to paste.
                    <button type="button" className="sp-text-button" onClick={() => openTab(PETWISE_APP_URL)}>
                        Open PetWise {'\u2197'}
                    </button>
                </div>
            )}
            <div className="sp-pop-list">
                <CasePicker
                    cases={cases}
                    activeCaseId={store.getActiveCase()?.id}
                    activeRecordId={store.getState().activeRecordId}
                    onSelectCase={store.selectCase}
                    onSelectRecord={store.selectRecord}
                />
            </div>
            {live && <div className="sp-pop-hint">Cleared when you sign out of PetWise or quit Chrome.</div>}
        </section>
    );
}

function Popup() {
    const state = useSyncExternalStore(store.subscribe, store.getState);
    return (
        <div className="sp-root sp-popup">
            <header className="sp-pop-head">
                <PetWiseLogo size={34} />
                <div className="sp-pop-brand">
                    <div className="sp-pop-name">SmartPaste</div>
                    <div className="sp-pop-by">by PetWise</div>
                </div>
                <label className="sp-switch" title={state.enabled ? 'Pause SmartPaste everywhere' : 'Resume SmartPaste'}>
                    <input
                        type="checkbox"
                        role="switch"
                        aria-label="SmartPaste"
                        checked={state.enabled}
                        onChange={(e) => store.setEnabled(e.target.checked)}
                    />
                    <span className="sp-switch-track" aria-hidden="true" />
                </label>
            </header>

            <SiteCard paused={!state.enabled} />
            {state.ready && <Records live={state.live} />}

            <footer className="sp-pop-foot">
                <button type="button" className="sp-text-button" onClick={openHelp}>
                    How it works
                </button>
                {state.live && (
                    <button type="button" className="sp-text-button is-quiet" onClick={store.clearLive}>
                        Clear records
                    </button>
                )}
            </footer>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<Popup />);
