import { afterEach, expect, test, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { authHeaders } from "./auth";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

afterEach(() => vi.mocked(fetchAuthSession).mockReset());

test("creates a bearer header from the Cognito ID token", async () => {
  vi.mocked(fetchAuthSession).mockResolvedValue({
    tokens: { idToken: { toString: () => "id-token" } },
  } as never);
  await expect(authHeaders()).resolves.toEqual({ authorization: "Bearer id-token" });
  await expect(authHeaders(true)).resolves.toEqual({
    authorization: "Bearer id-token",
    "content-type": "application/json",
  });
});

test("rejects an expired or absent session", async () => {
  vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
  await expect(authHeaders()).rejects.toThrow("session has expired");
});
