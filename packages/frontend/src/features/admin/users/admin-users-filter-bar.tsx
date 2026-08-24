import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRSelect } from '@tinyrack/ui/components/select';
import { TRText } from '@tinyrack/ui/components/text';
import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QuickFilter } from '#frontend/features/admin/users/admin-users-filters.ts';

type AdminUsersFilterBarProps = {
  pageStart: number;
  pageEnd: number;
  total: number;
  query: string;
  includeDeleted: boolean;
  activeQuickFilter: QuickFilter;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
};

const PAGE_SIZES = [10, 20, 50];

/** What the current result set is filtered by, and how much of it is shown. */
export function AdminUsersFilterBar({
  pageStart,
  pageEnd,
  total,
  query,
  includeDeleted,
  activeQuickFilter,
  hasActiveFilters,
  onClearFilters,
  pageSize,
  onPageSizeChange,
}: AdminUsersFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-tinyrack-md px-tinyrack-xl">
      <div className="flex flex-wrap items-center gap-tinyrack-sm">
        <TRText color="muted" variant="bodySm">
          {t('admin.users.showingRange', {
            from: pageStart,
            to: pageEnd,
            total,
          })}
        </TRText>
        {query ? (
          <TRBadge uiSize="md" variant="neutral">
            {t('admin.users.queryChip', { query })}
          </TRBadge>
        ) : null}
        {includeDeleted ? (
          <TRBadge uiSize="md" variant="warning">
            {t('admin.users.includeDeleted')}
          </TRBadge>
        ) : null}
        {activeQuickFilter !== 'all' ? (
          <TRBadge uiSize="md">
            {t(`admin.users.filter.${activeQuickFilter}`)}
          </TRBadge>
        ) : null}
        {hasActiveFilters ? (
          <TRButton
            appearance="ghost"
            onClick={onClearFilters}
            type="button"
            uiSize="sm"
          >
            {t('admin.users.clearFilters')}
          </TRButton>
        ) : null}
      </div>

      <div className="flex items-center gap-tinyrack-sm">
        <TRText color="muted" variant="bodySm">
          {t('admin.users.pageSize')}
        </TRText>
        <TRSelect.Root
          onValueChange={(value) => {
            if (typeof value === 'number') onPageSizeChange(value);
          }}
          value={pageSize}
        >
          <TRSelect.Trigger aria-label={t('admin.users.pageSize')} uiSize="sm">
            <TRSelect.Value />
          </TRSelect.Trigger>
          <TRSelect.Portal>
            <TRSelect.Positioner>
              <TRSelect.Popup>
                <TRSelect.List>
                  {PAGE_SIZES.map((size) => (
                    <TRSelect.Item key={size} value={size}>
                      <TRSelect.ItemText>{size}</TRSelect.ItemText>
                      <TRSelect.ItemIndicator>
                        <CheckIcon />
                      </TRSelect.ItemIndicator>
                    </TRSelect.Item>
                  ))}
                </TRSelect.List>
              </TRSelect.Popup>
            </TRSelect.Positioner>
          </TRSelect.Portal>
        </TRSelect.Root>
      </div>
    </div>
  );
}
