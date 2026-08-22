import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { GameWorkspaceLayout } from "@/components/GameWorkspaceLayout";
import { HistoryView } from "@/components/HistoryView/HistoryView";
import { ActiveBetChart } from "@/components/MarketView/ActiveBetChart";
import { MarketView } from "./components/MarketView/MarketView";

const rootRoute = createRootRoute({ component: AppLayout });
const gameWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "game-workspace",
  component: GameWorkspaceLayout,
});
const marketRoute = createRoute({
  getParentRoute: () => gameWorkspaceRoute,
  path: "/",
  component: MarketView,
});
const historyRoute = createRoute({
  getParentRoute: () => gameWorkspaceRoute,
  path: "/history",
  component: HistoryView,
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
