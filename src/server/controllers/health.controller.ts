import type { NextFunction, Request, Response } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";

export class HealthController {
  constructor(private readonly database: PrismaClient) {}

  live = (_request: Request, response: Response) => {
    response.json({ status: "ok" });
  };

  ready = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      await this.database.$queryRaw`SELECT 1`;
      response.json({ status: "ready" });
    } catch (error) {
      next(error);
    }
  };
}
