import { randomBytes } from "node:crypto";
import { HttpError } from "./http-error.js";
import type { GatewayIdentity, HandoffRecord } from "./types.js";

export class HandoffStore {
  private readonly records = new Map<string, HandoffRecord>();

  constructor(private readonly ttlSeconds: number) {}

  create(identity: GatewayIdentity): string {
    const code = randomBytes(32).toString("base64url");
    this.records.set(code, {
      identity,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
    return code;
  }

  consume(code: string): GatewayIdentity {
    const record = this.records.get(code);
    this.records.delete(code);

    if (!record || record.expiresAt <= Date.now()) {
      throw new HttpError(400, "Invalid or expired gateway code.", "invalid_gateway_code");
    }

    return record.identity;
  }

  pruneExpired(now = Date.now()): void {
    for (const [code, record] of this.records.entries()) {
      if (record.expiresAt <= now) {
        this.records.delete(code);
      }
    }
  }
}
