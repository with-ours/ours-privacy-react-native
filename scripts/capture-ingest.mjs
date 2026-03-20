#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);

const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }
  return args[index + 1];
};

const host = getArgValue("--host", "127.0.0.1");
const port = Number.parseInt(getArgValue("--port", "4010"), 10);
const outputDir = path.resolve(getArgValue("--dir", "tmp/captures"));

if (Number.isNaN(port) || port <= 0) {
  console.error("Invalid --port value.");
  process.exit(1);
}

await fs.mkdir(outputDir, {recursive: true});

let captureCount = 0;

const readRequestBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const summarizeEvents = (parsedBody) => {
  if (!parsedBody || !Array.isArray(parsedBody.data)) {
    return [];
  }

  return parsedBody.data
    .map((entry) => entry && entry.event)
    .filter((eventName) => typeof eventName === "string");
};

const sanitizeFileToken = (value) =>
  value.replaceAll(/[^a-zA-Z0-9._-]/g, "-");

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, {"Content-Type": "application/json"});
    response.end(JSON.stringify({ok: true}));
    return;
  }

  if (request.method !== "POST" || request.url !== "/ingest") {
    response.writeHead(404, {"Content-Type": "application/json"});
    response.end(JSON.stringify({ok: false, error: "Not found"}));
    return;
  }

  const body = await readRequestBody(request);
  let parsedBody = null;

  try {
    parsedBody = JSON.parse(body);
  } catch (_) {
    parsedBody = null;
  }

  captureCount += 1;
  const receivedAt = new Date().toISOString();
  const fileName = `${sanitizeFileToken(receivedAt)}-${String(captureCount).padStart(4, "0")}.json`;
  const filePath = path.join(outputDir, fileName);
  const events = summarizeEvents(parsedBody);

  const capture = {
    id: fileName.replace(/\.json$/, ""),
    receivedAt,
    method: request.method,
    url: request.url,
    headers: request.headers,
    rawBody: body,
    jsonBody: parsedBody,
  };

  await fs.writeFile(filePath, `${JSON.stringify(capture, null, 2)}\n`);

  console.log(
    `[capture] stored ${path.relative(process.cwd(), filePath)}${events.length > 0 ? ` events=${events.join(",")}` : ""}`
  );

  response.writeHead(200, {"Content-Type": "application/json"});
  response.end(JSON.stringify({ok: true, stored: fileName, events}));
});

server.listen(port, host, () => {
  console.log(`[capture] listening on http://${host}:${port}`);
  console.log("[capture] iOS simulator serverURL: http://127.0.0.1:" + port);
  console.log("[capture] Android emulator serverURL: http://10.0.2.2:" + port);
  console.log("[capture] output directory: " + outputDir);
});

const shutdown = () => {
  server.close(() => {
    console.log("[capture] stopped");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
