import { z } from "zod";

const playerIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:@-]+$/);
export const playerResponseSchema = z.object({
  playerId: playerIdSchema,
  email: z.email(),
  username: z.string().min(2).max(32),
  score: z.number().int(),
  activeBetId: z.string().min(1).max(128).regex(/^[A-Za-z0-9-]+$/).optional(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Player = z.infer<typeof playerResponseSchema>;

export function isPlayerId(value: unknown): value is string {
  return playerIdSchema.safeParse(value).success;
}

import { authHeaders } from "@/api/auth";

function endpoint() {
  const value = import.meta.env.VITE_CREATE_PLAYER_URL;
  if (!value) throw new Error("The player endpoint is not configured.");
  return value.replace(/\/$/, "");
}

async function parsePlayer(response: Response): Promise<Player> {
  if (!response.ok) throw new Error(`Player request failed (${response.status}).`);
  return playerResponseSchema.parse(await response.json());
}

export async function getPlayer(signal?: AbortSignal): Promise<Player> {
  return parsePlayer(await fetch(`${endpoint()}/me`, { headers: await authHeaders(), signal }));
}

export async function ensurePlayer(): Promise<Player> {
  return parsePlayer(await fetch(endpoint(), {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: "{}",
  }));
}

export async function deletePlayer(): Promise<void> {
  const response = await fetch(`${endpoint()}/me`, { method: "DELETE", headers: await authHeaders() });
  if (!response.ok) throw new Error(`Account data could not be deleted (${response.status}).`);
}
