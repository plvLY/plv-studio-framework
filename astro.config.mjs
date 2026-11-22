// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

/** 站点绝对地址，用于 canonical / sitemap 等场景；生产由 SITE_URL 注入。 */
const site = process.env.SITE_URL ?? 'https://plv.pages.dev';

/**
 * 从 DATA_BASE 解析数据站点主机，供构建期远程图片优化使用。
 * 缺失或非法时不阻断配置加载，由数据访问层统一报错。
 *
 * @returns {Array<{ protocol: string, hostname: string, pathname: string, port?: string }>}
 */
function resolveRemotePatterns() {
  const raw = process.env.DATA_BASE;
  if (!raw) {
    return [];
  }

  try {
    const url = new URL(raw);
    /** @type {{ protocol: string, hostname: string, pathname: string, port?: string }} */
    const pattern = {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      pathname: '/**',
    };

    if (url.port) {
      pattern.port = url.port;
    }

    return [pattern];
  } catch {
    return [];
  }
}

export default defineConfig({
  // 纯静态输出：全部页面构建期预渲染，不使用 SSR adapter。
  output: 'static',
  // 全站统一尾斜杠，与站内链接和 canonical 保持一致。
  trailingSlash: 'always',
  site,
  image: {
    remotePatterns: resolveRemotePatterns(),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
