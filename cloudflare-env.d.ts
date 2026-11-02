/// <reference types="vite/client" />
declare namespace Cloudflare {
 interface Env {
  DB?:D1Database;
  BUCKET?:R2Bucket;
  MYFTC_DATA_ENABLED?:string;
  MYFTC_SERVICE_PAUSED?:string;
  MYFTC_READINESS_RECORD?:string;
 }
}
