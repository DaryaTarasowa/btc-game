import { z } from "zod";
import { isPlayerId } from "./players";
import type { MarketPrice } from "./prices";
import { authHeaders } from "./auth";

export type BetDirection = "up" | "down";

export const activeBetSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().refine(isPlayerId),
  recordKey: z.literal("ACTIVE"),
  direction: z.enum(["up", "down"]),
  status: z.literal("active"),
  startPrice: z.string(),
  startEventTimestamp: z.iso.datetime({ offset: true }),
  resolutionTargetTimestamp: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
});

export type ActiveBet = z.infer<typeof activeBetSchema>;

export interface CreateBetInput {
  direction: BetDirection;
  point: MarketPrice;
}

export async function createBet({ direction, point }: CreateBetInput): Promise<ActiveBet> {
  const endpoint = import.meta.env.VITE_CREATE_BET_URL;
  if (!endpoint) throw new Error("The bet endpoint is not configured.");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify({
      direction,
      startPrice: point.price,
      startEventTimestamp: point.eventTimestamp,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: unknown } | null;
    const message = typeof body?.message === "string" ? body.message : `Bet creation failed (${response.status}).`;
    throw new Error(message);
  }

  return activeBetSchema.parse(await response.json());
}
