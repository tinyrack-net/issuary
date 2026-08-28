import { TRButton } from '@tinyrack/ui/components/button';
import { TRCheckbox } from '@tinyrack/ui/components/checkbox';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRSelect } from '@tinyrack/ui/components/select';
import { TRTable } from '@tinyrack/ui/components/table';
import { TRText } from '@tinyrack/ui/components/text';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function AdminListToolbar({
  title,
  total,
  query,
  onQueryChange,
  onSearch,
  onCreate,
  children,
}: {
  title: string;
  total: number;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onCreate?: (() => void) | undefined;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch();
  };
  return (
    <div
      className="flex shrink-0 flex-col bg-tinyrack-surface"
      data-testid="admin-list-toolbar"
    >
      <div className="flex items-center justify-between gap-tinyrack-md py-tinyrack-md">
        <div className="flex min-w-0 items-baseline gap-tinyrack-sm">
          <TRText as="h1" variant="headingMd" weight="heading">
            {title}
          </TRText>
          <TRText color="muted" variant="caption">
            {t('admin.table.total', { count: total })}
          </TRText>
        </div>
        {onCreate ? (
          <TRButton
            intent="primary"
            onClick={onCreate}
            type="button"
            uiSize="sm"
          >
            {t('admin.table.create')}
          </TRButton>
        ) : null}
      </div>
      <form
        className="flex flex-wrap items-center gap-tinyrack-sm py-tinyrack-sm"
        onSubmit={submit}
      >
        <TRInput.Group className="w-full flex-none sm:w-auto sm:min-w-tinyrack-control-sm sm:flex-1">
          <TRInput.Adornment>
            <SearchIcon aria-hidden />
          </TRInput.Adornment>
          <TRInput
            aria-label={t('admin.table.search')}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('admin.table.searchPlaceholder')}
            uiSize="sm"
            value={query}
          />
        </TRInput.Group>
        {children}
        <TRButton appearance="outline" type="submit" uiSize="sm">
          {t('admin.table.search')}
        </TRButton>
      </form>
    </div>
  );
}

export function AdminTableFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col"
      data-layout="table"
    >
      {children}
    </div>
  );
}

export function AdminTable({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <TRTable.Root
      aria-label={label}
      className="min-w-tinyrack-table-wide"
      containerClassName="min-h-0 max-w-full flex-1 overflow-auto"
      density="compact"
    >
      {children}
    </TRTable.Root>
  );
}

export function AdminSelectAll({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <TRCheckbox.Root
      aria-label={t('admin.selection.page')}
      checked={checked}
      indeterminate={indeterminate}
      onCheckedChange={(value) => onChange(value === true)}
      uiSize="md"
    >
      <TRCheckbox.Indicator />
    </TRCheckbox.Root>
  );
}

export function AdminRowCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <TRCheckbox.Root
      aria-label={label}
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
      uiSize="md"
    >
      <TRCheckbox.Indicator />
    </TRCheckbox.Root>
  );
}

export function AdminStickySelectCell({
  children,
  header = false,
  selected = false,
}: {
  children: ReactNode;
  header?: boolean;
  selected?: boolean;
}) {
  const Component = header ? TRTable.Head : TRTable.Cell;
  return (
    <Component
      className={`sticky left-0 z-tinyrack-raised w-tinyrack-control-xs ${selected ? 'admin-sticky-selected' : header ? 'bg-tinyrack-surface-muted' : 'bg-tinyrack-surface'}`}
    >
      {children}
    </Component>
  );
}

export function AdminStickyIdentityCell({
  children,
  header = false,
  selected = false,
}: {
  children: ReactNode;
  header?: boolean;
  selected?: boolean;
}) {
  const Component = header ? TRTable.Head : TRTable.Cell;
  return (
    <Component
      className={`sticky left-tinyrack-control-xs z-tinyrack-raised min-w-tinyrack-control-lg ${selected ? 'admin-sticky-selected' : header ? 'bg-tinyrack-surface-muted' : 'bg-tinyrack-surface'}`}
    >
      {children}
    </Component>
  );
}

export function AdminStickyActionCell({
  children,
  header = false,
  selected = false,
}: {
  children: ReactNode;
  header?: boolean;
  selected?: boolean;
}) {
  const Component = header ? TRTable.Head : TRTable.Cell;
  return (
    <Component
      className={`sticky right-0 z-tinyrack-raised text-right ${selected ? 'admin-sticky-selected' : header ? 'bg-tinyrack-surface-muted' : 'bg-tinyrack-surface'}`}
    >
      {children}
    </Component>
  );
}

export function AdminSortButton({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction?: 'asc' | 'desc' | undefined;
  onClick: () => void;
}) {
  const Icon = direction === 'desc' ? ArrowDownIcon : ArrowUpIcon;
  return (
    <TRButton appearance="ghost" onClick={onClick} type="button" uiSize="sm">
      {label}
      {direction ? <Icon aria-hidden className="size-tinyrack-md" /> : null}
    </TRButton>
  );
}

export function AdminFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <TRSelect.Root
      onValueChange={(nextValue) => {
        if (typeof nextValue === 'string') onChange(nextValue);
      }}
      value={value}
    >
      <TRSelect.Trigger aria-label={label} uiSize="sm">
        <TRSelect.Value>
          {options.find(([option]) => option === value)?.[1] ?? value}
        </TRSelect.Value>
        <TRSelect.Icon>
          <ChevronDownIcon aria-hidden />
        </TRSelect.Icon>
      </TRSelect.Trigger>
      <TRSelect.Positioner>
        <TRSelect.Popup>
          <TRSelect.List>
            {options.map(([option, text]) => (
              <TRSelect.Item key={option} value={option}>
                <TRSelect.ItemText>{text}</TRSelect.ItemText>
                <TRSelect.ItemIndicator>
                  <CheckIcon aria-hidden />
                </TRSelect.ItemIndicator>
              </TRSelect.Item>
            ))}
          </TRSelect.List>
        </TRSelect.Popup>
      </TRSelect.Positioner>
    </TRSelect.Root>
  );
}

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useTranslation();
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  return (
    <div className="flex shrink-0 items-center justify-between gap-tinyrack-md py-tinyrack-sm">
      <AdminFilterSelect
        label={t('admin.table.pageSize')}
        onChange={(value) => onPageSizeChange(Number(value))}
        options={['20', '50', '100'].map((size) => [size, size])}
        value={String(pageSize)}
      />
      <div className="flex items-center gap-tinyrack-sm">
        <TRButton
          appearance="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
          uiSize="sm"
        >
          {t('admin.table.previous')}
        </TRButton>
        <TRText color="muted" variant="caption">
          {t('admin.table.page', { page, total: lastPage })}
        </TRText>
        <TRButton
          appearance="ghost"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
          type="button"
          uiSize="sm"
        >
          {t('admin.table.next')}
        </TRButton>
      </div>
    </div>
  );
}

export function AdminBulkBar({
  selected,
  total,
  filterSelected,
  canExpand,
  onExpand,
  onClear,
  onActivate,
  onDeactivate,
  pending,
}: {
  selected: number;
  total: number;
  filterSelected: boolean;
  canExpand: boolean;
  onExpand: () => void;
  onClear: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed right-tinyrack-lg bottom-tinyrack-lg z-tinyrack-dropdown flex max-w-[calc(100vw-var(--tinyrack-space-lg)*2)] flex-wrap items-center gap-tinyrack-sm rounded-tinyrack-lg bg-tinyrack-surface px-tinyrack-lg py-tinyrack-sm shadow-tinyrack-overlay"
      data-testid="admin-bulk-bar"
    >
      <TRText variant="bodySm" weight="strong">
        {t('admin.selection.selected', {
          count: filterSelected ? total : selected,
        })}
      </TRText>
      <TRText color="muted" variant="caption">
        {t(
          filterSelected
            ? 'admin.selection.filterScope'
            : 'admin.selection.pageScope',
        )}
      </TRText>
      {canExpand && !filterSelected ? (
        <TRButton
          appearance="ghost"
          onClick={onExpand}
          type="button"
          uiSize="sm"
        >
          {t('admin.selection.selectAll', { count: total })}
        </TRButton>
      ) : null}
      <TRButton
        disabled={pending}
        onClick={onActivate}
        type="button"
        uiSize="sm"
      >
        {t('admin.selection.activate')}
      </TRButton>
      <TRButton
        disabled={pending}
        intent="danger"
        onClick={onDeactivate}
        type="button"
        uiSize="sm"
      >
        {t('admin.selection.deactivate')}
      </TRButton>
      <TRButton
        appearance="ghost"
        aria-label={t('admin.selection.clear')}
        onClick={onClear}
        type="button"
        uiSize="sm"
      >
        <XIcon aria-hidden />
      </TRButton>
    </div>
  );
}
