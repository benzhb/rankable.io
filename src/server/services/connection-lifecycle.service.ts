import type { AuthContext } from "../models/auth-context.js";
import type { SessionService } from "./session.service.js";

export class ConnectionLifecycleService {
  constructor(private readonly sessions: SessionService) {}

  async disconnected(context: AuthContext): Promise<void> {
    await this.sessions.leave(context, "DISCONNECTED");
  }
}
