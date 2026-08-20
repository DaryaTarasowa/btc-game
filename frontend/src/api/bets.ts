import { z } from "zod";
import { isPlayerId } from "@/api/players";
import type { MarketPrice } from "@/api/prices";
import { authHeaders } from "@/api/auth";
import { BetDirection, BetResult, BetStatus } from "@/domain/bets";

export const activeBetSchema = z.object({
  betId: z.string().min(1),
  playerId: z.string().refine(isPlayerId),
  product: z.string().min(1),
  direction: z.enum(BetDirection),
  status: z.literal(BetStatus.Active),
  startPrice: z.string(),
  startEventTimestamp: z.iso.datetime({ offset: true }),
  resolutionTargetTimestamp: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
});
export type ActiveBet = z.infer<typeof activeBetSchema>;

export const resolvedBetSchema = activeBetSchema.omit({ status: true }).extend({
  status: z.literal(BetStatus.Resolved),
  result: z.enum(BetResult),
  endPrice: z.string(),
  endEventTimestamp: z.iso.datetime({ offset: true }),
});
export type ResolvedBet = z.infer<typeof resolvedBetSchema>;

export const betSchema = z.discriminatedUnion("status", [
  activeBetSchema,
  resolvedBetSchema,
]);
export type Bet = z.infer<typeof betSchema>;

const completedBetsSchema = z.object({ bets: z.array(resolvedBetSchema) });

export const PRICE_HISTORY_RETENTION_MS = 10 * 60 * 60 * 1_000;
export const BET_CHART_PADDING_MS = 5_000;

export interface CreateBetInput {
  direction: BetDirection;
  point: MarketPrice;
}

export async function createBet({
  direction,
  point,
}: CreateBetInput): Promise<ActiveBet> {
  const endpoint = import.meta.env.VITE_CREATE_BET_URL;
  if (!endpoint) throw new Error("The bet endpoint is not configured.");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify({
      direction,
      product: point.product,
      startPrice: point.price,
      startEventTimestamp: point.eventTimestamp,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const message =
      typeof body?.message === "string"
        ? body.message
        : `Bet creation failed (${response.status}).`;
    throw new Error(message);
  }

  return activeBetSchema.parse(await response.json());
}

export class BetNotFoundError extends Error {}

export async function getBet(
  betId: string,
  signal?: AbortSignal,
): Promise<Bet> {
  const endpoint = import.meta.env.VITE_CREATE_BET_URL;
  if (!endpoint) throw new Error("The bet endpoint is not configured.");
  const response = await fetch(
    `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(betId)}`,
    {
      headers: await authHeaders(),
      signal,
    },
  );
  if (response.status === 404 || response.status === 403)
    throw new BetNotFoundError("Bet is not accessible.");
  if (!response.ok)
    throw new Error(`Bet status could not be loaded (${response.status}).`);
  return betSchema.parse(await response.json());
}

export async function getCompletedBets(
  signal?: AbortSignal,
): Promise<ResolvedBet[]> {
  const endpoint = import.meta.env.VITE_CREATE_BET_URL;
  if (!endpoint) throw new Error("The bet endpoint is not configured.");
  const response = await fetch(endpoint.replace(/\/$/, ""), {
    headers: await authHeaders(),
    signal,
  });
  if (!response.ok)
    throw new Error(`Bet history could not be loaded (${response.status}).`);
  return completedBetsSchema.parse(await response.json()).bets;
}

export function canReconstructBet(bet: ResolvedBet, now = Date.now()): boolean {
  const startTime = Date.parse(bet.startEventTimestamp);
  return (
    Number.isFinite(startTime) &&
    startTime - BET_CHART_PADDING_MS + PRICE_HISTORY_RETENTION_MS > now
  );
}

export function betChartWindow(bet: ResolvedBet): {
  start: string;
  end: string;
} {
  return {
    start: new Date(
      Date.parse(bet.startEventTimestamp) - BET_CHART_PADDING_MS,
    ).toISOString(),
    end: new Date(
      Date.parse(bet.endEventTimestamp) + BET_CHART_PADDING_MS,
    ).toISOString(),
  };
}

export function reconstructableBetHistory(
  bets: ResolvedBet[],
  now = Date.now(),
): { bets: ResolvedBet[]; olderCount: number } {
  const reconstructable = bets.filter((bet) => canReconstructBet(bet, now));
  return {
    bets: reconstructable,
    olderCount: bets.length - reconstructable.length,
  };
}
