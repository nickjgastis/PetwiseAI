import { createRoot } from 'react-dom/client';
import PetWiseLogo from '../../components/PetWiseLogo.jsx';
import { PETWISE_APP_URL } from '../../platform/browser.js';
import { KNOWN_PIMS } from '../../platform/pimsSites.js';
import './help.css';

const SUPPORT_EMAIL = 'support@petwise.vet';
const names = KNOWN_PIMS.map((p) => p.name);
const PIMS_NAMES = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
const welcome = new URLSearchParams(location.search).has('welcome');

const STEPS = [
    {
        title: 'Open a record in PetWise',
        body: 'Generate or open a SOAP, summary, callback or dental record in PetWise, in this Chrome. SmartPaste picks it up on its own. There is nothing to sign in to.',
        tip: 'Already had PetWise open? Refresh that tab once so it connects.',
    },
    {
        title: 'Open your practice software',
        body: `${PIMS_NAMES} work straight away. Using something else? Click the PetWise icon in the Chrome toolbar there, then Turn on for this site.`,
        tip: 'Can\u2019t see the icon? Click the puzzle piece in the toolbar and pin PetWise SmartPaste.',
    },
    {
        title: 'Click a notes field, then Paste',
        body: 'A PetWise button appears beside the field showing the patient and what it will paste. Hover over Paste to preview the text first.',
    },
];

const TIPS = [
    {
        title: 'SOAPs paste by section',
        body: 'SmartPaste reads the field\u2019s label and pastes Subjective, Objective, Assessment or Plan to match. A general notes field gets the whole SOAP. Paste all sections fills every empty SOAP field at once.',
    },
    {
        title: 'Summaries, callbacks and dental records paste whole',
        body: 'They go into whichever field you click, in one piece.',
    },
    {
        title: 'Switching patients',
        body: 'Opening a record in PetWise selects it. To pick a different one, use the gear on the paste button or the PetWise toolbar icon.',
    },
    {
        title: 'Your notes are safe',
        body: 'SmartPaste adds text where your cursor is and never clears a field without asking first.',
    },
    {
        title: 'It learns your fields',
        body: 'If a field is labelled oddly, choose the section once with the gear, then Always use it for this field. SmartPaste remembers it on that site.',
    },
];

const PRIVACY = [
    'Records go straight from your PetWise tab to the extension. They never pass through another server.',
    'They are kept in memory only and cleared when you sign out of PetWise or quit Chrome. Only your 25 most recent are kept.',
    'SmartPaste only runs on practice software, and only looks at the field you click and its label.',
];

const FAQ = [
    {
        q: 'I don\u2019t see the paste button',
        a: 'Click the PetWise toolbar icon on that page and check it says On. Then click inside a notes or text box. It doesn\u2019t appear on search boxes or read-only fields, or in editors that draw text themselves, such as Google Docs.',
    },
    {
        q: 'It shows Sample records',
        a: 'Open a record in PetWise in this same Chrome profile. Your records replace the samples straight away.',
    },
    {
        q: 'It has the wrong patient',
        a: 'Open the right record in PetWise, or choose it from the gear menu or the toolbar icon.',
    },
    {
        q: 'Does it work with Cornerstone, AVImark or ImproMed?',
        a: 'Not yet. SmartPaste works inside Chrome, and those run as desktop programs. Use Copy all in PetWise and paste as usual.',
    },
];

function Help() {
    return (
        <main className="hp">
            <header className="hp-hero">
                <div className="hp-hero-inner">
                    <PetWiseLogo size={56} />
                    <div>
                        <p className="hp-kicker">{welcome ? 'SmartPaste is installed' : 'PetWise SmartPaste'}</p>
                        <h1>{welcome ? 'Three steps and you\u2019re pasting' : 'How SmartPaste works'}</h1>
                        <p className="hp-lede">Paste PetWise records into your practice software in one click, without copying and switching tabs.</p>
                    </div>
                </div>
            </header>

            <ol className="hp-steps">
                {STEPS.map((s, i) => (
                    <li key={s.title} className="hp-card hp-step">
                        <span className="hp-num">{i + 1}</span>
                        <h2>{s.title}</h2>
                        <p>{s.body}</p>
                        {s.tip && <p className="hp-tip">{s.tip}</p>}
                    </li>
                ))}
            </ol>

            <div className="hp-cta">
                <a className="hp-button" href={PETWISE_APP_URL} target="_blank" rel="noreferrer">
                    Open PetWise
                </a>
            </div>

            <section className="hp-section">
                <h2 className="hp-h2">Good to know</h2>
                <div className="hp-grid">
                    {TIPS.map((t) => (
                        <div key={t.title} className="hp-card">
                            <h3>{t.title}</h3>
                            <p>{t.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="hp-section">
                <h2 className="hp-h2">Your records stay on this computer</h2>
                <ul className="hp-card hp-list">
                    {PRIVACY.map((p) => (
                        <li key={p}>{p}</li>
                    ))}
                </ul>
            </section>

            <section className="hp-section">
                <h2 className="hp-h2">Something not working?</h2>
                <div className="hp-faq">
                    {FAQ.map((f) => (
                        <details key={f.q} className="hp-card">
                            <summary>{f.q}</summary>
                            <p>{f.a}</p>
                        </details>
                    ))}
                </div>
            </section>

            <footer className="hp-foot">
                Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </footer>
        </main>
    );
}

createRoot(document.getElementById('root')).render(<Help />);
