import { randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { HttpError } from "./http-error.js";
import type { AuthState } from "./types.js";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAuthState(stateSecret: string, state: Omit<AuthState, "nonce">): Promise<string> {
  return new SignJWT({
    productId: state.productId,
    returnUrl: state.returnUrl,
    nonce: randomBytes(16).toString("base64url"),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey(stateSecret));
}

export async function verifyAuthState(stateSecret: string, token: string): Promise<AuthState> {
  try {
    const { payload } = await jwtVerify(token, secretKey(stateSecret), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.productId !== "string" ||
      typeof payload.returnUrl !== "string" ||
      typeof payload.nonce !== "string"
    ) {
      throw new Error("Malformed state");
    }
    return {
      productId: payload.productId,
      returnUrl: payload.returnUrl,
      nonce: payload.nonce,
    };
  } catch {
    throw new HttpError(400, "Invalid or expired auth state.", "invalid_state");
  }
}
