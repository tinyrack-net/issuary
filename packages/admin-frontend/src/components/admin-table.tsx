import { Fragment, type ReactNode } from 'react';

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
  renderRow: (row: Row) => ReactNode;
  rows: Row[];
};

export function AdminTable<Row>({
  ariaLabel,
  columns,
  emptyMessage,
  errorMessage,
  getRowKey,
  isLoading = false,
  loadingMessage,
  renderRow,
  rows,
}: AdminTableProps<Row>) {
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

  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
      <table
        aria-label={ariaLabel}
        className="table-zebra table-sm sm:table-md table min-w-max"
      >
        <thead>
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
