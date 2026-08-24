import type { z } from "zod";
import type { authExchangeBodySchema, devAuthBodySchema } from "../../shared/schemas/auth.schema.js";

export type AuthExchangeBody = z.infer<typeof authExchangeBodySchema>;
export type DevAuthBody = z.infer<typeof devAuthBodySchema>;
