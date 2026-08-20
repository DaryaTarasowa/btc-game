import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { GameWorkspaceLayout } from "@/components/GameWorkspaceLayout";
import { HistoryPanel } from "@/components/HistoryPanel/HistoryPanel";
import { MarketPanel } from "@/components/MarketPanel/MarketPanel";

const rootRoute = createRootRoute({ component: AppLayout });
const gameWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "game-workspace",
  component: GameWorkspaceLayout,
});
const marketRoute = createRoute({
  getParentRoute: () => gameWorkspaceRoute,
  path: "/",
  component: MarketPanel,
});
const historyRoute = createRoute({
  getParentRoute: () => gameWorkspaceRoute,
  path: "/history",
  component: HistoryPanel,
});
const routeTree = rootRoute.addChildren([
  gameWorkspaceRoute.addChildren([marketRoute, historyRoute]),
]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
