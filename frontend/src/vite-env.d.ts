/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CREATE_BET_URL?: string;
  readonly VITE_CREATE_PLAYER_URL?: string;
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_USER_POOL_CLIENT_ID: string;
  readonly VITE_MARKET_PRODUCTS: string;
  readonly VITE_DEFAULT_MARKET_PRODUCT: string;
  readonly VITE_APPSYNC_EVENTS_CHANNEL_PREFIX: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
