import type { LinkType, ProjectStatus, StageStatus } from './contracts';

// 八阶段与阶段名称以契约为唯一来源，避免页面各自维护。
export { STAGES, STAGE_KEYS, stageNameOf } from './contracts';
export type { StageKey } from './contracts';

/** 作品状态展示文案（对应 UI StatusBadge）。 */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  released: '已上线',
  'in-development': '开发中',
  planned: '规划中',
  archived: '已归档',
};

/** 阶段状态展示文案。 */
export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  planned: '未开始',
  'in-progress': '进行中',
  completed: '已完成',
};

/** 外部链接类型展示文案。 */
export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  live: '线上地址',
  repo: '源码仓库',
  doc: '文档',
  design: '设计稿',
  download: '下载',
};

/** 阶段 1 尚未开始时，当前阶段的展示文案。 */
export const PREPARING_STAGE_LABEL = '准备中';

export interface SiteNavItem {
  href: string;
  label: string;
}

/** 全站主导航，Header / Footer / MobileNav 共用。 */
export const SITE_NAV_ITEMS: readonly SiteNavItem[] = [
  { href: '/', label: '首页' },
  { href: '/projects/', label: '作品' },
  { href: '/about/', label: '关于' },
];

/** 判断导航项是否为当前页；/projects/{slug}/ 归属 Projects。 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(href);
}
