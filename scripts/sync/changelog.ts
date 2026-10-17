/**
 * 变更日志 CLI：sync 之后比较新旧两份快照，产出 data/changelog.json 条目。
 *
 * 在 GitHub Actions 的 sync 工作流里跑（见 .github/workflows/sync.yml）：
 *   1. sync 之前把旧 models.json 复制到 /tmp；
 *   2. npm run sync 产出新快照；
 *   3. npx tsx scripts/sync/changelog.ts /tmp/models.old.json data/models.json
 *
 * 有变化就把新条目追加进 data/changelog.json（随快照同一个 commit 提交），
 * 并把摘要打到 stdout；同时写 GITHUB_OUTPUT 的 changed=true，供下一步开速报 issue。
 */

import fs from 'node:fs';
import type { ChangeEntry, WorldSnapshot } from '../../src/lib/types.ts';
import { buildEntry } from './lib/changelog.ts';

const ROOT = process.cwd();
const CHANGELOG_FILE = `${ROOT}/data/changelog.json`;

/** 最多保留的条目数。每条是四张最多 12 项的清单，几百条也不会撑爆仓库。 */
const MAX_ENTRIES = 120;

/** 追加一条进 data/changelog.json，新的在前；同一快照不写两条。 */
export function appendChangelog(file: string, entry: ChangeEntry): void {
  const list: ChangeEntry[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  if (list[0]?.date === entry.date) return;
  list.unshift(entry);
  fs.writeFileSync(file, `${JSON.stringify(list.slice(0, MAX_ENTRIES), null, 1)}\n`);
}

function main() {
  const [oldFile, newFile] = process.argv.slice(2);
  if (!oldFile || !newFile) {
    console.error('用法：tsx scripts/sync/changelog.ts <旧快照.json> <新快照.json>');
    process.exit(2);
  }
  const oldS = JSON.parse(fs.readFileSync(oldFile, 'utf8')) as WorldSnapshot;
  const newS = JSON.parse(fs.readFileSync(newFile, 'utf8')) as WorldSnapshot;
  const entry = buildEntry(oldS, newS);
  if (!entry) {
    console.log('无值得一提的变化，不写变更日志');
    process.exit(0);
  }
  appendChangelog(CHANGELOG_FILE, entry);
  console.log(`已写入 data/changelog.json（${entry.date}）`);
  console.log(entry.summary);
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `changed=true\n`);
}

main();
