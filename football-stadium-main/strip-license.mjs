import fs from "fs";

for (const f of ["index.html", "stadium-original.html"]) {
  let h = fs.readFileSync(f, "utf8");
  h = h.replace(/<!--\s*StadiView[\s\S]*?-->\s*/, "");
  h = h.replace(
    /\s*Copyright © 2026 thebuggeddev\. Licensed under PolyForm Noncommercial 1\.0\.0\.\s*Commercial use requires a separate license\. See LICENSE\.md\.\s*/g,
    "\n",
  );
  h = h.replace(
    /\s*Copyright 2026 thebuggeddev\s*Community license is PolyForm Noncommercial 1\.0\.0\. See LICENSE\.md\.\s*/g,
    "\n",
  );
  h = h.replace(/<meta\s+name="author"\s+content="thebuggeddev"\s*\/>\s*/g, "");
  h = h.replace(
    /content="A procedural 3D football stadium seat preview concept by thebuggeddev\."/g,
    'content="A procedural 3D football stadium seat preview."',
  );
  h = h.replace(
    /I.m <strong>thebuggeddev<\/strong>\. If this project made you smile and[\s\S]*?below [^\n<]*/g,
    "If this project made you smile, you can support the next experiment below.",
  );
  fs.writeFileSync(f, h);
  console.log("cleaned", f);
}
