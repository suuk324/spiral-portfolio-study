import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const repoName = "spiral-portfolio-study";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function copyFileRelative(from, to) {
  const sourcePath = path.join(rootDir, from);
  const targetPath = path.join(distDir, to);
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirRelative(from, to = from) {
  const sourcePath = path.join(rootDir, from);
  const targetPath = path.join(distDir, to);
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function rewriteHtml(sourceHtml, options) {
  const {
    assetPrefix,
    cssHref,
    scriptSrc,
    homeHref,
    aboutHref
  } = options;

  return sourceHtml
    .replace(/href="\/styles\.css([^"]*)"/g, `href="${cssHref}$1"`)
    .replace(/src="\/app\.js([^"]*)"/g, `src="${scriptSrc}$1"`)
    .replace(/content="\/assets\//g, `content="${assetPrefix}assets/`)
    .replace(/src="\/assets\//g, `src="${assetPrefix}assets/`)
    .replace(/href="\/about\/?"/g, `href="${aboutHref}"`)
    .replace('class="logo-badge" href="./"', `class="logo-badge" href="${homeHref}"`)
    .replace(/href="\/"/g, `href="${homeHref}"`);
}

function writeHtml(relativePath, html) {
  const outputPath = path.join(distDir, relativePath);
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, html, "utf8");
}

function getProjectSlugs(appSource) {
  const slugs = new Set();
  const regex = /slug:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(appSource)) !== null) {
    slugs.add(match[1]);
  }
  return Array.from(slugs);
}

resetDir(distDir);

copyDirRelative("assets");
copyFileRelative("styles.css", "styles.css");
copyFileRelative("app.js", "app.js");
copyFileRelative("node_modules/three/build/three.module.js", "node_modules/three/build/three.module.js");
copyFileRelative("node_modules/hls.js/dist/hls.mjs", "node_modules/hls.js/dist/hls.mjs");
fs.writeFileSync(path.join(distDir, ".nojekyll"), "", "utf8");

const indexHtml = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
const aboutHtml = fs.readFileSync(path.join(rootDir, "about.html"), "utf8");
const projectHtml = fs.readFileSync(path.join(rootDir, "project.html"), "utf8");
const appSource = fs.readFileSync(path.join(rootDir, "app.js"), "utf8");

writeHtml("index.html", rewriteHtml(indexHtml, {
  assetPrefix: "./",
  cssHref: "./styles.css",
  scriptSrc: "./app.js",
  homeHref: "./",
  aboutHref: "./about/"
}));

writeHtml("about/index.html", rewriteHtml(aboutHtml, {
  assetPrefix: "../",
  cssHref: "../styles.css",
  scriptSrc: "../app.js",
  homeHref: "../",
  aboutHref: "./"
}));

writeHtml("404.html", rewriteHtml(indexHtml, {
  assetPrefix: "./",
  cssHref: "./styles.css",
  scriptSrc: "./app.js",
  homeHref: "./",
  aboutHref: "./about/"
}));

for (const slug of getProjectSlugs(appSource)) {
  writeHtml(`projects/${slug}/index.html`, rewriteHtml(projectHtml, {
    assetPrefix: "../../",
    cssHref: "../../styles.css",
    scriptSrc: "../../app.js",
    homeHref: "../../",
    aboutHref: "../../about/"
  }));
}

console.log(`Built GitHub Pages output for ${repoName} at ${distDir}`);
