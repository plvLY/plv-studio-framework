import { z } from 'zod';
import {
  imagePathSchema,
  nonEmptyString,
  schemaVersionSchema,
  slugSchema,
  socialUrlSchema,
  themeModeSchema,
} from './common';

const emailSchema = z
  .string()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '邮箱格式无效');

const socialSchema = z.strictObject({
  label: nonEmptyString,
  url: socialUrlSchema,
  icon: nonEmptyString,
});

export const profileSchema = z.strictObject({
  schemaVersion: schemaVersionSchema,
  slug: slugSchema,
  brand: z.strictObject({
    studioName: nonEmptyString,
    slogan: nonEmptyString,
    positioning: nonEmptyString,
  }),
  author: z.strictObject({
    name: nonEmptyString,
    title: nonEmptyString,
    avatar: imagePathSchema.optional(),
    bio: nonEmptyString,
    location: nonEmptyString,
    email: emailSchema,
  }),
  home: z.strictObject({
    heroKicker: nonEmptyString,
    heroTitle: nonEmptyString,
    heroSubtitle: nonEmptyString,
    // 精选作品 1 ~ 3 个；超过 3 个由 validateBundle 给出 warn（V-17）。
    featuredSlugs: z.array(slugSchema).min(1, '至少指定 1 个精选作品'),
  }),
  social: z.array(socialSchema),
  seo: z.strictObject({
    siteUrl: z.string().refine((value) => {
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    }, '站点地址必须是 https'),
    defaultTitle: nonEmptyString,
    titleTemplate: nonEmptyString,
    defaultDescription: nonEmptyString,
    ogImage: imagePathSchema,
    locale: nonEmptyString,
  }),
  theme: z.strictObject({
    defaultMode: themeModeSchema,
  }),
});

export type Profile = z.infer<typeof profileSchema>;
