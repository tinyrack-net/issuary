import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRCheckbox } from '@tinyrack/ui/components/checkbox';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRText } from '@tinyrack/ui/components/text';
import { PlusIcon, SearchIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QuickFilter } from '#frontend/features/admin/users/admin-users-filters.ts';

type AdminUsersToolbarProps = {
  total: number;
  draftQuery: string;
  onDraftQueryChange: (value: string) => void;
  draftIncludeDeleted: boolean;
  onDraftIncludeDeletedChange: (value: boolean) => void;
  onSearch: () => void;
  onCreate: () => void;
  activeQuickFilter: QuickFilter;
  onQuickFilter: (filter: QuickFilter) => void;
};

const QUICK_FILTERS: QuickFilter[] = ['all', 'database', 'config', 'admins'];

export function AdminUsersToolbar({
  total,
  draftQuery,
  onDraftQueryChange,
  draftIncludeDeleted,
  onDraftIncludeDeletedChange,
  onSearch,
  onCreate,
  activeQuickFilter,
  onQuickFilter,
}: AdminUsersToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-tinyrack-lg border-tinyrack-border border-b-tinyrack-default bg-tinyrack-surface-muted p-tinyrack-xl xl:flex-row xl:items-end xl:justify-between">
      <div className="flex flex-col gap-tinyrack-sm">
        <div className="flex items-center gap-tinyrack-sm">
          <UsersIcon
            aria-hidden
            className="size-tinyrack-lg text-tinyrack-success-foreground"
          />
          <TRText color="muted" variant="label">
            {t('admin.users.directoryEyebrow')}
          </TRText>
        </div>
        <TRCard.Title>{t('admin.users.directory')}</TRCard.Title>
        <TRCard.Description className="text-tinyrack-sm">
          {t('admin.users.total', { count: total })}
        </TRCard.Description>
      </div>

      <div className="flex flex-col gap-tinyrack-md xl:items-end">
        <div className="flex flex-col gap-tinyrack-sm lg:flex-row lg:items-center">
          <TRInput
            aria-label={t('admin.users.searchPlaceholder')}
            className="w-full lg:w-tinyrack-overlay-width-sm"
            onChange={(event) => onDraftQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSearch();
            }}
            placeholder={t('admin.users.searchPlaceholder')}
            type="search"
            uiSize="sm"
            value={draftQuery}
          />

          {/*
            `aria-label` rather than relying on the label association: the
            design system's checkbox is a `button[role=checkbox]`, and the
            accessible-name path through `Field.Label` for a non-input control
            is not something to gamble a test contract on.
          */}
          <TRField.Root>
            <div className="flex items-center gap-tinyrack-sm rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface px-tinyrack-md py-tinyrack-sm">
              <TRCheckbox.Root
                aria-label={t('admin.users.includeDeleted')}
                checked={draftIncludeDeleted}
                onCheckedChange={(checked) =>
                  onDraftIncludeDeletedChange(checked === true)
                }
                uiSize="lg"
              >
                <TRCheckbox.Indicator />
              </TRCheckbox.Root>
              <TRField.Label className="cursor-pointer">
                {t('admin.users.includeDeleted')}
              </TRField.Label>
            </div>
          </TRField.Root>

          <TRButton
            appearance="outline"
            onClick={onSearch}
            type="button"
            uiSize="sm"
          >
            <SearchIcon aria-hidden className="size-tinyrack-lg" />
            {t('admin.users.search')}
          </TRButton>
          <TRButton
            intent="primary"
            onClick={onCreate}
            type="button"
            uiSize="sm"
          >
            <PlusIcon aria-hidden className="size-tinyrack-lg" />
            {t('admin.users.create')}
          </TRButton>
        </div>

        <div className="inline-flex items-center gap-tinyrack-3xs rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface-muted p-tinyrack-xs">
          {QUICK_FILTERS.map((filter) => (
            <TRButton
              appearance={activeQuickFilter === filter ? 'solid' : 'ghost'}
              intent={activeQuickFilter === filter ? 'primary' : undefined}
              key={filter}
              onClick={() => onQuickFilter(filter)}
              type="button"
              uiSize="sm"
            >
              {t(`admin.users.filter.${filter}`)}
            </TRButton>
          ))}
        </div>
      </div>
    </div>
  );
}
