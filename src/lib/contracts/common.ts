import { z } from 'zod';

/** 当前契约版本；框架仅接受 1.x。 */
export const SCHEMA_VERSION = '1.0';

export const schemaVersionSchema = z
  .string()
  .regex(/^1\.\d+$/, '仅支持 1.x 契约版本');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .min(2, 'slug 至少 2 个字符')
  .max(32, 'slug 最多 32 个字符')
  .regex(SLUG_PATTERN, 'slug 只能使用小写字母、数字和连字符');

export const docIdSchema = z
  .string()
  .min(1, '文档 id 不能为空')
  .max(64, '文档 id 最多 64 个字符')
  .regex(SLUG_PATTERN, '文档 id 只能使用小写字母、数字和连字符');

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, '日期无效');

export const nullableDateSchema = dateSchema.nullable();

export const datetimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), '时间无效')
  .refine((value) => /(?:Z|[+-]\d{2}:\d{2})$/.test(value), '时间需包含时区');

export const nonEmptyString = z.string().min(1, '不能为空');

export const httpsUrlSchema = z.string().refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, '链接必须是合法的 https 地址');

export const socialUrlSchema = z.string().refine((value) => {
  if (value.startsWith('mailto:')) {
    return true;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, '链接必须使用 https 或 mailto');

export const imagePathSchema = z
  .string()
  .regex(/^\/images\/.+/, '图片路径需以 /images/ 开头');

export const projectStatusSchema = z.enum([
  'released',
  'in-development',
  'planned',
  'archived',
]);

export const progressStatusSchema = z.enum([
  'planned',
  'in-progress',
  'completed',
  'archived',
]);

export const stageStatusSchema = z.enum(['planned', 'in-progress', 'completed']);

export const STAGE_KEYS = [
  'planning',
  'requirements',
  'design',
  'architecture',
  'development',
  'testing',
  'deployment',
  'operations',
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export const stageKeySchema = z.enum(STAGE_KEYS);

export const STAGES: ReadonlyArray<{ stage: number; key: StageKey; name: string }> = [
  { stage: 1, key: 'planning', name: '产品规划' },
  { stage: 2, key: 'requirements', name: '需求分析' },
  { stage: 3, key: 'design', name: '产品设计' },
  { stage: 4, key: 'architecture', name: '系统架构与技术设计' },
  { stage: 5, key: 'development', name: '开发实施' },
  { stage: 6, key: 'testing', name: '测试与质量保障' },
  { stage: 7, key: 'deployment', name: '部署与发布' },
  { stage: 8, key: 'operations', name: '运行与持续迭代' },
];

export function stageNameOf(key: StageKey): string {
  return STAGES.find((stage) => stage.key === key)?.name ?? key;
}

export const linkTypeSchema = z.enum(['live', 'repo', 'doc', 'design', 'download']);

export const linkSchema = z.strictObject({
  type: linkTypeSchema,
  label: nonEmptyString,
  url: httpsUrlSchema,
});

/** 阶段内的链接只要求 label + https 地址。 */
export const stageLinkSchema = z.strictObject({
  label: nonEmptyString,
  url: httpsUrlSchema,
});

export const visibilitySchema = z.enum(['public', 'private']);

export const themeModeSchema = z.enum(['light', 'dark', 'system']);

export const evidenceTypeSchema = z.enum(['case', 'doc', 'repo', 'release']);

export const SKILL_TAB_KEYS = ['backend', 'frontend', 'ai', 'engineering'] as const;

export type SkillTabKey = (typeof SKILL_TAB_KEYS)[number];

export const skillTabKeySchema = z.enum(SKILL_TAB_KEYS);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type StageStatus = z.infer<typeof stageStatusSchema>;
export type LinkType = z.infer<typeof linkTypeSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
