import { useState } from 'react';
import { createRoot } from 'react-dom/client';

// A normal controlled textarea: React state is the source of truth, shown below the field.
function ControlledField({ id, label }) {
    const [value, setValue] = useState('');
    return (
        <div className="field">
            <label htmlFor={id}>{label}</label>
            <textarea id={id} value={value} onChange={(e) => setValue(e.target.value)} />
            <pre data-testid={`${id}-state`}>{value}</pre>
        </div>
    );
}

// Accepts typing one character at a time and rejects anything bigger, re-rendering its old value.
// Stands in for editors that block programmatic or pasted input; SmartPaste must report failure, not success.
function RejectingField({ id, label }) {
    const [value, setValue] = useState('Typed by vet.');
    return (
        <div className="field">
            <label htmlFor={id}>{label}</label>
            <textarea
                id={id}
                value={value}
                onChange={(e) => {
                    if (Math.abs(e.target.value.length - value.length) <= 1) setValue(e.target.value);
                }}
            />
            <pre data-testid={`${id}-state`}>{value}</pre>
        </div>
    );
}

function App() {
    const [saved, setSaved] = useState(null);
    return (
        <>
            <section className="pims-patient">
                <h1>Max</h1>
                <span>Canine · Golden Retriever · 4y MN</span>
                <span>Medical Consultation (React)</span>
            </section>
            <main>
                <section className="panel">
                    <h2>React-controlled fields</h2>
                    <ControlledField id="react-subjective" label="Subjective" />
                    <ControlledField id="react-plan" label="Treatment Plan" />
                    <RejectingField id="react-locked" label="Assessment" />
                </section>
                <div className="actions">
                    <button type="button" onClick={() => setSaved(new Date().toLocaleTimeString())}>
                        Save consultation
                    </button>
                    {saved && <span className="saved-note">Saved at {saved} (mock)</span>}
                </div>
            </main>
        </>
    );
}

createRoot(document.getElementById('root')).render(<App />);
