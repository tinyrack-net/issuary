import { queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';

export type AppConfigs = {
  database: {
    enabled: boolean;
  };
};

export const appConfigQueryOptions = queryOptions({
  queryKey: ['appConfig'],
  queryFn: async () => {
    const response = await etch('/api/v1/config');
    const data = await response.json();
    return data as AppConfigs;
  },
});
