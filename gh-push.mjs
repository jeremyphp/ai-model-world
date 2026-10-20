import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = 'jeremyphp/ai-model-world';
import { execFileSync as ex } from 'node:child_process';
void ex;

const MESSAGE = process.argv[2] ?? 'chore: update';

function ghToken() {
  const out = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
  const m = {};
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) m[line.slice(0, i)] = line.slice(i + 1);
  }
  return m.password;
}

const token = ghToken();
const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'dsh', 'Content-Type': 'application/json' };
const repo = process.argv[3] ?? REPO;

async function api(p, init = {}) {
  const r = await fetch('https://api.github.com' + p, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} → ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

const ref = await api(`/repos/${repo}/git/ref/heads/main`);
const headSha = ref.object.sha;
const out = execFileSync('git', ['diff', '--name-only', `origin/main`], { encoding: 'utf8' });
const files = out.split(/\r?\n/).filter(Boolean);
if (files.length === 0) {
  console.log('没有改动');
  process.exit(0);
}
console.log('待提交:', files.join(', '));

const entries = [];
for (const f of files) {
  const buf = fs.readFileSync(path.join(process.cwd(), f));
  const blob = await api(`/repos/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }),
  });
  entries.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
}

const headCommit = await api(`/repos/${repo}/git/commits/${headSha}`);
const tree = await api(`/repos/${repo}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: entries }),
});
const commit = await api(`/repos/${repo}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message: MESSAGE, tree: tree.sha, parents: [headSha] }),
});
await api(`/repos/${repo}/git/refs/heads/main`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
console.log('已推送:', commit.sha.slice(0, 7), '| 文件数:', files.length);
