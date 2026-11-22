import { z } from 'zod';
import {
  dateSchema,
  docIdSchema,
  nonEmptyString,
  slugSchema,
  visibilitySchema,
} from './common';

export const documentFrontmatterSchema = z.strictObject({
  id: docIdSchema,
  title: nonEmptyString,
  project: slugSchema,
  stage: z.number().int().min(1).max(8),
  order: z.number().int().min(1),
  date: dateSchema,
  summary: z.string().optional(),
  visibility: visibilitySchema,
});

export type DocumentFrontmatter = z.infer<typeof documentFrontmatterSchema>;
