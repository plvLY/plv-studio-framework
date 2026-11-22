import { z } from 'zod';
import {
  dateSchema,
  docIdSchema,
  imagePathSchema,
  linkSchema,
  nonEmptyString,
  nullableDateSchema,
  projectStatusSchema,
  schemaVersionSchema,
  slugSchema,
  visibilitySchema,
} from './common';

export const worksIndexSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    slugs: z.array(slugSchema),
  })
  .refine((index) => new Set(index.slugs).size === index.slugs.length, {
    message: '作品 slug 不能重复',
    path: ['slugs'],
  });

const starSchema = z.strictObject({
  problem: nonEmptyString,
  solution: nonEmptyString,
  value: nonEmptyString,
});

const overviewSchema = z.strictObject({
  background: nonEmptyString,
  goals: z.array(nonEmptyString).min(1, '至少 1 个目标'),
  acceptance: z.array(nonEmptyString).min(1, '至少 1 条验收标准'),
});

const decisionSchema = z.strictObject({
  title: nonEmptyString,
  choice: nonEmptyString,
  reason: nonEmptyString,
});

const mermaidDiagramSchema = z.strictObject({
  kind: z.literal('mermaid'),
  source: nonEmptyString,
});

const imageDiagramSchema = z.strictObject({
  kind: z.literal('image'),
  src: imagePathSchema,
  alt: nonEmptyString,
});

export const diagramSchema = z.discriminatedUnion('kind', [
  mermaidDiagramSchema,
  imageDiagramSchema,
]);

const architectureSchema = z.strictObject({
  summary: nonEmptyString,
  diagram: diagramSchema,
  decisions: z.array(decisionSchema).default([]),
});

export const documentMetaSchema = z.strictObject({
  id: docIdSchema,
  title: nonEmptyString,
  stage: z.number().int().min(1).max(8),
  order: z.number().int().min(1),
  date: dateSchema,
  summary: z.string().optional(),
  file: z
    .string()
    .regex(
      /^\/documents\/[a-z0-9-]+\/[a-z0-9-]+\.md$/,
      '文档路径格式应为 /documents/{slug}/{doc-id}.md',
    ),
  visibility: visibilitySchema,
});

export const workSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    slug: slugSchema,
    title: nonEmptyString,
    subtitle: z.string().optional(),
    summary: nonEmptyString,
    status: projectStatusSchema,
    category: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '分类只能使用小写字母、数字和连字符'),
    tags: z.array(nonEmptyString).default([]),
    cover: imagePathSchema,
    coverAlt: nonEmptyString,
    techStack: z.array(nonEmptyString).min(1, '至少 1 项技术'),
    owner: nonEmptyString,
    maintainer: nonEmptyString,
    startDate: dateSchema,
    releaseDate: nullableDateSchema,
    updatedAt: dateSchema,
    star: starSchema,
    overview: overviewSchema,
    architecture: architectureSchema,
    links: z.array(linkSchema).default([]),
    documents: z.array(documentMetaSchema).default([]),
  })
  .superRefine((work, ctx) => {
    if (work.updatedAt < work.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'updatedAt 不能早于 startDate',
      });
    }

    if (work.releaseDate && work.releaseDate < work.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['releaseDate'],
        message: 'releaseDate 不能早于 startDate',
      });
    }

    const ids = new Set<string>();
    const orders = new Set<number>();

    work.documents.forEach((document, index) => {
      if (ids.has(document.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['documents', index, 'id'],
          message: `文档 id 重复：${document.id}`,
        });
      }
      ids.add(document.id);

      if (orders.has(document.order)) {
        ctx.addIssue({
          code: 'custom',
          path: ['documents', index, 'order'],
          message: `文档 order 重复：${document.order}`,
        });
      }
      orders.add(document.order);

      if (!document.file.startsWith(`/documents/${work.slug}/`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['documents', index, 'file'],
          message: '文档路径必须位于当前作品的 documents 目录下',
        });
      }
    });
  });

export type WorksIndex = z.infer<typeof worksIndexSchema>;
export type Work = z.infer<typeof workSchema>;
export type Diagram = z.infer<typeof diagramSchema>;
export type DocumentMeta = z.infer<typeof documentMetaSchema>;
