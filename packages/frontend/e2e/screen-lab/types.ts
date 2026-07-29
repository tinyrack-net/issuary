import type { Page } from '@playwright/test';
import type {
  RouteScreenScenarioDefinition,
  ServerScreenScenarioDefinition,
} from '#frontend/test-utils/screen-scenario-catalog.ts';
import type { E2EConfigResult } from '#frontend-e2e/setup/create-server.ts';

export type ScreenScenarioConfigFactory = (
  backendPort: number,
  frontendPort: number,
  auxiliaryPort: number,
) => E2EConfigResult;

export type ServerScreenScenarioContext = {
  baseURL: string;
  page: Page;
  scenario: ServerScreenScenarioDefinition;
};

export type ServerScreenScenarioAdapter = {
  config: ScreenScenarioConfigFactory;
  prepare: (context: ServerScreenScenarioContext) => Promise<void>;
};

export type ServerScreenScenario = ServerScreenScenarioDefinition &
  ServerScreenScenarioAdapter;

export type ScreenScenario =
  | RouteScreenScenarioDefinition
  | ServerScreenScenario;
