import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  retryPrismaWriteConflict,
  withSerializableTransaction,
} from "../../src/server/infrastructure/transaction-retry.js";

function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}

function driverAdapterConflict(): Error & {
  cause: { originalCode: string; kind: string };
} {
  return Object.assign(new Error("Driver adapter write conflict"), {
    cause: {
      originalCode: "40001",
      kind: "TransactionWriteConflict",
    },
  });
}

describe("Prisma transaction retry", () => {
  it("retries P2034 write conflicts and returns the successful result", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(prismaError("P2034"))
      .mockRejectedValueOnce(prismaError("P2034"))
      .mockResolvedValue("committed");

    await expect(retryPrismaWriteConflict(operation)).resolves.toBe("committed");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("retries direct PostgreSQL driver-adapter serialization failures", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(driverAdapterConflict())
      .mockResolvedValue("committed");

    await expect(retryPrismaWriteConflict(operation)).resolves.toBe("committed");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("retries direct PostgreSQL serialization and deadlock codes", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(prismaError("40001"))
      .mockRejectedValueOnce(prismaError("40P01"))
      .mockResolvedValue("committed");

    await expect(retryPrismaWriteConflict(operation)).resolves.toBe("committed");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("stops retrying after the configured attempt limit", async () => {
    const conflict = prismaError("P2034");
    const operation = vi.fn().mockRejectedValue(conflict);

    await expect(retryPrismaWriteConflict(operation, 3)).rejects.toBe(conflict);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated errors", async () => {
    const unrelated = prismaError("P2002");
    const operation = vi.fn().mockRejectedValue(unrelated);

    await expect(retryPrismaWriteConflict(operation)).rejects.toBe(unrelated);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("rejects invalid attempt limits before running the operation", async () => {
    const operation = vi.fn();

    await expect(retryPrismaWriteConflict(operation, 0)).rejects.toThrow(TypeError);
    expect(operation).not.toHaveBeenCalled();
  });

  it("retries the complete transaction with Serializable isolation", async () => {
    const transaction = vi.fn()
      .mockRejectedValueOnce(prismaError("P2034"))
      .mockResolvedValue("committed");
    const database = { $transaction: transaction } as unknown as PrismaClient;
    const operation = vi.fn();

    await expect(withSerializableTransaction(database, operation)).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(operation, { isolationLevel: "Serializable" });
  });
});
