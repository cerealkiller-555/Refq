/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** معرّف عميل OAuth لـ Google Calendar (قراءة فقط) — فارغ = المزامنة معطّلة */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}