import "server-only";
import type { ReadinessEnvironment } from "./readiness";
import { getPlatformD1, getPlatformR2, hasPlatformStorageConfig } from "./platform-storage";

export function getReadinessEnvironment(): ReadinessEnvironment {
  return {
    MYFTC_DATA_ENABLED: process.env.MYFTC_DATA_ENABLED,
    MYFTC_SERVICE_PAUSED: process.env.MYFTC_SERVICE_PAUSED,
    MYFTC_READINESS_RECORD: process.env.MYFTC_READINESS_RECORD,
  };
}

export function getDataStores() {
  if (!hasPlatformStorageConfig()) return null;
  return { DB: getPlatformD1(), BUCKET: getPlatformR2() };
}
