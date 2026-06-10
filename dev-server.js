const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = 4173;
const root = __dirname;
const allowedRemoteHosts = new Set([
  "cdn.sanity.io",
  "pacomepertant.com"
]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function rewritePathname(pathname) {
  if (pathname === "/") {
    return "/index.html";
  }

  if (pathname === "/about" || pathname === "/about/") {
    return "/about.html";
  }

  if (/^\/projects\/[^/]+\/?$/.test(pathname)) {
    return "/project.html";
  }

  return pathname;
}

function sendText(response, statusCode, body) {
  const buffer = Buffer.from(body, "utf8");
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": buffer.length
  });
  response.end(buffer);
}

async function proxyRemoteAsset(request, requestUrl, response) {
  const source = requestUrl.searchParams.get("url");

  if (!source) {
    sendText(response, 400, "Missing url");
    return;
  }

  let upstreamUrl;

  try {
    upstreamUrl = new URL(source);
  } catch {
    sendText(response, 400, "Invalid url");
    return;
  }

  if (!/^https?:$/.test(upstreamUrl.protocol) || !allowedRemoteHosts.has(upstreamUrl.hostname)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: request.headers.accept || "*/*"
      }
    });

    if (!upstreamResponse.ok) {
      sendText(response, upstreamResponse.status, `Upstream Error: ${upstreamResponse.status}`);
      return;
    }

    const data = Buffer.from(await upstreamResponse.arrayBuffer());
    const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream";
    const cacheControl = upstreamResponse.headers.get("cache-control") || "public, max-age=3600";
    const etag = upstreamResponse.headers.get("etag");
    const lastModified = upstreamResponse.headers.get("last-modified");

    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
      "Cache-Control": cacheControl,
      ...(etag ? { ETag: etag } : {}),
      ...(lastModified ? { "Last-Modified": lastModified } : {})
    });
    response.end(data);
  } catch (error) {
    sendText(response, 502, `Proxy Error: ${error.message}`);
  }
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/__asset") {
    void proxyRemoteAsset(request, requestUrl, response);
    return;
  }

  const relativePath = decodeURIComponent(rewritePathname(requestUrl.pathname));
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.resolve(root, `.${normalizedPath}`);

  if (!filePath.startsWith(root)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      sendText(response, 404, "Not Found");
      return;
    }

    const finalPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;

    fs.readFile(finalPath, (readError, data) => {
      if (readError) {
        sendText(response, 404, "Not Found");
        return;
      }

      const extension = path.extname(finalPath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": mimeTypes[extension] || "application/octet-stream",
        "Content-Length": data.length
      });
      response.end(data);
    });
  });
});

server.listen({
  port,
  host: "::",
  ipv6Only: false
});
