export type SessionChangedListener = (sessionId: string) => void | Promise<void>;

export class SessionEventBus {
  private readonly listeners = new Set<SessionChangedListener>();

  subscribe(listener: SessionChangedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async emit(sessionId: string): Promise<void> {
    await Promise.allSettled(
      [...this.listeners].map((listener) => Promise.resolve(listener(sessionId))),
    );
  }
}
