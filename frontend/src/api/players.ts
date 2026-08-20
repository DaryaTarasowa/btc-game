import { z } from "zod";

const playerIdSchema = z.uuid();
export const playerResponseSchema = z.object({
  playerId: playerIdSchema,
  score: z.number().int(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Player = z.infer<typeof playerResponseSchema>;

export function isPlayerId(value: unknown): value is string {
  return playerIdSchema.safeParse(value).success;
}

export async function getPlayer(playerId: string, signal?: AbortSignal): Promise<Player> {
  const endpoint = import.meta.env.VITE_CREATE_PLAYER_URL;
  if (!endpoint) throw new Error("The player endpoint is not configured.");
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/${playerId}`, { signal });
  if (!response.ok) throw new Error(`Player could not be loaded (${response.status}).`);
  return playerResponseSchema.parse(await response.json());
}

export async function createPlayer(): Promise<string> {
  const endpoint = import.meta.env.VITE_CREATE_PLAYER_URL;
  if (!endpoint) throw new Error("The player endpoint is not configured.");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error(`Login failed (${response.status}).`);

  try {
    return playerResponseSchema.parse(await response.json()).playerId;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error("The server returned an invalid player ID.", { cause: error });
    }
    throw error;
  }
}
