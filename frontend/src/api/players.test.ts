import { afterEach, expect, test, vi } from "vitest";
import { deletePlayer, ensurePlayer, getPlayer, isPlayerId } from "@/api/players";

vi.mock("@/api/auth", () => ({ authHeaders: vi.fn(async (json: boolean) => json ? { authorization: "Bearer token", "content-type": "application/json" } : { authorization: "Bearer token" }) }));

const player = {
  playerId: "subject-1",
  email: "player@example.test",
  username: "Player",
  score: 0,
  createdAt: "2026-08-20T12:00:00.000Z",
};

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("accepts a Cognito subject that is UUID-shaped but not an RFC UUID", () => {
  expect(isPlayerId("00000000-0000-0000-0000-000000000000")).toBe(true);
});

test("rejects unsafe player identity characters", () => {
  expect(isPlayerId("player/id?admin=true")).toBe(false);
});

test("loads and creates the authenticated player", async () => {
  vi.stubEnv("VITE_CREATE_PLAYER_URL", "https://example.test/players/");
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => player });
  vi.stubGlobal("fetch", fetchMock);

  await expect(getPlayer()).resolves.toEqual(player);
  await expect(ensurePlayer()).resolves.toEqual(player);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "https://example.test/players/me",
    "https://example.test/players",
  ]);
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", body: "{}" });
});

test("deletes account data with an authenticated request", async () => {
  vi.stubEnv("VITE_CREATE_PLAYER_URL", "https://example.test/players");
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  await deletePlayer();
  expect(fetchMock).toHaveBeenCalledWith("https://example.test/players/me", expect.objectContaining({ method: "DELETE" }));
});

test("reports missing configuration and HTTP failures", async () => {
  vi.stubEnv("VITE_CREATE_PLAYER_URL", "");
  await expect(getPlayer()).rejects.toThrow("endpoint is not configured");
  vi.stubEnv("VITE_CREATE_PLAYER_URL", "https://example.test/players");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(getPlayer()).rejects.toThrow("Player request failed (503)");
  await expect(deletePlayer()).rejects.toThrow("could not be deleted (503)");
});

test("rejects malformed player data from the backend", async () => {
  vi.stubEnv("VITE_CREATE_PLAYER_URL", "https://example.test/players");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...player, score: 1.5 }) }));
  await expect(getPlayer()).rejects.toThrow();
});
