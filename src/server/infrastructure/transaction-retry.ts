import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 10;
const MAX_RETRY_DELAY_MS = 100;

function isWriteConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as {
    code?: unknown;
    cause?: unknown;
    kind?: unknown;
    originalCode?: unknown;
  };
  if (
    candidate.code === "P2034" ||
    candidate.code === "40001" ||
    candidate.code === "40P01" ||
    candidate.kind === "TransactionWriteConflict" ||
    candidate.originalCode === "40001" ||
    candidate.originalCode === "40P01"
  ) {
    return true;
  }

  return candidate.cause !== error && isWriteConflict(candidate.cause);
}

function retryDelay(attempt: number): Promise<void> {
  const milliseconds = Math.min(
    BASE_RETRY_DELAY_MS * 2 ** (attempt - 1),
    MAX_RETRY_DELAY_MS,
  );
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function retryPrismaWriteConflict<T>(
  operation: () => Promise<T>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): Promise<T> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("maxAttempts must be a positive integer");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isWriteConflict(error) || attempt === maxAttempts) throw error;
      await retryDelay(attempt);
    }
  }

  throw new Error("Transaction retry loop ended unexpectedly");
}

export function withSerializableTransaction<T>(
  database: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return retryPrismaWriteConflict(() =>
    database.$transaction(operation, { isolationLevel: "Serializable" }),
  );
}
