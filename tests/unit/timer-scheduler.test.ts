import { afterEach, describe, expect, it, vi } from "vitest";
import { TimerSchedulerService } from "../../src/server/services/timer-scheduler.service.js";

describe("timer scheduler", () => {
  afterEach(() => vi.useRealTimers());

  it("runs a deadline callback once", async () => {
    vi.useFakeTimers();
    const scheduler = new TimerSchedulerService();
    const callback = vi.fn();
    scheduler.schedule("turn:1", new Date(Date.now() + 15_000), callback);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("replaces an existing timer with the same key", async () => {
    vi.useFakeTimers();
    const scheduler = new TimerSchedulerService();
    const oldCallback = vi.fn();
    const newCallback = vi.fn();
    scheduler.schedule("countdown:1", new Date(Date.now() + 1_000), oldCallback);
    scheduler.schedule("countdown:1", new Date(Date.now() + 2_000), newCallback);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(oldCallback).not.toHaveBeenCalled();
    expect(newCallback).toHaveBeenCalledOnce();
  });
});
