export type TenantStatus = "approved" | "not_subscribed" | "blocked";

export interface TenantAccess {
  tenantId: string;
  name: string;
  status: TenantStatus;
}

export interface ProductConfig {
  id: string;
  name: string;
  appBaseUrl: string;
  allowedReturnOrigins: string[];
  entra: {
    clientIdEnv?: string;
    clientSecretEnv?: string;
    clientId?: string;
    clientSecretRef?: string;
    authorityTenant: string;
    scopes: string[];
  };
  tenantAllowlist: TenantAccess[];
  roleMap: Record<string, string>;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  publicBaseUrl: string;
  corsAllowedOrigins: string[];
  databaseUrl?: string;
  sessionIssuer: string;
  sessionTtlSeconds: number;
  handoffCodeTtlSeconds: number;
  stateSecret: string;
  sessionSigning:
    | {
        alg: "HS256";
        secret: string;
      }
    | {
        alg: "RS256";
        privateKeyPem: string;
        publicKeyPem: string;
      };
  products: ProductConfig[];
}

export interface AuthState {
  productId: string;
  returnUrl: string;
  nonce: string;
}

export interface GatewayIdentity {
  productId: string;
  tenantId: string;
  tenantName: string;
  userId: string;
  email?: string;
  name?: string;
  roles: string[];
}

export interface HandoffRecord {
  identity: GatewayIdentity;
  expiresAt: number;
}
