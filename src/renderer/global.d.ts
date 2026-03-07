import type { SecuritySurfaceApi } from '@/shared/security-surface-api';

declare global {
  interface Window {
    securitySurfaceApi: SecuritySurfaceApi;
  }
}

export {};
