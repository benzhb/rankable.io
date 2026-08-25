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

  endGame = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.rounds.endGame(auth, request.params.roundId as string);
      response.json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };

  vote = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.rounds.castDemocracyVote(
        auth,
        request.params.roundId as string,
        request.body.choice as "S" | "A" | "B" | "C" | "F" | "HAVENT_TRIED",
      );
      response.json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };

  claimCard = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.rounds.claimChaosCard(
        auth,
        request.params.roundId as string,
        request.body.cardId as string,
      );
      response.json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };

  placeClaim = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const auth = request.auth!;
      await this.rounds.placeChaosCard(
        auth,
        request.params.roundId as string,
        request.params.cardId as string,
        request.body.tier as "S" | "A" | "B" | "C" | "F",
      );
      response.json(await this.snapshots.get(auth.sessionId, auth.userId));
    } catch (error) {
      next(error);
    }
  };
}
