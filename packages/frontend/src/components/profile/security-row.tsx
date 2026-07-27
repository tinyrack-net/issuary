import { TRText } from '@tinyrack/ui/components/text';
import type { LucideIcon } from 'lucide-react';
import { isValidElement, type ReactNode } from 'react';

type SecurityRowProps = {
  /**
   * A lucide glyph, which gets tinted with the row's state, or a ready-made
   * node for marks that carry their own colour — a provider's brand logo.
   */
  icon: LucideIcon | ReactNode;
  /** Tints the icon tile. "Configured" rather than "enabled" — a linked OAuth
   * account and a set password are both active states. */
  active: boolean;
  title: string;
  status: string;
  /** Secondary line under the status, e.g. a config-managed caveat. */
  note?: ReactNode;
  /** Trailing controls. */
  actions?: ReactNode;
};

/**
 * One credential the account has, or does not.
 *
 * Password, TOTP, passkeys, and each linked provider were four copies of the
 * same row — a tinted icon tile, a title, a status line, a trailing action
 * cluster — which is how they drifted into three different paddings.
 */
export function SecurityRow({
  icon,
  active,
  title,
  status,
  note,
  actions,
}: SecurityRowProps) {
  /*
    Discriminated by `isValidElement`, not `typeof … === 'function'`: lucide
    icons are `forwardRef` objects, so a typeof check reads them as data and
    React then throws on rendering `{$$typeof, render}` as a child. An
    already-rendered mark is an element; a component is not.
  */
  let mark: ReactNode;
  if (isValidElement(icon)) {
    mark = icon;
  } else {
    const Icon = icon as LucideIcon;
    mark = (
      <Icon
        aria-hidden
        className={`size-4 ${
          active ? 'text-tinyrack-success' : 'text-tinyrack-text-muted'
        }`}
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-tinyrack-lg p-tinyrack-lg">
      <div className="flex min-w-0 flex-1 items-center gap-tinyrack-md">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-tinyrack-md ${
            active ? 'bg-tinyrack-success-surface' : 'bg-tinyrack-surface-muted'
          }`}
        >
          {mark}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-tinyrack-3xs">
          <TRText as="div" variant="bodySm" weight="medium">
            {title}
          </TRText>
          <TRText as="div" color="muted" variant="caption">
            {status}
          </TRText>
          {note}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap justify-end gap-tinyrack-xs">
          {actions}
        </div>
      )}
    </div>
  );
}
