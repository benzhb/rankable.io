import type { NextFunction, Request, Response } from "express";
import type { AccessSessionRepository } from "../repositories/access-session.repository.js";

export function authenticate(repository: AccessSessionRepository) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const authorization = request.header("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!token) {
      response.status(401).json({
        error: { code: "AUTHENTICATION_REQUIRED", message: "Bearer token required" },
      });
      return;
    }

    try {
      const context = await repository.authenticate(token);
      if (!context) {
        response.status(401).json({
          error: { code: "INVALID_SESSION", message: "Session token is invalid or expired" },
        });
        return;
      }
      request.auth = context;
      next();
    } catch (error) {
      next(error);
    }
  };
}
