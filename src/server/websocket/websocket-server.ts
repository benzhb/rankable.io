import type { Server as HttpServer, IncomingMessage } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { websocketClientFrameSchema } from "../../shared/schemas/websocket.schema.js";
import { env, isProduction } from "../config/env.js";
import type { Application } from "../application.js";
import { AppError } from "../models/app-error.js";
import { ConnectionRegistry, type AuthenticatedConnection } from "./connection-registry.js";

function originAllowed(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return !isProduction;
  const allowed = new Set([
    `http://localhost:${env.port}`,
    `http://127.0.0.1:${env.port}`,
    env.publicHostname ? `https://${env.publicHostname}` : "",
    env.discordClientId ? `https://${env.discordClientId}.discordsays.com` : "",
  ]);
  return allowed.has(origin);
}

function send(socket: WebSocket, value: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function sendError(socket: WebSocket, error: unknown): void {
  const appError = error instanceof AppError ? error : null;
  send(socket, {
    type: "error",
    error: {
      code: appError?.code ?? "WEBSOCKET_ERROR",
      message: appError?.message ?? "Unable to process WebSocket message",
    },
  });
}

export function attachWebSocketServer(
  server: HttpServer,
  application: Application,
): { close: () => Promise<void> } {
  const webSockets = new WebSocketServer({ noServer: true });
  const registry = new ConnectionRegistry();
  let shuttingDown = false;

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", `http://${request.headers.host}`).pathname;
    if (pathname !== "/ws") return;
    if (!originAllowed(request)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    webSockets.handleUpgrade(request, socket, head, (client) => {
      webSockets.emit("connection", client, request);
    });
  });

  webSockets.on("connection", (socket) => {
    let connection: AuthenticatedConnection | null = null;
    const authDeadline = setTimeout(() => socket.close(4401, "Authentication required"), 5_000);

    socket.on("message", async (raw) => {
      try {
        const parsedJson = JSON.parse(raw.toString()) as unknown;
        const result = websocketClientFrameSchema.safeParse(parsedJson);
        if (!result.success) {
          throw new AppError(400, "INVALID_FRAME", "WebSocket frame is invalid");
        }
        const frame = result.data;
        if (!connection) {
          if (frame.type !== "authenticate") {
            throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authenticate first");
          }
          const context = await application.accessSessions.authenticate(frame.token);
          if (!context) throw new AppError(401, "INVALID_SESSION", "Session token is invalid");
          clearTimeout(authDeadline);
          connection = registry.add(socket, context);
          send(socket, {
            type: "session.snapshot",
            snapshot: await application.snapshots.get(context.sessionId, context.userId),
          });
          return;
        }

        if (frame.type === "authenticate") return;
        if (frame.type === "turn.card.endpoint-changed") {
          await application.rounds.changeEndpoint(connection.context, frame);
        }
      } catch (error) {
        sendError(socket, error);
      }
    });

    socket.on("close", () => {
      clearTimeout(authDeadline);
      if (!connection) return;
      const context = connection.context;
      registry.remove(connection);
      connection = null;
      if (
        !shuttingDown &&
        registry.countForUser(context.sessionId, context.userId) === 0
      ) {
        void application.lifecycle.disconnected(context).catch(console.error);
      }
    });
  });

  const unsubscribe = application.events.subscribe(async (sessionId) => {
    await Promise.all(
      registry.forSession(sessionId).map(async ({ socket, context }) => {
        try {
          send(socket, {
            type: "session.snapshot",
            snapshot: await application.snapshots.get(sessionId, context.userId),
          });
        } catch (error) {
          sendError(socket, error);
        }
      }),
    );
  });

  return {
    close: async () => {
      shuttingDown = true;
      unsubscribe();
      for (const connection of registry.all()) connection.socket.close();
      await new Promise<void>((resolve) => webSockets.close(() => resolve()));
    },
  };
}
