/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CREATE_BET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
