// @ts-nocheck
let cachedApp;

async function loadApp() {
  if (!cachedApp) {
    const mod = await import("../dist/index.js");
    cachedApp = mod.default || mod.app;
  }
  return cachedApp;
}

export default async function handler(req, res) {
  const app = await loadApp();
  return app(req, res);
}
