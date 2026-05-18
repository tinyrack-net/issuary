import { Fragment, type ReactNode, useEffect, useState } from 'react';

type AdminTableColumn = {
  header: ReactNode;
  key: string;
};

type AdminTableProps<Row> = {
  ariaLabel: string;
  columns: AdminTableColumn[];
  emptyMessage?: ReactNode;
  errorMessage?: ReactNode;
  getRowKey: (row: Row) => string;
  isLoading?: boolean;
  loadingMessage?: ReactNode;
  renderMobileCard?: (row: Row) => ReactNode;
  renderRow: (row: Row) => ReactNode;
  rows: Row[];
};

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

export function AdminTable<Row>({
  ariaLabel,
  columns,
  emptyMessage,
  errorMessage,
  getRowKey,
  isLoading = false,
  loadingMessage,
  renderMobileCard,
  renderRow,
  rows,
}: AdminTableProps<Row>) {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (!renderMobileCard || typeof window === 'undefined') {
      return true;
    }

    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (!renderMobileCard) {
      setIsDesktop(true);
      return;
    }

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const updateDesktopState = () => {
      setIsDesktop(mediaQuery.matches);
    };

    updateDesktopState();
    mediaQuery.addEventListener('change', updateDesktopState);

    return () => {
      mediaQuery.removeEventListener('change', updateDesktopState);
    };
  }, [renderMobileCard]);

  if (errorMessage) {
    return <div className="alert alert-error">{errorMessage}</div>;
  }

  if (isLoading) {
    return (
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body flex-row items-center gap-3">
          <span aria-hidden="true" className="loading loading-spinner" />
          <span>{loadingMessage}</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0 && emptyMessage) {
    return <div className="alert">{emptyMessage}</div>;
  }

  if (renderMobileCard && !isDesktop) {
    return (
      <ul aria-label={ariaLabel} className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li className="list-none" key={getRowKey(row)}>
            {renderMobileCard(row)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
      <table
        aria-label={ariaLabel}
        className="table-zebra table-pin-rows table-sm lg:table-md table min-w-max"
      >
        <thead className="bg-base-200 text-base-content">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={getRowKey(row)}>{renderRow(row)}</Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
