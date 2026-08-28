import { useMemo, useState } from 'react';

type ExplicitSelection = { kind: 'ids'; ids: Set<string> };
type FilterSelection = { kind: 'filter' };
export type AdminSelection = ExplicitSelection | FilterSelection;

export function useAdminSelection(pageIds: string[]) {
  const [selection, setSelection] = useState<AdminSelection>(() => ({
    kind: 'ids',
    ids: new Set(),
  }));

  const selectedOnPage = useMemo(() => {
    if (selection.kind === 'filter') return pageIds.length;
    return pageIds.filter((id) => selection.ids.has(id)).length;
  }, [pageIds, selection]);

  const clear = () => setSelection({ kind: 'ids', ids: new Set() });

  const togglePage = (checked: boolean) => {
    setSelection({
      kind: 'ids',
      ids: checked ? new Set(pageIds) : new Set(),
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelection((current) => {
      const next =
        current.kind === 'filter' ? new Set(pageIds) : new Set(current.ids);
      if (checked) next.add(id);
      else next.delete(id);
      return { kind: 'ids', ids: next };
    });
  };

  return {
    selection,
    selectedOnPage,
    allOnPage: pageIds.length > 0 && selectedOnPage === pageIds.length,
    someOnPage: selectedOnPage > 0 && selectedOnPage < pageIds.length,
    selectedCount: selection.kind === 'ids' ? selection.ids.size : undefined,
    isSelected: (id: string) =>
      selection.kind === 'filter' || selection.ids.has(id),
    selectFilter: () => setSelection({ kind: 'filter' }),
    clear,
    togglePage,
    toggleOne,
  };
}
