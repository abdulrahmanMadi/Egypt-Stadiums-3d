const fs = require("fs");
const p = "src/app/stadium/stadiums/misr.engine.js";
let s = fs.readFileSync(p, "utf8");

s = s.replace(/canvas\.addEventListener\(/g, "on(canvas, ");
s = s.replace(/\baddEventListener\("keydown"/g, 'on(window, "keydown"');
s = s.replace(/ui\.bkExit\.addEventListener\(/g, "on(ui.bkExit, ");
s = s.replace(/ui\.bkSnd\.addEventListener\(/g, "on(ui.bkSnd, ");
s = s.replace(/ui\.d3d\.addEventListener\(/g, "on(ui.d3d, ");

const ids = [
  "checkout",
  "cc-reset",
  "d-reset",
  "ov-expand",
  "cc-zin",
  "cc-zout",
  "d-zin",
  "d-zout",
  "cc-help",
  "d-vr",
];
for (const id of ids) {
  const from = new RegExp(
    `\\$\\("${id}"\\)\\.addEventListener\\(`,
    "g",
  );
  s = s.replace(from, `on($("${id}"), `);
}

const ending = `      applySelection(featuredIdx);
      currentInfo = seatInfo(featuredIdx);
      updatePanel(currentInfo, "suggested");
      drawOverviewBase();
      applyOrbit();
      animate();
}`;

const replacement = `      applySelection(featuredIdx);
      currentInfo = seatInfo(featuredIdx);
      updatePanel(currentInfo, "suggested");
      drawOverviewBase();
      applyOrbit();
      animate();

      return {
        id: metaInfo.id,
        dispose() {
          if (disposed) return;
          disposed = true;
          cancelAnimationFrame(rafId);
          disposers.slice().forEach((fn) => {
            try {
              fn();
            } catch (_) {}
          });
          disposers.length = 0;
          try {
            if (typeof AC !== "undefined" && AC && AC.state !== "closed") {
              AC.close();
            }
          } catch (_) {}
          try {
            scene.traverse((obj) => {
              if (obj.geometry) obj.geometry.dispose();
              if (obj.material) {
                const mats = Array.isArray(obj.material)
                  ? obj.material
                  : [obj.material];
                mats.forEach((m) => {
                  if (!m) return;
                  if (m.map) m.map.dispose();
                  m.dispose();
                });
              }
            });
          } catch (_) {}
          try {
            pickRT.dispose();
          } catch (_) {}
          try {
            renderer.dispose();
            renderer.forceContextLoss?.();
          } catch (_) {}
          canvas.classList.remove("dragging", "seatmode");
          const loader = document.getElementById("loader");
          if (loader) loader.classList.remove("hide");
        },
      };
}`;

if (!s.includes(ending)) {
  console.error("ending marker not found");
  process.exit(1);
}
s = s.replace(ending, replacement);

// show loader text from meta at boot
if (!s.includes("metaInfo.loaderText")) {
  s = s.replace(
    'const canvas = document.getElementById("c");',
    `const loaderEl = document.getElementById("loader");
      const loaderTextEl = document.getElementById("loader-text");
      if (loaderEl) loaderEl.classList.remove("hide");
      if (loaderTextEl) loaderTextEl.textContent = metaInfo.loaderText || ("Loading " + metaInfo.name + "…");
      const canvas = document.getElementById("c");`,
  );
}

fs.writeFileSync(p, s);
console.log(
  "ok",
  "on(canvas=",
  (s.match(/on\(canvas,/g) || []).length,
  "leftover canvas.addEventListener=",
  (s.match(/canvas\.addEventListener/g) || []).length,
  "has dispose",
  s.includes("dispose()"),
);
