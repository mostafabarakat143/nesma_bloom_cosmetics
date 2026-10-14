import type { UserRole } from "../../generated/prisma/client.js";

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
  sessionId: string;
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
