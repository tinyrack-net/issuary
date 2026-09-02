import { createContext } from 'react-router';

export type FrontendRuntimeContext = {
  fetch: typeof fetch;
  request: Request;
};

export const frontendRuntimeContext =
  createContext<FrontendRuntimeContext | null>(null);
