import { formatDataError, loadSiteData } from '../src/lib/data-source';

try {
  const data = await loadSiteData();

  data.warnings.forEach((warning) => {
    console.warn(`[warn] ${warning}`);
  });

  const documentCount = Object.values(data.documents).reduce(
    (total, documents) => total + documents.length,
    0,
  );

  console.log(
    `✔ 数据校验通过：${data.index.slugs.length} 个作品 / ${documentCount} 篇公开文档 / ${
      data.skills?.tabs.length ?? 0
    } 个能力标签页`,
  );
} catch (error) {
  console.error(formatDataError(error));
  process.exitCode = 1;
}
