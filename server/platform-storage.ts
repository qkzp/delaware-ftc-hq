import "server-only";
import { Buffer } from "node:buffer";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type D1Meta = { changes: number; last_row_id?: number };
type D1Result<T = unknown> = { success: boolean; results: T[]; meta: D1Meta };

function d1Param(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  throw new Error("This storage operation used an unsupported D1 parameter type.");
}

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
};

function d1Endpoint() {
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(required("CLOUDFLARE_ACCOUNT_ID"))}/d1/database/${encodeURIComponent(required("CLOUDFLARE_D1_DATABASE_ID"))}/query`;
}

async function executeD1<T = unknown>(body: { sql: string; params: unknown[] } | { batch: Array<{ sql: string; params: unknown[] }> }): Promise<D1Result<T>[]> {
  const response = await fetch(d1Endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("CLOUDFLARE_D1_API_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let payload: { success?: boolean; errors?: Array<{ message?: string }>; result?: Array<{ success?: boolean; results?: T[]; meta?: { changes?: number; last_row_id?: number } }> };
  try {
    payload = await response.json();
  } catch {
    throw new Error("The D1 storage provider returned an unreadable response.");
  }
  if (!response.ok || payload.success !== true || !payload.result?.every((item) => item.success !== false)) {
    const providerMessage = payload.errors?.[0]?.message;
    throw new Error(`D1 query failed${providerMessage ? `: ${providerMessage}` : "."}`);
  }
  return payload.result.map((item) => ({
    success: item.success !== false,
    results: item.results ?? [],
    meta: { changes: item.meta?.changes ?? 0, last_row_id: item.meta?.last_row_id },
  }));
}

class RemoteStatement {
  readonly sql: string;
  readonly params: unknown[];

  constructor(sql: string, params: unknown[] = []) {
    this.sql = sql;
    this.params = params;
  }

  bind(...params: unknown[]) {
    return new RemoteStatement(this.sql, params);
  }

  get boundParams() {
    return this.params.map(d1Param);
  }

  async all<T = unknown>() {
    const [result] = await executeD1<T>({ sql: this.sql, params: this.boundParams });
    return result;
  }

  async first<T = unknown>(columnName?: string): Promise<T | null> {
    const result = await this.all<Record<string, T>>();
    const row = result.results[0];
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }

  async run() {
    const [result] = await executeD1({ sql: this.sql, params: this.boundParams });
    return result;
  }
}

class RemoteD1 {
  prepare(sql: string) {
    return new RemoteStatement(sql);
  }

  async batch(statements: RemoteStatement[]) {
    return executeD1({ batch: statements.map((statement) => ({ sql: statement.sql, params: statement.boundParams })) });
  }
}

let d1: D1Database | undefined;
export function getPlatformD1(): D1Database {
  return (d1 ??= new RemoteD1() as unknown as D1Database);
}

let s3: S3Client | undefined;
const getS3 = () => (s3 ??= new S3Client({
  region: "auto",
  endpoint: `https://${required("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: required("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: required("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
  },
}));

const getBucketName = () => required("CLOUDFLARE_R2_BUCKET_NAME");

class RemoteR2 {
  async put(key: string, value: ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }) {
    const body = typeof value === "string" ? value : ArrayBuffer.isView(value)
      ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
      : Buffer.from(value);
    await getS3().send(new PutObjectCommand({ Bucket: getBucketName(), Key: key, Body: body, ContentType: options?.httpMetadata?.contentType }));
  }

  async get(key: string) {
    try {
      const object = await getS3().send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
      if (!object.Body) return null;
      return {
        body: object.Body.transformToWebStream(),
        httpMetadata: { contentType: object.ContentType },
        size: object.ContentLength,
      };
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && (error.name === "NoSuchKey" || error.name === "NotFound")) return null;
      throw error;
    }
  }

  async delete(key: string) {
    await getS3().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
  }
}

let r2: R2Bucket | undefined;
export function getPlatformR2(): R2Bucket {
  return (r2 ??= new RemoteR2() as unknown as R2Bucket);
}

export function hasPlatformStorageConfig() {
  return ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_D1_API_TOKEN", "CLOUDFLARE_R2_BUCKET_NAME", "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY"].every((key) => !!process.env[key]?.trim());
}
