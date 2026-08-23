import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import { PlayerProvider } from "@/context/PlayerContext";
import { MarketProvider } from "@/context/MarketContext";
import "@/styles/styles.css";

import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      loginWith: { email: true },
    },
  },
  API: {
    Events: {
      endpoint: import.meta.env.VITE_APPSYNC_EVENTS_ENDPOINT,
      region: import.meta.env.VITE_AWS_REGION,
      defaultAuthMode: "apiKey",
      apiKey: import.meta.env.VITE_APPSYNC_API_KEY,
    },
  },
});

const rootElement = document.getElementById("root");
const queryClient = new QueryClient();

if (!rootElement) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <MarketProvider>
          <App />
        </MarketProvider>
      </PlayerProvider>
    </QueryClientProvider>
  </StrictMode>,
);
