export type DependencyStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyStatus;
  };
}
