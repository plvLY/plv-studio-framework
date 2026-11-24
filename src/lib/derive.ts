import type { DocumentMeta, Profile, ProjectProgress, Work } from './contracts';
import { PREPARING_STAGE_LABEL, stageNameOf } from './constants';

/** 按作品 slug 索引的公开文档元信息。 */
export type DocumentsBySlug = Record<string, readonly DocumentMeta[]>;

/**
 * 总进度百分比：round((completed 数 + in-progress 数 × 0.5) / 8 × 100)。
 * 数据文件不存储百分比，首页与列表页必须共用此函数。
 */
export function calcPercent(project: ProjectProgress): number {
  const completed = project.stages.filter((stage) => stage.status === 'completed').length;
  const inProgress = project.stages.filter((stage) => stage.status === 'in-progress').length;

  return Math.round(((completed + inProgress * 0.5) / project.stages.length) * 100);
}

/**
 * 作品最近更新：取 works.updatedAt、最新 changelog 日期、最新公开文档日期三者最大值。
 * 首页、列表页、详情页共用同一口径。
 */
export function deriveRecentUpdate(
  work: Work,
  project: ProjectProgress,
  documents: readonly DocumentMeta[] = [],
): string {
  let latest = work.updatedAt;

  project.stages.forEach((stage) => {
    stage.changelog.forEach((item) => {
      if (item.date > latest) {
        latest = item.date;
      }
    });
  });

  documents.forEach((document) => {
    if (document.visibility === 'public' && document.date > latest) {
      latest = document.date;
    }
  });

  return latest;
}

export interface Journey {
  /** 起点：works.startDate 与阶段 1 startedAt 中较早者。 */
  startDate: string;
  currentStage: number;
  /** 阶段 1 未开始时为"准备中"，否则为阶段名称。 */
  currentStageName: string;
  /** 终点：最近更新时间。 */
  recentUpdate: string;
}

/** 项目 0 → 1 历程：起始 → 当前阶段 → 最近更新。 */
export function deriveJourney(
  work: Work,
  project: ProjectProgress,
  documents: readonly DocumentMeta[] = [],
): Journey {
  const firstStage = project.stages[0];
  const stageStart = firstStage?.startedAt ?? null;
  const startDate = stageStart && stageStart < work.startDate ? stageStart : work.startDate;
  const current = project.stages[project.currentStage - 1] ?? firstStage;

  return {
    startDate,
    currentStage: project.currentStage,
    currentStageName: firstStage?.status === 'planned' ? PREPARING_STAGE_LABEL : stageNameOf(current.key),
    recentUpdate: deriveRecentUpdate(work, project, documents),
  };
}

export interface DevelopingWork {
  work: Work;
  project: ProjectProgress;
  journey: Journey;
}

/** 首页"正在开发"：全部 in-development 作品，按最近更新时间倒序，不设主推。 */
export function deriveDeveloping(
  works: readonly Work[],
  projects: Record<string, ProjectProgress>,
  documentsBySlug: DocumentsBySlug = {},
): DevelopingWork[] {
  return works
    .filter((work) => work.status === 'in-development')
    .flatMap((work) => {
      const project = projects[work.slug];

      if (!project) {
        return [];
      }

      return [
        {
          work,
          project,
          journey: deriveJourney(work, project, documentsBySlug[work.slug] ?? []),
        },
      ];
    })
    .sort((left, right) => right.journey.recentUpdate.localeCompare(left.journey.recentUpdate));
}

export interface LiveStats {
  works: number;
  completedStages: number;
  publicDocuments: number;
  recentUpdate: string | null;
}

/** 首页 Live Stats：作品数、已完成阶段数、公开文档数、最近更新时间。 */
export function deriveLiveStats(
  works: readonly Work[],
  projects: Record<string, ProjectProgress>,
  documentsBySlug: DocumentsBySlug = {},
): LiveStats {
  const completedStages = Object.values(projects).reduce(
    (total, project) => total + project.stages.filter((stage) => stage.status === 'completed').length,
    0,
  );

  const publicDocuments = Object.values(documentsBySlug).reduce(
    (total, documents) => total + documents.filter((document) => document.visibility === 'public').length,
    0,
  );

  let recentUpdate: string | null = null;

  works.forEach((work) => {
    const project = projects[work.slug];

    if (!project) {
      return;
    }

    const update = deriveRecentUpdate(work, project, documentsBySlug[work.slug] ?? []);

    if (!recentUpdate || update > recentUpdate) {
      recentUpdate = update;
    }
  });

  return {
    works: works.length,
    completedStages,
    publicDocuments,
    recentUpdate,
  };
}

export type ReleaseGroup = 'released' | 'inProgress' | 'planned';

export interface ReleaseLogEntry {
  date: string;
  note: string;
  version?: string;
  slug: string;
  title: string;
  group: ReleaseGroup;
}

export interface ReleaseLog {
  released: ReleaseLogEntry[];
  inProgress: ReleaseLogEntry[];
  planned: ReleaseLogEntry[];
}

/** 发布日志分组：阶段 7 已完成 → Released；存在进行中阶段 → In Progress；其余 → Planned。 */
function resolveReleaseGroup(project: ProjectProgress): ReleaseGroup {
  const releaseStage = project.stages.find((stage) => stage.stage === 7);

  if (releaseStage?.status === 'completed') {
    return 'released';
  }

  if (project.stages.some((stage) => stage.status === 'in-progress')) {
    return 'inProgress';
  }

  return 'planned';
}

/** 首页发布日志：跨项目聚合 changelog，按日期倒序取最近 limit 条后分三组。 */
export function deriveReleaseLog(
  projects: Record<string, ProjectProgress>,
  works: Record<string, Work>,
  limit = 5,
): ReleaseLog {
  const entries: ReleaseLogEntry[] = [];

  Object.entries(projects).forEach(([slug, project]) => {
    const work = works[slug];

    if (!work) {
      return;
    }

    const group = resolveReleaseGroup(project);

    project.stages.forEach((stage) => {
      stage.changelog.forEach((item) => {
        entries.push({
          date: item.date,
          note: item.note,
          version: item.version,
          slug,
          title: work.title,
          group,
        });
      });
    });
  });

  entries.sort((left, right) => right.date.localeCompare(left.date));

  const recent = entries.slice(0, limit);

  return {
    released: recent.filter((entry) => entry.group === 'released'),
    inProgress: recent.filter((entry) => entry.group === 'inProgress'),
    planned: recent.filter((entry) => entry.group === 'planned'),
  };
}

/** 首页精选：按 profile.home.featuredSlugs 顺序取存在的作品，最多 3 个；缺失项跳过。 */
export function deriveFeatured(profile: Profile, works: Record<string, Work>): Work[] {
  return profile.home.featuredSlugs
    .map((slug) => works[slug])
    .filter((work): work is Work => Boolean(work))
    .slice(0, 3);
}
