import { z } from 'zod';
import {
  STAGE_KEYS,
  dateSchema,
  datetimeSchema,
  nonEmptyString,
  nullableDateSchema,
  progressStatusSchema,
  schemaVersionSchema,
  slugSchema,
  stageKeySchema,
  stageLinkSchema,
  stageStatusSchema,
} from './common';

const changelogSchema = z.strictObject({
  date: dateSchema,
  note: nonEmptyString,
  version: z.string().min(1).optional(),
});

export const stageProgressSchema = z.strictObject({
  stage: z.number().int().min(1).max(8),
  key: stageKeySchema,
  status: stageStatusSchema,
  startedAt: nullableDateSchema,
  completedAt: nullableDateSchema,
  summary: z.string(),
  links: z.array(stageLinkSchema).default([]),
  changelog: z.array(changelogSchema).default([]),
});

export const projectProgressSchema = z
  .strictObject({
    overallStatus: progressStatusSchema,
    currentStage: z.number().int().min(1).max(8),
    stages: z.array(stageProgressSchema).length(8, '阶段必须恰好 8 条'),
  })
  .superRefine((project, ctx) => {
    let firstIncomplete = 0;
    let hasInProgress = false;
    let seenNonCompleted = false;

    project.stages.forEach((stage, index) => {
      const expectedStage = index + 1;

      if (stage.stage !== expectedStage) {
        ctx.addIssue({
          code: 'custom',
          path: ['stages', index, 'stage'],
          message: `第 ${expectedStage} 条阶段的 stage 应为 ${expectedStage}`,
        });
      }

      if (stage.key !== STAGE_KEYS[index]) {
        ctx.addIssue({
          code: 'custom',
          path: ['stages', index, 'key'],
          message: `阶段 ${expectedStage} 的 key 应为 ${STAGE_KEYS[index]}`,
        });
      }

      if (stage.status === 'completed') {
        if (seenNonCompleted) {
          ctx.addIssue({
            code: 'custom',
            path: ['stages', index, 'status'],
            message: 'completed 阶段必须连续并位于最前',
          });
        }
        if (!stage.completedAt) {
          ctx.addIssue({
            code: 'custom',
            path: ['stages', index, 'completedAt'],
            message: 'completed 阶段必须填写 completedAt',
          });
        }
        return;
      }

      seenNonCompleted = true;
      if (firstIncomplete === 0) {
        firstIncomplete = expectedStage;
      }

      if (stage.status === 'in-progress') {
        if (hasInProgress) {
          ctx.addIssue({
            code: 'custom',
            path: ['stages', index, 'status'],
            message: 'in-progress 阶段至多一个',
          });
        }
        hasInProgress = true;

        if (!stage.startedAt) {
          ctx.addIssue({
            code: 'custom',
            path: ['stages', index, 'startedAt'],
            message: 'in-progress 阶段必须填写 startedAt',
          });
        }
      }

      if (stage.status === 'planned') {
        if (stage.startedAt) {
          ctx.addIssue({
            code: 'custom',
            path: ['stages', index, 'startedAt'],
            message: 'planned 阶段不能填写 startedAt',
          });
        }
        if (stage.completedAt) {
          ctx.addIssue({
            code: 'custom',
            path: ['stages', index, 'completedAt'],
            message: 'planned 阶段不能填写 completedAt',
          });
        }
        if (stage.changelog.length > 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['stages', index, 'changelog'],
            message: 'planned 阶段不能包含 changelog',
          });
        }
      }
    });

    const expectedCurrentStage = firstIncomplete === 0 ? 8 : firstIncomplete;
    if (project.currentStage !== expectedCurrentStage) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentStage'],
        message: `currentStage 应为 ${expectedCurrentStage}`,
      });
    }
  });

export const progressSchema = z.strictObject({
  schemaVersion: schemaVersionSchema,
  updatedAt: datetimeSchema,
  projects: z.record(slugSchema, projectProgressSchema),
});

export type StageProgress = z.infer<typeof stageProgressSchema>;
export type ProjectProgress = z.infer<typeof projectProgressSchema>;
export type Progress = z.infer<typeof progressSchema>;
export type ChangelogEntry = z.infer<typeof changelogSchema>;
