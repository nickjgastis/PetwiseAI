// "Oct 22, 3:19 PM", the same format as the PetWise Cases cards (formatRecordWhen in src/utils/cases.js).
const formatWhen = (iso) =>
    iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

// Cases first, newest at the top; the open case lists its records by type so a Callback or Dental record in the
// same case is one click away.
export default function CasePicker({ cases, activeCaseId, activeRecordId, onSelectCase, onSelectRecord }) {
    return (
        <div className="sp-cases">
            <div className="sp-records" role="radiogroup" aria-label="Active PetWise case">
                {cases.map((c) => {
                    const active = c.id === activeCaseId;
                    return (
                        <div key={c.id} className={`sp-case${active ? ' is-active' : ''}`}>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={active}
                                className={`sp-record-option${active ? ' is-active' : ''}`}
                                onClick={() => onSelectCase(c.id)}
                            >
                                <span className="sp-radio" aria-hidden="true" />
                                <span className="sp-record-name">{c.patientName}</span>
                                <span className="sp-record-title">{c.title}</span>
                                <span className="sp-record-when">{formatWhen(c.updatedAt)}</span>
                            </button>
                            {active && (
                                <div className="sp-types" role="radiogroup" aria-label={`Records in ${c.patientName}'s case`}>
                                    {c.records.map((r) => {
                                        const current = r.id === activeRecordId;
                                        return (
                                            <button
                                                key={r.id}
                                                type="button"
                                                role="radio"
                                                aria-checked={current}
                                                title={formatWhen(r.updatedAt)}
                                                className={`sp-type-option is-${r.recordType}${current ? ' is-active' : ''}`}
                                                onClick={() => onSelectRecord(r.id)}
                                            >
                                                {r.typeLabel}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
