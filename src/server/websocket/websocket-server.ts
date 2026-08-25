import type { Server as HttpServer, IncomingMessage } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { websocketClientFrameSchema } from "../../shared/schemas/websocket.schema.js";
import { env, isProduction } from "../config/env.js";
import type { Application } from "../application.js";
import { AppError } from "../models/app-error.js";
import { ConnectionRegistry, type AuthenticatedConnection } from "./connection-registry.js";

interface ActivePresentationDrag {
  sessionId: string;
  userId: string;
  participantId: string;
  roundId: string;
  turnNumber: number;
  cardId: string;
  sequence: number;
  lastMovedAt: number;
}

const PRESENTATION_DRAG_INTERVAL_MS = 40;

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
  const lastEmoteAt = new Map<string, number>();
  const activeDrags = new Map<string, ActivePresentationDrag>();
  let shuttingDown = false;

  const broadcastToSession = (sessionId: string, frame: unknown) => {
    for (const recipient of registry.forSession(sessionId)) send(recipient.socket, frame);
  };

  const endDrag = (drag: ActivePresentationDrag) => {
    if (activeDrags.get(drag.roundId) !== drag) return;
    activeDrags.delete(drag.roundId);
    broadcastToSession(drag.sessionId, {
      type: "presentation.drag.ended",
      roundId: drag.roundId,
      participantId: drag.participantId,
      cardId: drag.cardId,
      turnNumber: drag.turnNumber,
    });
  };

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
        } else if (frame.type === "presentation.drag.started") {
          const participantId = await application.rounds.selectPresentationCard(
            connection.context,
            frame,
          );
          const latest = await application.snapshots.get(
            connection.context.sessionId,
            connection.context.userId,
          );
          if (
            latest.round?.status !== "PLAYING" ||
            latest.round.gameMode !== "PRESENTATION" ||
            latest.round.id !== frame.roundId ||
            latest.round.turnNumber !== frame.turnNumber ||
            latest.round.currentPlayerId !== participantId ||
            latest.round.selectedCardId !== frame.cardId
          ) return;
          const previous = activeDrags.get(frame.roundId);
          if (previous) endDrag(previous);
          const drag: ActivePresentationDrag = {
            sessionId: connection.context.sessionId,
            userId: connection.context.userId,
            participantId,
            roundId: frame.roundId,
            turnNumber: frame.turnNumber,
            cardId: frame.cardId,
            sequence: 0,
            lastMovedAt: Date.now(),
          };
          activeDrags.set(frame.roundId, drag);
          broadcastToSession(drag.sessionId, {
            type: "presentation.drag.position",
            roundId: drag.roundId,
            participantId,
            cardId: drag.cardId,
            turnNumber: drag.turnNumber,
            x: frame.x,
            y: frame.y,
            sequence: 0,
          });
        } else if (frame.type === "presentation.drag.moved") {
          const drag = activeDrags.get(frame.roundId);
          if (
            !drag ||
            drag.userId !== connection.context.userId ||
            drag.cardId !== frame.cardId ||
            drag.turnNumber !== frame.turnNumber ||
            frame.sequence <= drag.sequence
          ) {
            throw new AppError(409, "STALE_DRAG", "That drag is no longer active");
          }
          const now = Date.now();
          if (now - drag.lastMovedAt < PRESENTATION_DRAG_INTERVAL_MS) return;
          drag.sequence = frame.sequence;
          drag.lastMovedAt = now;
          broadcastToSession(drag.sessionId, {
            type: "presentation.drag.position",
            roundId: drag.roundId,
            participantId: drag.participantId,
            cardId: drag.cardId,
            turnNumber: drag.turnNumber,
            x: frame.x,
            y: frame.y,
            sequence: frame.sequence,
          });
        } else if (frame.type === "presentation.drag.ended") {
          const drag = activeDrags.get(frame.roundId);
          if (drag?.userId === connection.context.userId) endDrag(drag);
        } else if (frame.type === "round.emote.send") {
          const cooldownKey = `${connection.context.sessionId}:${connection.context.userId}`;
          const now = Date.now();
          if (now - (lastEmoteAt.get(cooldownKey) ?? 0) < 600) {
            throw new AppError(429, "EMOTE_COOLDOWN", "Wait a moment before emoting again");
          }
          const participantId = await application.rounds.participantForEmote(
            connection.context,
            frame.roundId,
          );
          lastEmoteAt.set(cooldownKey, now);
          const emoteFrame = {
            type: "round.emote",
            roundId: frame.roundId,
            participantId,
            emote: frame.emote,
            sentAt: new Date(now).toISOString(),
          };
          broadcastToSession(connection.context.sessionId, emoteFrame);
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
      for (const drag of activeDrags.values()) {
        if (drag.sessionId === context.sessionId && drag.userId === context.userId) endDrag(drag);
      }
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
          const snapshot = await application.snapshots.get(sessionId, context.userId);
          const drag = snapshot.round ? activeDrags.get(snapshot.round.id) : undefined;
          if (
            drag &&
            (snapshot.round?.status !== "PLAYING" ||
              snapshot.round.gameMode !== "PRESENTATION" ||
              snapshot.round.turnNumber !== drag.turnNumber ||
              snapshot.round.currentPlayerId !== drag.participantId ||
              snapshot.round.selectedCardId !== drag.cardId ||
              snapshot.round.placements.some((placement) => placement.id === drag.cardId))
          ) endDrag(drag);
          send(socket, {
            type: "session.snapshot",
            snapshot,
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
