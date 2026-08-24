import type WebSocket from "ws";
import type { AuthContext } from "../models/auth-context.js";

export interface AuthenticatedConnection {
  socket: WebSocket;
  context: AuthContext;
}

export class ConnectionRegistry {
  private readonly connections = new Set<AuthenticatedConnection>();

  add(socket: WebSocket, context: AuthContext): AuthenticatedConnection {
    const connection = { socket, context };
    this.connections.add(connection);
    return connection;
  }

  remove(connection: AuthenticatedConnection): void {
    this.connections.delete(connection);
  }

  forSession(sessionId: string): AuthenticatedConnection[] {
    return [...this.connections].filter(
      (connection) => connection.context.sessionId === sessionId,
    );
  }

  all(): AuthenticatedConnection[] {
    return [...this.connections];
  }

  countForUser(sessionId: string, userId: string): number {
    return [...this.connections].filter(
      (connection) =>
        connection.context.sessionId === sessionId && connection.context.userId === userId,
    ).length;
  }
}
