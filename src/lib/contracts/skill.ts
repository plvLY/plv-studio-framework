import { z } from 'zod';
import {
  SKILL_TAB_KEYS,
  evidenceTypeSchema,
  httpsUrlSchema,
  nonEmptyString,
  schemaVersionSchema,
  skillTabKeySchema,
} from './common';

const evidenceSchema = z.strictObject({
  type: evidenceTypeSchema,
  label: nonEmptyString,
  url: httpsUrlSchema,
});

const skillItemSchema = z.strictObject({
  name: nonEmptyString,
  summary: nonEmptyString,
  evidence: z.array(evidenceSchema).min(1, '每个能力至少 1 条证据'),
});

export const skillTabSchema = z.strictObject({
  key: skillTabKeySchema,
  label: nonEmptyString,
  description: nonEmptyString.optional(),
  items: z.array(skillItemSchema).min(1, '每个标签页至少 1 个能力项'),
});

export const skillsSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    tabs: z.array(skillTabSchema).length(4, '必须包含 4 个标签页'),
  })
  .superRefine((skills, ctx) => {
    const keys = skills.tabs.map((tab) => tab.key);

    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['tabs'],
        message: '标签页 key 不能重复',
      });
    }

    SKILL_TAB_KEYS.forEach((key) => {
      if (!keys.includes(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tabs'],
          message: `缺少标签页：${key}`,
        });
      }
    });
  });

export type Skills = z.infer<typeof skillsSchema>;
export type SkillTab = z.infer<typeof skillTabSchema>;
export type SkillItem = z.infer<typeof skillItemSchema>;
