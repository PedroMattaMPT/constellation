// Header buttons. The x that puts the tree or pane away is web only: the TUI uses C-Space t and C-Space x.

/** A small button at the end of a header. With `hint`, its chord also shows while the header is hovered. */
export function HeadButton({
  text,
  label,
  chord,
  onClick,
  hint = false,
}: {
  text: string;
  label: string;
  chord: string;
  onClick: () => void;
  hint?: boolean;
}) {
  return (
    <>
      {hint ? <span className="hide-hint cn-dim">{chord}</span> : null}
      <button type="button" className="hide-btn" onClick={onClick} title={`${label} · ${chord}`} aria-label={label}>
        {text}
      </button>
    </>
  );
}

/** The x at the end of a header. */
export function HideButton({ label, chord, onClick }: { label: string; chord: string; onClick: () => void }) {
  return <HeadButton text="x" label={label} chord={chord} onClick={onClick} hint />;
}
