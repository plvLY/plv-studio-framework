import { DataContractError } from './errors';
import type { Profile } from './profile';
import type { Progress } from './progress';
import type { Work, WorksIndex } from './work';

export interface DataBundle {
  profile: Profile;
  index: WorksIndex;
  works: Record<string, Work>;
  progress: Progress;
}

/**
 * 跨文件校验：作品索引、进度、精选等引用完整性。
 * 返回 warn 列表；error 直接抛出。
 */
export function validateBundle(bundle: DataBundle): string[] {
  const warnings: string[] = [];
  const indexSlugs = bundle.index.slugs;
  const workSlugs = Object.keys(bundle.works);
  const progressSlugs = Object.keys(bundle.progress.projects);

  // V-04：index 与 works 文件双向一一对应
  indexSlugs.forEach((slug) => {
    if (!bundle.works[slug]) {
      throw new DataContractError(
        'works/index.json',
        `slugs.${slug}`,
        'V-04',
        `作品 ${slug} 缺少 works/${slug}.json`,
      );
    }
  });

  workSlugs.forEach((slug) => {
    const work = bundle.works[slug];

    if (!indexSlugs.includes(slug)) {
      throw new DataContractError(
        'works/index.json',
        'slugs',
        'V-04',
        `works/${slug}.json 未登记在 works/index.json`,
      );
    }

    if (!work || work.slug !== slug) {
      throw new DataContractError(
        `works/${slug}.json`,
        'slug',
        'V-03',
        `works/${slug}.json 的 slug 必须与文件名一致`,
      );
    }
  });

  // V-05：进度 key 与作品集合一致
  progressSlugs.forEach((slug) => {
    if (!indexSlugs.includes(slug)) {
      throw new DataContractError(
        'progress.json',
        `projects.${slug}`,
        'V-05',
        `进度记录 ${slug} 不在 works/index.json 中`,
      );
    }
  });

  indexSlugs.forEach((slug) => {
    if (!bundle.progress.projects[slug]) {
      throw new DataContractError(
        'progress.json',
        `projects.${slug}`,
        'V-05',
        `作品 ${slug} 缺少进度记录`,
      );
    }
  });

  // V-14 / V-17：精选作品存在性与数量
  bundle.profile.home.featuredSlugs.forEach((slug) => {
    if (!indexSlugs.includes(slug)) {
      warnings.push(`V-14 profile.json: 精选作品 ${slug} 不存在，已跳过`);
    }
  });

  if (bundle.profile.home.featuredSlugs.length > 3) {
    warnings.push('V-17 profile.json: 精选作品超过 3 个，仅展示前 3 个');
  }

  indexSlugs.forEach((slug) => {
    const work = bundle.works[slug];
    const project = bundle.progress.projects[slug];

    if (!work || !project) {
      return;
    }

    // V-16
    if (work.status === 'released' && !work.releaseDate) {
      warnings.push(`V-16 works/${slug}.json: status=released 但 releaseDate 为 null`);
    }

    // V-15
    project.stages.forEach((stage, index) => {
      if (stage.status !== 'planned' && stage.summary.trim() === '') {
        warnings.push(
          `V-15 progress.json: ${slug} 阶段 ${index + 1} 已开始但 summary 为空`,
        );
      }
    });
  });

  return warnings;
}
