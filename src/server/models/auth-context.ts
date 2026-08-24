export interface AuthContext {
  accessSessionId: string;
  sessionId: string;
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
