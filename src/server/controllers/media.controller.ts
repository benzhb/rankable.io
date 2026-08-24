import type { NextFunction, Request, Response } from "express";
import { AppError } from "../models/app-error.js";
import type { MediaCatalogService } from "../services/media-catalog.service.js";

export class MediaController {
  constructor(private readonly media: MediaCatalogService) {}

  showCard = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const cardId = request.params.cardId as string;
      const image = await this.media.cardImage(cardId);
      if (!image) throw new AppError(404, "MEDIA_NOT_FOUND", "Media card image not found");

      response.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      response.type(image.contentType).send(image.body);
    } catch (error) {
      next(error);
    }
  };
}
