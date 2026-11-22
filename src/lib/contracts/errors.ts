import type { z } from 'zod';

/** 数据契约错误：构建期统一抛出，携带文件、字段路径与规则编号。 */
export class DataContractError extends Error {
  readonly file: string;
  readonly fieldPath: string;
  readonly rule: string;

  constructor(file: string, fieldPath: string, rule: string, message: string) {
    super(message);
    this.name = 'DataContractError';
    this.file = file;
    this.fieldPath = fieldPath;
    this.rule = rule;
  }
}

/** 用给定 Schema 解析数据，失败时抛出可定位的 DataContractError。 */
export function parseContract<T>(
  schema: z.ZodType<T>,
  input: unknown,
  file: string,
  rule = 'V-02',
): T {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues;
  const first = issues[0];
  const fieldPath = first ? first.path.map(String).join('.') || '(root)' : '(root)';
  const details = issues
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join('; ');

  throw new DataContractError(
    file,
    fieldPath,
    rule,
    `${file} 不符合数据契约：${details}`,
  );
}
