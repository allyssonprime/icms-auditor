/// <reference types="vite/client" />

declare const __BUILD_TIMESTAMP__: string;

declare module 'virtual:git-hash' {
  export const commitHash: string;
}

interface ImportMetaEnv {
  readonly VITE_GESCOMEX_API_HOST: string;
  readonly VITE_GESCOMEX_API_KEY: string;
  readonly VITE_GESCOMEX_API_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
