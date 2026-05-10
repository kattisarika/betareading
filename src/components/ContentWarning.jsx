import { flagCategoryList } from '../api';

export default function ContentWarning({ book, onContinue, onCancel }) {
  const flags = flagCategoryList(book?.contentFlags);
  if (!flags.length) return null;

  return (
    <div className="content-warning-backdrop" onClick={onCancel}>
      <div className="content-warning-modal" onClick={(e) => e.stopPropagation()}>
        <div className="content-warning-icon" aria-hidden="true">⚠️</div>
        <h2 className="content-warning-title"><strong>Warning</strong></h2>
        <p className="content-warning-sub">
          This book contains:
        </p>
        <ul className="content-warning-list">
          {flags.map((f) => (
            <li key={f.key}><strong>{f.label}</strong></li>
          ))}
        </ul>
        <p className="content-warning-foot">
          Reader discretion is advised.
        </p>
        <div className="content-warning-actions">
          <button className="btn-ghost" onClick={onCancel}>← Back</button>
          <button className="btn-primary" onClick={onContinue}>I understand, continue →</button>
        </div>
      </div>
    </div>
  );
}
