/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HAS_LOGO?: string;
  readonly VITE_LOGO_WIDTH?: string;
  readonly VITE_LOGO_HEIGHT?: string;
  readonly VITE_HAS_FOUNDER_PHOTO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
