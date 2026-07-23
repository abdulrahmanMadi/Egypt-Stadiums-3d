const fs = require('fs');
const p =
  'd:/Projects/football-stadium-main/football-stadium-main/src/app/stadium/stadium.engine.js';
let s = fs.readFileSync(p, 'utf8');
s = s.split('setCrowd(0.085)').join('setCrowd(0.34)');
s = s.split('setCrowd(0.17)').join('setCrowd(0.55)');
s = s
  .split('mode === "seat" ? 0.17 : 0.085')
  .join('mode === "seat" ? 0.55 : 0.34');
s = s
  .split('mode === "seat" ? 0.075 : 0.02')
  .join('mode === "seat" ? 0.55 : 0.34');
fs.writeFileSync(p, s, 'utf8');
console.log(
  [...s.matchAll(/setCrowd\([^)]+\)/g)].map((m) => m[0]).join('\n'),
);
