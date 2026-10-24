import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { useDismiss } from './useDismiss';
import { prefersReducedMotion } from '../utils/motion';

interface Props {
  user: { name: string; email: string; picture: string } | null;
  /** Page to return to after signing in */
  next: string;
}

const initial = (u: { name: string; email: string }) => (u.name || u.email).charAt(0).toUpperCase();

/** Avatar + sign-out menu for editors, "Sign in" for guests (Jakob's Law: account control top-right). */
export default function UserMenu({ user, next }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [imgOk, setImgOk] = useState(true);

  useDismiss(open, [root], () => setOpen(false));
  useEffect(() => {
    if (!open || !panel.current || prefersReducedMotion()) return;
    animate(panel.current, { opacity: [0, 1], y: [-6, 0], scale: [0.96, 1] }, { type: 'spring', stiffness: 420, damping: 28 });
  }, [open]);

  if (!user) {
    return (
      <a
        href={`/login?next=${encodeURIComponent(next)}`}
        className="touch-target inline-flex items-center justify-center gap-2 h-11 px-3 sm:px-4 rounded-xl text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors whitespace-nowrap"
        aria-label="Sign in to edit"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0" />
        </svg>
        <span className="hidden sm:inline">Sign in</span>
      </a>
    );
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name || user.email}`}
        className="touch-target inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-primary/10 focus-ring"
      >
        {user.picture && imgOk ? (
          <img
            src={user.picture}
            alt=""
            width={36}
            height={36}
            referrerpolicy="no-referrer"
            onError={() => setImgOk(false)}
            className="w-9 h-9 rounded-full border-2 border-primary/40 object-cover"
          />
        ) : (
          <span className="w-9 h-9 rounded-full bg-primary text-white text-sm font-extrabold flex items-center justify-center">{initial(user)}</span>
        )}
      </button>

      {open && (
        <div ref={panel} role="menu" className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl bg-surface-solid border border-primary/20 shadow-xl p-2">
          <div className="px-3 py-2 border-b border-primary/10 mb-1">
            <p className="text-sm font-bold text-text truncate">{user.name || 'Signed in'}</p>
            <p className="text-xs text-text/60 truncate">{user.email}</p>
          </div>
          <form method="post" action="/api/logout">
            <button type="submit" role="menuitem" className="touch-target w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-text hover:bg-primary/10 text-left">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
