import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../models/app-error.js";

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: { code: "NOT_FOUND", message: "The requested resource was not found" },
  });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
};
