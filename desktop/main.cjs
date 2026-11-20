// FrancMap desktop app (Electron).
// Serves the built web app (dist/) from a tiny local HTTP server on 127.0.0.1 and
// shows it in a window. Serving over localhost (not file://) keeps absolute paths like
// /data/caves.json and the offline service worker working exactly as in the browser.
const { app, BrowserWindow, shell, session } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PREFERRED_PORT = 47823; // fixed port → same origin every launch → offline cache + settings persist
const DIST = [
  path.join(__dirname, "dist"),            // packaged app: resources/app/dist
  path.join(__dirname, "..", "dist"),      // dev: repo/dist
].find((p) => fs.existsSync(path.join(p, "index.html")));

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm", ".map": "application/json",
};

function serve(req, res) {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    let file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // Missing static file → 404; app routes (no extension) → SPA index.html
      if (path.extname(rel)) { res.writeHead(404); return res.end(); }
      file = path.join(DIST, "index.html");
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
    if (file.endsWith("sw.js")) headers["Service-Worker-Allowed"] = "/";
    if (ext === ".html" || file.endsWith("sw.js")) headers["Cache-Control"] = "no-cache";
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(500); res.end();
  }
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(serve);
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server.address().port));
  });
}

let mainWindow = null;

async function createWindow() {
  if (!DIST) throw new Error("dist/ not found — run `npm run build` first");
  let port;
  try { port = await startServer(PREFERRED_PORT); }
  catch { port = await startServer(0); } // preferred port busy → any free port

  // GPS / "my location" features need geolocation; nothing else is granted
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(["geolocation", "fullscreen", "clipboard-sanitized-write"].includes(permission));
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 360,
    minHeight: 500,
    title: "FrancMap",
    backgroundColor: "#e8ede8",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  mainWindow.setMenuBarVisibility(false);

  const origin = `http://127.0.0.1:${port}`;
  // Links to other sites (Wikipedia, OSM …) open in the normal browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(origin)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(origin)) { e.preventDefault(); shell.openExternal(url); }
  });
  mainWindow.on("page-title-updated", (e) => e.preventDefault());
  mainWindow.on("closed", () => { mainWindow = null; });

  await mainWindow.loadURL(origin + "/");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => app.quit());
}
