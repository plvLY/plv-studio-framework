/// <reference types="astro/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** 数据站点基址，例如 https://plv-data.pages.dev 或 http://localhost:4321 */
    readonly DATA_BASE?: string;
    /** 站点绝对地址，例如 https://plv.pages.dev */
    readonly SITE_URL?: string;
  }
}
