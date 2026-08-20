import { expect, test } from "vitest";
import { claimResolutionModal } from "@/pages/GamePage";

test("automatically presents a resolved bet only once across game-page mounts", () => {
  const presentedBetIds = new Set<string>();

  expect(claimResolutionModal("bet-1", presentedBetIds)).toBe(true);
  expect(claimResolutionModal("bet-1", presentedBetIds)).toBe(false);
  expect(claimResolutionModal("bet-2", presentedBetIds)).toBe(true);
});
