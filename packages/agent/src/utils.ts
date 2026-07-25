/**
 * @auth/agent — Utility functions
 */

import { randomBytes } from "@noble/hashes/utils";

export function generateId(): string {
  return Buffer.from(randomBytes(16)).toString("hex");
}
