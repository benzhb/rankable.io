import type { NextFunction, Request, Response } from "express";
import type { SessionService } from "../services/session.service.js";
import type { SnapshotService } from "../services/snapshot.service.js";

export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly snapshots: SnapshotService,
  ) {}

  show = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      response.json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };

  join = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.sessions.join(auth);
      response.status(201).json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };

  leave = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.sessions.leave(auth);
      response.json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };

  startCountdown = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.sessions.startCountdown(
        auth,
        request.body.categoryKey as string,
        request.body.gameMode as "PRESENTATION" | "DEMOCRACY" | "CHAOS",
      );
      response.status(201).json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };

  cancelCountdown = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.sessions.cancelCountdown(auth);
      response.json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };
}
