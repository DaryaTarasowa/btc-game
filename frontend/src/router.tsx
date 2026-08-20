import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { GamePage } from "@/pages/GamePage";
import { HistoryPage } from "@/pages/HistoryPage";

const rootRoute = createRootRoute({ component: AppLayout });
const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: GamePage,
});
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});
const routeTree = rootRoute.addChildren([gameRoute, historyRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
