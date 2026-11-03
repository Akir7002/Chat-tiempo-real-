import "dotenv/config";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { procesarPreguntaChat } from "./ia-service.js";
import { iniciarBotFirestore } from "./bot-listener.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "src", "web");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes("vethernet") || name.toLowerCase().includes("virtual") || name.toLowerCase().includes("wsl")) {
      continue;
    }
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        candidates.push({ name, ip: iface.address });
      }
    }
  }
  if (candidates.length > 0) {
    return candidates[0].ip;
  }
  return "localhost";
}

const server = http.createServer(async (req, res) => {
  // Manejo de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API REST: POST /api/chat-ia
  if (req.method === "POST" && req.url === "/api/chat-ia") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const pregunta = parsed.pregunta || "";
        if (!pregunta) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Falta el campo 'pregunta'" }));
          return;
        }

        const respuesta = await procesarPreguntaChat(pregunta);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ respuesta }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Servir archivos estáticos del chat-web
  let filePath = path.join(PUBLIC_DIR, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": `${contentType}; charset=utf-8` });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, "0.0.0.0", async () => {
  const localIp = getLocalIpAddress();
  console.log(`=======================================================`);
  console.log(`🚀 Chat Web con Backend IA en línea:`);
  console.log(`   - En este computador: http://localhost:${PORT}`);
  console.log(`   - En tu red Wi-Fi:    http://${localIp}:${PORT}`);
  console.log(`=======================================================`);

  // Iniciar el listener de CineBot en Firestore
  await iniciarBotFirestore();
});
