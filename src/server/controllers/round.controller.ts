import type { NextFunction, Request, Response } from "express";
import type { RoundService } from "../services/round.service.js";
import type { SnapshotService } from "../services/snapshot.service.js";

export class RoundController {
  constructor(
    private readonly rounds: RoundService,
    private readonly snapshots: SnapshotService,
  ) {}

  endTurn = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.rounds.endTurn(auth, request.params.roundId as string);
      response.json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };
}
