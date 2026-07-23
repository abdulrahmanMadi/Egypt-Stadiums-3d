import fs from "fs";

const html = fs.readFileSync("stadium-original.html", "utf8");

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("no style");
fs.writeFileSync("src/styles.css", styleMatch[1].trim() + "\n");

const bodyMatch = html.match(/<body>([\s\S]*?)<script src=/);
if (!bodyMatch) throw new Error("no body");
let body = bodyMatch[1].trim();

body = body.replace(
  /I'm <strong>thebuggeddev<\/strong>\. If this project made you smile and\s+you want to help me keep Claude Max Max Max alive so I can build all\s+of that, you can support the next experiment below [\uD83D\uDE22\uD83D\uDE02]/,
  "If this project made you smile, you can support the next experiment below.",
);

fs.writeFileSync("src/app/app.html", body + "\n");

const all = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
if (!all.length) throw new Error("no inline script");
let code = all[all.length - 1][1];

code = code
  .replace(/\/\* =+[\s\S]*?=+\s*\*\//, "")
  .replace(
    /Copyright © 2026 thebuggeddev\. Licensed under PolyForm Noncommercial 1\.0\.0\.\s*Commercial use requires a separate license\. See LICENSE\.md\./g,
    "",
  )
  .replace(/^\s*"use strict";\s*/m, "");

const wrapped = `/* Stadium engine — procedural Three.js experience */
export function initStadium() {
${code.trim()}
}
`;

fs.writeFileSync("src/app/stadium/stadium.engine.js", wrapped);
console.log({
  css: fs.statSync("src/styles.css").size,
  html: fs.statSync("src/app/app.html").size,
  js: fs.statSync("src/app/stadium/stadium.engine.js").size,
});
