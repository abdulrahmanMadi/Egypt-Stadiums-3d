const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = 'd:/Projects/football-stadium-main/football-stadium-main';
const gitRoot = 'd:/Projects/football-stadium-main';
const engineRel = 'src/app/stadium/stadium.engine.js';
const gitPath = 'football-stadium-main/src/app/stadium/stadium.engine.js';
const enginePath = path.join(root, engineRel);
const transcript =
  'C:/Users/Abdul/.cursor/projects/d-Projects-football-stadium-main/agent-transcripts/34e832bc-ff7b-460e-8c89-a5264fe04965/34e832bc-ff7b-460e-8c89-a5264fe04965.jsonl';

let content = execSync('git show HEAD:' + gitPath, {
  cwd: gitRoot,
  encoding: 'utf8',
  maxBuffer: 20e6,
});

const lines = fs.readFileSync(transcript, 'utf8').split(/\n/);
const ops = [];
lines.forEach((line, i) => {
  if (!line.trim()) return;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return;
  }
  const parts = obj?.message?.content;
  if (!Array.isArray(parts)) return;
  for (const part of parts) {
    if (part.type !== 'tool_use') continue;
    const name = part.name;
    const inp = part.input || {};
    const p = (inp.path || '') + '';
    if (!p.includes('stadium.engine.js')) continue;
    if (name === 'StrReplace' || name === 'Write') {
      ops.push({ line: i + 1, name, inp });
    }
  }
});

// Replay through volume tweaks after layered audio; skip corruption/checkout aftermath
const STOP_AFTER = 246;
const filtered = ops.filter((o) => o.line <= STOP_AFTER);
console.log('Total ops', ops.length, 'replaying', filtered.length);

let applied = 0,
  failed = 0;
const failures = [];
for (const op of filtered) {
  if (op.name === 'Write') {
    content = op.inp.contents;
    applied++;
    continue;
  }
  const oldS = op.inp.old_string;
  const newS = op.inp.new_string;
  if (oldS == null || newS == null) {
    failed++;
    failures.push({ line: op.line, reason: 'missing' });
    continue;
  }
  const count = content.split(oldS).length - 1;
  if (count === 0) {
    failed++;
    failures.push({
      line: op.line,
      reason: 'not found',
      preview: oldS.slice(0, 80).replace(/\n/g, '\\n'),
    });
    continue;
  }
  if (op.inp.replace_all) content = content.split(oldS).join(newS);
  else content = content.replace(oldS, newS);
  applied++;
}

fs.writeFileSync(enginePath, content, 'utf8');
console.log('Applied', applied, 'Failed', failed, 'Size', content.length);
failures.slice(0, 50).forEach((f) =>
  console.log('FAIL L' + f.line, f.reason, f.preview || ''),
);

// Quick feature checks
for (const key of [
  'whiteRoof',
  'buildRoofMesh',
  'detailed fans',
  'crowd-ambience',
  'MISR STADIUM',
  '8b0000',
  'View from seat',
]) {
  console.log(key, content.includes(key) ? 'YES' : 'NO');
}
