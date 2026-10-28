import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PUERTO = process.env.PORT || 5173;
const RAIZ = normalize(process.cwd());

const TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon"
};

const servidor = createServer(async (req, res) => {
    try {
        let ruta = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        if (ruta === "/") {
            res.writeHead(302, { Location: "/src/web/index.html" });
            res.end();
            return;
        }

        const absoluta = normalize(join(RAIZ, ruta));
        if (!absoluta.startsWith(RAIZ)) {
            res.writeHead(403);
            res.end("403");
            return;
        }

        const contenido = await readFile(absoluta);
        res.writeHead(200, {
            "Content-Type": TIPOS[extname(absoluta)] || "application/octet-stream",
            "Cache-Control": "no-store"
        });
        res.end(contenido);
    } catch {
        res.writeHead(404);
        res.end("404");
    }
});

servidor.listen(PUERTO, () => {
    console.log("Chat web: http://localhost:" + PUERTO);
});
