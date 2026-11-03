import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import RecordSelector from '../../components/RecordSelector.jsx';
import { extensionStorage } from '../../platform/browser.js';
import { createRecordStore } from '../../services/recordStore.js';
import '../../styles/smartpaste.css';
import './popup.css';

const store = createRecordStore({ storage: extensionStorage });

function Popup() {
    const state = useSyncExternalStore(store.subscribe, store.getState);
    return (
        <div className="sp-root sp-popup">
            <header className="sp-popup-header">
                <span aria-hidden="true">{'\ud83d\udc3e'}</span>
                <strong>PetWise SmartPaste</strong>
            </header>
            <label className="sp-toggle">
                <input type="checkbox" checked={state.enabled} onChange={(e) => store.setEnabled(e.target.checked)} />
                <span>{state.enabled ? 'On for the mock PIMS' : 'Off'}</span>
            </label>
            <div className="sp-menu-title">Active PetWise record</div>
            <RecordSelector records={store.listRecords()} activeId={state.activeRecordId} onSelect={store.selectRecord} />
            <p className="sp-popup-note">Local prototype. Fictional records only.</p>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<Popup />);
