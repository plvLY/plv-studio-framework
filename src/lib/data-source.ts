import matter from 'gray-matter';
import type { z } from 'zod';
import {
  DataContractError,
  documentFrontmatterSchema,
  parseContract,
  profileSchema,
  progressSchema,
  skillsSchema,
  validateBundle,
  validateDocumentIndex,
  workSchema,
  worksIndexSchema,
  type DocumentFrontmatter,
  type DocumentMeta,
  type Profile,
  type Progress,
  type Skills,
  type Work,
  type WorksIndex,
} from './contracts';

/** 单请求超时时间（毫秒）。 */
const FETCH_TIMEOUT_MS = 10_000;
/** 重试间隔：失败后共重试 2 次。 */
const RETRY_DELAYS_MS = [500, 1500] as const;
/** 构建期同时进行的最大请求数。 */
const MAX_CONCURRENCY = 6;

/** 标记可选资源不存在（404），与解析后的数据区分。 */
const MISSING = Symbol('missing');
type Missing = typeof MISSING;

/** 数据加载层错误：与 DataContractError 一样携带文件、字段路径与规则编号。 */
export class DataSourceError extends Error {
  readonly file: string;
  readonly fieldPath: string;
  readonly rule: string;

  constructor(file: string, fieldPath: string, rule: string, message: string) {
    super(message);
    this.name = 'DataSourceError';
    this.file = file;
    this.fieldPath = fieldPath;
    this.rule = rule;
  }
}

export interface LoadedDocument {
  meta: DocumentMeta;
  frontmatter: DocumentFrontmatter;
  body: string;
}

export interface SiteData {
  profile: Profile;
  index: WorksIndex;
  works: Record<string, Work>;
  progress: Progress;
  skills: Skills | null;
  /** 每个作品的公开文档，按 order 升序。 */
  documents: Record<string, LoadedDocument[]>;
  /** 不阻断构建的契约告警（V-14 ~ V-17）。 */
  warnings: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

let resolvedBase: string | null = null;

/** 读取并校验 DATA_BASE；缺失或非法时直接抛错，禁止回退到默认线上地址。 */
function resolveDataBase(): string {
  if (resolvedBase) {
    return resolvedBase;
  }

  const raw = process.env.DATA_BASE?.trim();

  if (!raw) {
    throw new DataSourceError(
      '(env)',
      'DATA_BASE',
      'ENV-01',
      'DATA_BASE 未设置：构建或校验前必须指定数据站点基址，例如 DATA_BASE=http://localhost:4321。',
    );
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new DataSourceError('(env)', 'DATA_BASE', 'ENV-01', `DATA_BASE 不是合法地址：${raw}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new DataSourceError(
      '(env)',
      'DATA_BASE',
      'ENV-01',
      `DATA_BASE 只支持 http / https，实际为：${url.protocol}`,
    );
  }

  resolvedBase = raw.replace(/\/+$/, '');
  return resolvedBase;
}

let activeRequests = 0;
const waitingRequests: Array<() => void> = [];

/** 全局请求并发控制，上限 MAX_CONCURRENCY。 */
async function withRequestSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeRequests < MAX_CONCURRENCY) {
    activeRequests += 1;
  } else {
    await new Promise<void>((resolve) => waitingRequests.push(resolve));
  }

  try {
    return await task();
  } finally {
    activeRequests -= 1;
    const next = waitingRequests.shift();

    if (next) {
      activeRequests += 1;
      next();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 带 10s 超时与 2 次重试的 fetch；4xx（429 除外）不重试，原样返回。 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }

    const delay = RETRY_DELAYS_MS[attempt];

    if (delay !== undefined) {
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${resolveDataBase()}${path}`;
  return withRequestSlot(() => fetchWithRetry(url, init));
}

const jsonCache = new Map<string, Promise<unknown | Missing>>();
const textCache = new Map<string, Promise<string | Missing>>();
const headCache = new Map<string, Promise<void>>();

function fetchJsonRaw(path: string): Promise<unknown | Missing> {
  const cached = jsonCache.get(path);

  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const response = await request(path);

    if (response.status === 404) {
      await response.body?.cancel();
      return MISSING;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new DataSourceError(path, '(root)', 'V-01', `${path} 请求失败：HTTP ${response.status}`);
    }

    try {
      return (await response.json()) as unknown;
    } catch (error) {
      throw new DataSourceError(path, '(root)', 'V-01', `${path} 不是合法 JSON：${errorMessage(error)}`);
    }
  })();

  jsonCache.set(path, promise);
  return promise;
}

async function loadJson<T>(path: string, schema: z.ZodType<T>, rule = 'V-02'): Promise<T> {
  const raw = await fetchJsonRaw(path);

  if (raw === MISSING) {
    throw new DataSourceError(path, '(root)', 'V-01', `${path} 不存在（404）`);
  }

  return parseContract(schema, raw, path, rule);
}

async function loadOptionalJson<T>(path: string, schema: z.ZodType<T>, rule = 'V-02'): Promise<T | null> {
  const raw = await fetchJsonRaw(path);

  if (raw === MISSING) {
    return null;
  }

  return parseContract(schema, raw, path, rule);
}

function fetchTextRaw(path: string): Promise<string | Missing> {
  const cached = textCache.get(path);

  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const response = await request(path);

    if (response.status === 404) {
      await response.body?.cancel();
      return MISSING;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new DataSourceError(path, '(root)', 'V-10', `${path} 请求失败：HTTP ${response.status}`);
    }

    return response.text();
  })();

  textCache.set(path, promise);
  return promise;
}

function parseFrontmatter(raw: string, file: string): { data: unknown; content: string } {
  try {
    const parsed = matter(raw);
    return { data: parsed.data, content: parsed.content };
  } catch (error) {
    throw new DataSourceError(
      file,
      '(frontmatter)',
      'V-02',
      `${file} frontmatter 解析失败：${errorMessage(error)}`,
    );
  }
}

async function loadDocument(meta: DocumentMeta): Promise<LoadedDocument> {
  const raw = await fetchTextRaw(meta.file);

  if (raw === MISSING) {
    throw new DataSourceError(meta.file, 'file', 'V-10', `${meta.file} 不存在（404）`);
  }

  const { data, content } = parseFrontmatter(raw, meta.file);
  const frontmatter = parseContract(documentFrontmatterSchema, data, meta.file, 'V-02');

  return { meta, frontmatter, body: content };
}

/** 对图片路径发起 HEAD 校验，404 即报错（V-11）。 */
async function checkImage(path: string, file: string, fieldPath: string): Promise<void> {
  const cached = headCache.get(path);

  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const response = await request(path, { method: 'HEAD' });

    if (!response.ok) {
      await response.body?.cancel();
      throw new DataSourceError(
        file,
        fieldPath,
        'V-11',
        `${file} 引用的图片 ${path} 不存在或不可访问（HTTP ${response.status}）`,
      );
    }

    await response.body?.cancel();
  })();

  headCache.set(path, promise);
  return promise;
}

async function loadSiteDataInternal(): Promise<SiteData> {
  resolveDataBase();

  const [profile, index, progress, skills] = await Promise.all([
    loadJson('/profile.json', profileSchema),
    loadJson('/works/index.json', worksIndexSchema),
    loadJson('/progress.json', progressSchema),
    loadOptionalJson('/skills.json', skillsSchema),
  ]);

  const works: Record<string, Work> = {};

  await Promise.all(
    index.slugs.map(async (slug) => {
      works[slug] = await loadJson(`/works/${slug}.json`, workSchema);
    }),
  );

  const warnings = validateBundle({ profile, index, works, progress });
  const documents: Record<string, LoadedDocument[]> = {};

  await Promise.all(
    index.slugs.map(async (slug) => {
      const work = works[slug];

      if (!work) {
        return;
      }

      // private 文档不请求正文，也不参与索引与路由。
      const visible = work.documents
        .filter((meta) => meta.visibility === 'public')
        .sort((left, right) => left.order - right.order);

      const loaded = await Promise.all(visible.map((meta) => loadDocument(meta)));
      const frontmatters: Record<string, DocumentFrontmatter> = {};

      loaded.forEach((document) => {
        frontmatters[document.meta.id] = document.frontmatter;
      });

      validateDocumentIndex({ ...work, documents: visible }, frontmatters, (docId) => {
        const meta = visible.find((item) => item.id === docId);
        return meta?.file ?? `documents/${slug}/${docId}.md`;
      });

      documents[slug] = loaded;
    }),
  );

  const imageChecks: Array<Promise<void>> = [
    checkImage(profile.seo.ogImage, 'profile.json', 'seo.ogImage'),
  ];

  if (profile.author.avatar) {
    imageChecks.push(checkImage(profile.author.avatar, 'profile.json', 'author.avatar'));
  }

  index.slugs.forEach((slug) => {
    const work = works[slug];

    if (!work) {
      return;
    }

    imageChecks.push(checkImage(work.cover, `works/${slug}.json`, 'cover'));

    if (work.architecture.diagram.kind === 'image') {
      imageChecks.push(
        checkImage(work.architecture.diagram.src, `works/${slug}.json`, 'architecture.diagram.src'),
      );
    }
  });

  await Promise.all(imageChecks);

  return { profile, index, works, progress, skills, documents, warnings };
}

let siteDataPromise: Promise<SiteData> | null = null;

/**
 * 加载并校验整站数据，构建期模块级缓存。
 * 同一次构建内重复调用只拉取一次；失败后清空缓存以便下一次重新尝试。
 */
export function loadSiteData(): Promise<SiteData> {
  if (!siteDataPromise) {
    siteDataPromise = loadSiteDataInternal().catch((error: unknown) => {
      siteDataPromise = null;
      throw error;
    });
  }

  return siteDataPromise;
}

export async function getProfile(): Promise<Profile> {
  return (await loadSiteData()).profile;
}

/** 把数据仓库内的相对路径转换为可访问的绝对地址；已是 http(s) 的原样返回。 */
export function getDataUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${resolveDataBase()}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function getWorkSlugs(): Promise<string[]> {
  return (await loadSiteData()).index.slugs;
}

export async function getWork(slug: string): Promise<Work> {
  const data = await loadSiteData();
  const work = data.works[slug];

  if (!work) {
    throw new DataSourceError(
      'works/index.json',
      'slugs',
      'V-04',
      `作品 ${slug} 未在 works/index.json 中登记`,
    );
  }

  return work;
}

export async function getProgress(): Promise<Progress> {
  return (await loadSiteData()).progress;
}

export async function getSkills(): Promise<Skills | null> {
  return (await loadSiteData()).skills;
}

/** 返回指定作品的公开文档索引（已按 order 升序）。 */
export async function getDocumentIndex(slug: string): Promise<DocumentMeta[]> {
  const data = await loadSiteData();
  const documents = data.documents[slug];

  if (!documents) {
    throw new DataSourceError(`works/${slug}.json`, 'slug', 'V-04', `作品 ${slug} 不存在`);
  }

  return documents.map((document) => document.meta);
}

/** 返回公开文档的元信息、frontmatter 与 Markdown 正文。 */
export async function getDocument(slug: string, docId: string): Promise<LoadedDocument> {
  const data = await loadSiteData();
  const document = data.documents[slug]?.find((item) => item.meta.id === docId);

  if (!document) {
    throw new DataSourceError(
      `documents/${slug}/${docId}.md`,
      'id',
      'V-10',
      `文档 ${slug}/${docId} 不存在或不是公开文档`,
    );
  }

  return document;
}

/** 统一格式化数据加载错误，供构建日志与 validate:data 使用。 */
export function formatDataError(error: unknown): string {
  if (error instanceof DataContractError || error instanceof DataSourceError) {
    return [
      '数据校验失败',
      `  文件：${error.file}`,
      `  字段：${error.fieldPath}`,
      `  规则：${error.rule}`,
      `  原因：${error.message}`,
    ].join('\n');
  }

  return `数据校验失败\n  原因：${errorMessage(error)}`;
}
