import http from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateProfile } from "./src/domain/prompt-builder.mjs";
import { generatePlanWithDeepSeek } from "./src/server/deepseek-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DEFAULT_PORT = Number.parseInt(process.env.PORT || "4317", 10);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

const CORS_ALLOW_HEADERS = "Content-Type, Authorization";
const CORS_ALLOW_METHODS = "GET, POST, OPTIONS";
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

export function createCookingCoachServer({ fetchImpl = globalThis.fetch } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://localhost");

      if (request.method === "OPTIONS") {
        return sendCorsPreflight(request, response);
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, { ok: true, name: "ai-cooking-coach" }, request);
      }

      if (request.method === "POST" && url.pathname === "/api/plan") {
        await handlePlanRequest(request, response, fetchImpl);
        return;
      }

      if (request.method === "GET") {
        await serveStatic(url.pathname, response, request);
        return;
      }

      sendJson(response, 405, { error: "Method not allowed" }, request);
    } catch (error) {
      sendJson(response, error.status || 500, {
        error: error.message || "服务器错误",
        details: error.details
      }, request);
    }
  });
}

async function handlePlanRequest(request, response, fetchImpl) {
  const body = await readJson(request);
  const validation = validateProfile(body.profile || {});

  if (!validation.valid) {
    return sendJson(response, 400, {
      error: "规划参数无效。",
      details: validation.errors
    }, request);
  }

  const apiKey = String(body.apiKey || "").trim();
  if (!apiKey) {
    return sendJson(response, 400, {
      error: "请先提交 DeepSeek API Key 后再生成备餐计划。"
    }, request);
  }

  const plan = await generatePlanWithDeepSeek({
    apiKey,
    profile: validation.profile,
    model: body.model || "deepseek-v4-flash",
    fetchImpl
  });

  sendJson(response, 200, { mode: "live", plan }, request);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 128_000) {
        reject(Object.assign(new Error("请求体过大。"), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error("请求 JSON 无法解析。"), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

async function serveStatic(pathname, response, request) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(safePath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);
  const relative = path.relative(PUBLIC_DIR, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return sendJson(response, 403, { error: "Forbidden" }, request);
  }

  try {
    await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES.get(path.extname(filePath)) || "application/octet-stream",
      "Cache-Control": "no-store",
      ...corsHeaders(request)
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Not found" }, request);
  }
}

function sendCorsPreflight(request, response) {
  response.writeHead(204, {
    ...corsHeaders(request),
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Max-Age": "600"
  });
  response.end();
}

function corsHeaders(request) {
  const origin = request?.headers?.origin;
  if (origin !== "null" && !LOCAL_ORIGIN_PATTERN.test(origin || "")) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin"
  };
}

function sendJson(response, status, payload, request) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(request)
  });
  response.end(JSON.stringify(payload));
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  const server = createCookingCoachServer();
  server.listen(DEFAULT_PORT, "127.0.0.1", () => {
    const address = server.address();
    console.log(`AI Cooking Coach running at http://127.0.0.1:${address.port}`);
  });
}
