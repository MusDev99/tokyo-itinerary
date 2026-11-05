import { h, type ComponentChildren } from 'preact';
import { PickerPopover, usePickerPopover } from './PickerPopover';

export interface MenuItem {
  label: ComponentChildren;
  onSelect: () => void;
  danger?: boolean;
}

const ITEM_H = 44;

/**
 * A "⋯" actions menu that cannot be covered or clipped. The panel is portalled to <body> and positioned with
 * `position: fixed` (same engine as the date and time pickers), so a card's stacking context (backdrop-filter),
 * paint containment (`content-visibility`) or `overflow` can never hide the last item behind the next card.
 * Fitts's Law: 44px rows; Jakob's Law: the familiar kebab menu.
 */
export default function PortalMenu({ label, items, className = '' }: { label: string; items: MenuItem[]; className?: string }) {
  const picker = usePickerPopover({ width: 176, height: items.length * ITEM_H + 12, align: 'end' });
  return (
    <>
      <button
        ref={picker.trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={picker.open}
        aria-label={label}
        onClick={() => (picker.open ? picker.close() : picker.show())}
        className={`touch-target inline-flex items-center justify-center w-11 h-11 rounded-full text-text/70 hover:bg-primary/10 active:bg-primary/15 text-xl leading-none font-bold ${className}`}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      <PickerPopover picker={picker} aria-label={label} className="p-1">
        <div role="menu">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => { picker.close(false); item.onSelect(); }}
              className={`touch-target w-full flex items-center gap-2 px-3 rounded-lg text-sm font-semibold text-left ${
                item.danger ? 'text-red-700 hover:bg-red-500/10' : 'text-text hover:bg-primary/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </PickerPopover>
    </>
  );
}
