import { readFile } from "node:fs/promises";
import type { Server as HttpServer } from "node:http";
import path from "node:path";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { isProduction } from "./config/env.js";

export function isFrontendDocumentRequest(method: string, acceptsHtml: boolean): boolean {
  return (method === "GET" || method === "HEAD") && acceptsHtml;
}

export async function attachFrontend(app: Express, httpServer: HttpServer): Promise<void> {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer, path: "/__vite_hmr" },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    return;
  }

  const clientDirectory = path.resolve(process.cwd(), "dist/client");
  app.use(
    "/assets",
    express.static(path.join(clientDirectory, "assets"), {
      immutable: true,
      maxAge: "1y",
    }),
  );
  app.use(express.static(clientDirectory, { index: false, maxAge: "1h" }));
  app.use(async (request: Request, response: Response, next: NextFunction) => {
    if (!isFrontendDocumentRequest(request.method, Boolean(request.accepts("html")))) return next();
    try {
      const html = await readFile(path.join(clientDirectory, "index.html"), "utf8");
      response.setHeader("Cache-Control", "no-store");
      response.type("html").send(html);
    } catch (error) {
      next(error);
    }
  });
}
