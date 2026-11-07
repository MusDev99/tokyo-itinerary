import { h } from 'preact';
import Button from './Button';

/**
 * Shown when the server answers 409: somebody else changed this while you were editing.
 * Two honest choices (Nielsen: error recovery, user control): see what they changed, or keep your version.
 */
export default function ConflictNotice({ message, onReload, onForce, busy, forceLabel = 'Save mine anyway' }: {
  message: string; onReload: () => void; onForce: () => void; busy?: boolean; forceLabel?: string;
}) {
  return (
    <div role="alert" className="p-3 rounded-xl bg-warning/15 border border-warning/40 space-y-2">
      <p className="text-sm font-bold text-warning-strong">{message}</p>
      <p className="text-xs text-text/75">Reload to see their version (your changes here are lost), or keep yours and overwrite theirs.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="soft" onClick={onReload} disabled={busy}>Reload latest</Button>
        <Button variant="danger" onClick={onForce} busy={busy} busyLabel="Saving…">{forceLabel}</Button>
      </div>
    </div>
  );
}
