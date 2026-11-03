export default function RecordSelector({ records, activeId, onSelect }) {
    return (
        <div className="sp-records" role="radiogroup" aria-label="Active PetWise record">
            {records.map((r) => {
                const active = r.id === activeId;
                return (
                    <button
                        key={r.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`sp-record-option${active ? ' is-active' : ''}`}
                        onClick={() => onSelect(r.id)}
                    >
                        <span className="sp-radio" aria-hidden="true" />
                        <span className="sp-record-name">{r.patientName}</span>
                        <span className="sp-record-title">{r.recordTitle}</span>
                    </button>
                );
            })}
        </div>
    );
}
