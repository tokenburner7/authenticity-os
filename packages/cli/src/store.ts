import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface StoreData {
  identity?: {
    id: string;
    handle: string;
    secretKey: string;
    assurance: string;
    createdAt: string;
  };
  credentials?: unknown[];
  reputation?: { vouches: unknown[] };
}

export function loadStore(path: string): StoreData {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function saveStore(path: string, data: StoreData): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
