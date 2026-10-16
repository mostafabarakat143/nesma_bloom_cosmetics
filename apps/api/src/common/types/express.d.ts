import type { UserRole } from "../../generated/prisma/client.js";

export type AuthenticatedUser = {
  id: number;
  role: UserRole;
  /** Present for logout revocation; set by auth middleware. */
  jti?: string;
  /** JWT exp (unix seconds); set by auth middleware when available. */
  exp?: number;
};

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
    }
  }
}

export {};
