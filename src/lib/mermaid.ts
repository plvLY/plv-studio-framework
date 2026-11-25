import { createMermaidRenderer } from 'mermaid-isomorphic';

type MermaidRenderer = ReturnType<typeof createMermaidRenderer>;

let renderer: MermaidRenderer | null = null;
const cache = new Map<string, Promise<string>>();

/**
 * 构建期把 Mermaid 源码渲染为内联 SVG。
 * 同一张图在一次构建内只渲染一次；失败直接中止构建。
 */
export function renderMermaidSvg(source: string, id: string): Promise<string> {
  const key = `${id}\n${source}`;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const promise = (async () => {
    renderer ??= createMermaidRenderer();

    const results = await renderer([source], {
      prefix: id,
      mermaidConfig: {
        theme: 'base',
        themeVariables: {
          background: '#ffffff',
          primaryColor: '#f5f5f5',
          primaryBorderColor: '#d4d4d4',
          primaryTextColor: '#171717',
          secondaryColor: '#fafafa',
          tertiaryColor: '#f0f0f0',
          lineColor: '#8a8a8a',
          textColor: '#171717',
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: '14px',
        },
      },
    });

    const result = results[0];

    if (result.status !== 'fulfilled') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      throw new Error(`Mermaid 渲染失败（${id}）：${reason}`);
    }

    return result.value.svg;
  })().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, promise);
  return promise;
}
