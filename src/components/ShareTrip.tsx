import { h } from 'preact';
import { useState } from 'preact/hooks';
import { PickerPopover, usePickerPopover } from './PickerPopover';
import { toast } from '../utils/toast';
import { shareMessage, whatsappUrl, type ShareInfo } from '../utils/share';

interface Props {
  info: Omit<ShareInfo, 'url'>;
  /** Path of the client page, e.g. "/trips/japan-2025/share" */
  href: string;
  /** Visual weight: the main button on the client page, a quiet icon in the trip header */
  variant?: 'primary' | 'icon';
}

const ROW = 'touch-target w-full flex items-center gap-3 px-3 rounded-xl text-sm font-semibold text-left text-text hover:bg-primary/10';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / blocked clipboard: a hidden textarea and the classic command
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Share a trip: WhatsApp first (that is how clients receive plans), the phone's own share sheet when there is one,
 * and a plain copy-link. Three clear choices (Hick's Law); every one points at the clean client page.
 */
export default function ShareTrip({ info, href, variant = 'primary' }: Props) {
  const [native] = useState(() => typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function');
  const picker = usePickerPopover({ width: 248, height: (native ? 3 : 2) * 44 + 12, align: 'end' });

  const url = () => `${location.origin}${href}`;
  const full = () => ({ ...info, url: url() });

  const whatsapp = () => {
    window.open(whatsappUrl(shareMessage(full())), '_blank', 'noopener,noreferrer');
  };
  const system = async () => {
    try {
      await (navigator as any).share({ title: info.title, text: shareMessage({ ...full(), url: '' }).replace(/\n*Full day-by-day itinerary: $/, ''), url: url() });
    } catch {
      /* the person closed the sheet: not an error */
    }
  };
  const copy = async () => {
    (await copyText(url())) ? toast.success('Link copied') : toast.error('Could not copy the link. Press and hold it to copy.');
  };

  const icon = (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );

  return (
    <>
      <button
        ref={picker.trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={picker.open}
        aria-label="Share this trip"
        title="Share this trip"
        onClick={() => (picker.open ? picker.close() : picker.show())}
        className={
          variant === 'icon'
            ? 'touch-target focus-ring relative inline-flex items-center justify-center w-11 h-11 rounded-xl text-primary hover:bg-primary/15 transition-colors'
            : 'touch-target focus-ring inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl bg-primary text-white text-sm font-extrabold shadow-md hover:brightness-110 btn-primary'
        }
      >
        {icon}
        {variant === 'primary' && <span>Share</span>}
      </button>
      <PickerPopover picker={picker} aria-label="Share this trip" className="p-1">
        <div role="menu">
          <button type="button" role="menuitem" className={ROW} onClick={() => { picker.close(false); whatsapp(); }}>
            <span aria-hidden="true" className="text-lg">💬</span> WhatsApp
          </button>
          {native && (
            <button type="button" role="menuitem" className={ROW} onClick={() => { picker.close(false); void system(); }}>
              <span aria-hidden="true" className="text-lg">📲</span> More apps…
            </button>
          )}
          <button type="button" role="menuitem" className={ROW} onClick={() => { picker.close(false); void copy(); }}>
            <span aria-hidden="true" className="text-lg">🔗</span> Copy link
          </button>
        </div>
      </PickerPopover>
    </>
  );
}
