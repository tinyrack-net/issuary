const DEFAULT_LIMIT = 20;

export type AdminListSearch = {
  limit: number;
  offset: number;
  search: string;
};

function parseInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function parseAdminListSearch(
  search: Record<string, unknown>,
): AdminListSearch {
  const parsedLimit = parseInteger(search.limit, DEFAULT_LIMIT);
  const parsedOffset = parseInteger(search.offset, 0);
  const searchText =
    typeof search.search === 'string' ? search.search.trim() : '';

  return {
    limit: parsedLimit >= 1 && parsedLimit <= 100 ? parsedLimit : DEFAULT_LIMIT,
    offset: parsedOffset >= 0 ? parsedOffset : 0,
    search: searchText,
  };
}
