import { useTranslation } from 'react-i18next';

type PaginationControlsProps = {
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  total: number;
};

const VISIBLE_PAGE_COUNT = 5;

function pageNumbers(currentPage: number, totalPages: number): number[] {
  const visibleCount = Math.min(VISIBLE_PAGE_COUNT, totalPages);
  const halfWindow = Math.floor(visibleCount / 2);
  const latestStart = totalPages - visibleCount + 1;
  const start = Math.max(1, Math.min(currentPage - halfWindow, latestStart));

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

export function PaginationControls({
  limit,
  offset,
  onOffsetChange,
  total,
}: PaginationControlsProps) {
  const { t } = useTranslation();
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(
    Math.max(1, Math.floor(offset / safeLimit) + 1),
    totalPages,
  );
  const previousOffset = Math.max(0, offset - safeLimit);
  const lastPageOffset = Math.max(0, (totalPages - 1) * safeLimit);
  const nextOffset = Math.min(offset + safeLimit, lastPageOffset);
  const isPreviousDisabled = currentPage <= 1;
  const isNextDisabled = total === 0 || currentPage >= totalPages;
  const visiblePages = pageNumbers(currentPage, totalPages);

  return (
    <nav
      aria-label={t('common.pagination.label')}
      className="card border border-base-300 bg-base-100 shadow-sm"
    >
      <div className="card-body flex flex-col-reverse items-stretch gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p className="text-center text-base-content/65 text-sm sm:text-left">
          {t('common.pagination.pageStatus', {
            page: currentPage,
            pages: totalPages,
            total,
          })}
        </p>
        <div className="join justify-center overflow-x-auto">
          <button
            aria-label={t('common.pagination.firstPage')}
            className="btn btn-outline join-item btn-sm"
            disabled={isPreviousDisabled}
            onClick={() => {
              onOffsetChange(0);
            }}
            type="button"
          >
            «
          </button>
          <button
            aria-label={t('common.pagination.previousPage')}
            className="btn btn-outline join-item btn-sm"
            disabled={isPreviousDisabled}
            onClick={() => {
              onOffsetChange(previousOffset);
            }}
            type="button"
          >
            {'<'}
          </button>
          {visiblePages.map((page) => {
            const isCurrentPage = page === currentPage;

            return (
              <button
                aria-current={isCurrentPage ? 'page' : undefined}
                aria-label={t('common.pagination.page', { page })}
                className={`btn join-item btn-sm ${isCurrentPage ? 'btn-active btn-primary' : 'btn-outline'}`}
                key={page}
                onClick={() => {
                  onOffsetChange((page - 1) * safeLimit);
                }}
                type="button"
              >
                {page}
              </button>
            );
          })}
          <button
            aria-label={t('common.pagination.nextPage')}
            className="btn btn-outline join-item btn-sm"
            disabled={isNextDisabled}
            onClick={() => {
              onOffsetChange(nextOffset);
            }}
            type="button"
          >
            {'>'}
          </button>
          <button
            aria-label={t('common.pagination.lastPage')}
            className="btn btn-outline join-item btn-sm"
            disabled={isNextDisabled}
            onClick={() => {
              onOffsetChange(lastPageOffset);
            }}
            type="button"
          >
            »
          </button>
        </div>
      </div>
    </nav>
  );
}
