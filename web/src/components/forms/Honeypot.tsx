/**
 * A field people never see and bots fill in.
 *
 * Hidden by position rather than display:none, since some automated form
 * fillers skip anything the browser reports as hidden. It is taken out of the
 * tab order and hidden from screen readers, so nobody using the site by
 * keyboard or by ear can land in it by accident.
 */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-auto size-px overflow-hidden">
      <label htmlFor="website">Website</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
