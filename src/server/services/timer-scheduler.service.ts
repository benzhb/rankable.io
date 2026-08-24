export class TimerSchedulerService {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  schedule(key: string, deadline: Date, callback: () => void | Promise<void>): void {
    this.cancel(key);
    const delay = Math.max(0, Math.min(deadline.getTime() - Date.now(), 2_147_000_000));
    const timer = setTimeout(() => {
      this.timers.delete(key);
      void Promise.resolve(callback()).catch((error) => console.error(error));
    }, delay);
    timer.unref?.();
    this.timers.set(key, timer);
  }

  cancel(key: string): void {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    this.timers.delete(key);
  }

  stopAll(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
