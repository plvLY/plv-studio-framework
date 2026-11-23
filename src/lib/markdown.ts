import {
  createMarkdownProcessor,
  rehypeHeadingIds,
  type MarkdownHeading,
  type RehypePlugins,
} from '@astrojs/markdown-remark';
import rehypeMermaid from 'rehype-mermaid';
import { getDataUrl } from './data-source';

const rehypePlugins: RehypePlugins = [
  rehypeHeadingIds,
  [
    rehypeMermaid,
    {
      strategy: 'inline-svg',
      mermaidConfig: {
        theme: 'base',
        themeVariables: {
          background: '#ffffff',
          primaryColor: '#eff6ff',
          primaryBorderColor: '#2563eb',
          primaryTextColor: '#111827',
          secondaryColor: '#f8fafc',
          tertiaryColor: '#f1f5f9',
          lineColor: '#64748b',
          textColor: '#111827',
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: '14px',
        },
      },
    },
  ],
];

const markdownOptions = {
  rehypePlugins,
  syntaxHighlight: {
    type: 'shiki' as const,
    excludeLangs: ['mermaid'],
  },
  shikiConfig: {
    theme: 'github-dark' as const,
  },
};

let processorPromise: ReturnType<typeof createMarkdownProcessor> | null = null;

function getProcessor(): ReturnType<typeof createMarkdownProcessor> {
  if (!processorPromise) {
    processorPromise = createMarkdownProcessor(markdownOptions);
  }

  return processorPromise;
}

export interface RenderedMarkdown {
  html: string;
  headings: MarkdownHeading[];
}

const IMAGE_SRC_RE = /(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/g;

function resolveImageUrl(src: string, slug: string): string {
  if (/^https?:\/\//.test(src) || src.startsWith('data:') || src.startsWith('/')) {
    return src.startsWith('/images/') ? getDataUrl(src) : src;
  }

  const normalized = src.replace(/^\.\//, '');
  return getDataUrl(`/images/works/${slug}/${normalized}`);
}

/** 远程 Markdown 正文：Shiki 高亮、标题 id、Mermaid 内联 SVG、图片绝对地址。 */
export async function renderMarkdown(
  body: string,
  frontmatter: Record<string, unknown>,
  slug: string,
): Promise<RenderedMarkdown> {
  const processor = await getProcessor();

  const rendered = await processor.render(body, { frontmatter }).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Markdown 渲染失败（${slug}）：${reason}`);
  });

  const html = rendered.code.replace(
    IMAGE_SRC_RE,
    (_match, prefix: string, src: string, suffix: string) =>
      `${prefix}${resolveImageUrl(src, slug)}${suffix}`,
  );

  return {
    html,
    headings: rendered.metadata.headings,
  };
}
