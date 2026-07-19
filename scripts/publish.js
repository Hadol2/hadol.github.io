import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_DATABASE_ID = "44915bc8-ea4d-4f25-9e62-6a5f2d8149ab";
const NOTION_IMAGE_HOST = /(?:amazonaws\.com|notion-static\.com|notionusercontent\.com)$/i;

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(dateStr, now = new Date()) {
  const date = dateStr?.split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(date ?? "")
    ? date
    : now.toISOString().split("T")[0];
}

export function buildFrontmatter({
  title,
  date,
  tags,
  categories,
  description,
  series,
  problem,
  problemUrl,
  difficulty,
  algorithms,
  timeComplexity,
  spaceComplexity,
  solutionUrl,
}) {
  const lines = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `date: ${date} 00:00:00 +0900`,
    `categories: ${JSON.stringify(categories)}`,
    `tags: ${JSON.stringify(tags)}`,
  ];

  if (description) lines.push(`description: ${JSON.stringify(description)}`);
  if (series) lines.push(`series: ${JSON.stringify(series)}`);
  if (problem) lines.push(`problem: ${JSON.stringify(problem)}`);
  if (problemUrl) lines.push(`problem_url: ${JSON.stringify(problemUrl)}`);
  if (difficulty) lines.push(`difficulty: ${JSON.stringify(difficulty)}`);
  if (algorithms?.length) lines.push(`algorithms: ${JSON.stringify(algorithms)}`);
  if (timeComplexity) lines.push(`time_complexity: ${JSON.stringify(timeComplexity)}`);
  if (spaceComplexity) lines.push(`space_complexity: ${JSON.stringify(spaceComplexity)}`);
  if (solutionUrl) lines.push(`solution_url: ${JSON.stringify(solutionUrl)}`);
  lines.push("---", "", "");
  return lines.join("\n");
}

function parseEnv(content) {
  const trimmed = content.trim();
  if (!trimmed.includes("=")) return { NOTION_KEY: trimmed };

  return Object.fromEntries(
    trimmed
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(line => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

function loadConfig() {
  const envPath = path.join(ROOT, ".env");
  const fileEnv = existsSync(envPath)
    ? parseEnv(readFileSync(envPath, "utf8"))
    : {};
  const notionKey = process.env.NOTION_KEY?.trim() || fileEnv.NOTION_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID?.trim()
    || fileEnv.NOTION_DATABASE_ID
    || DEFAULT_DATABASE_ID;

  if (!notionKey) {
    throw new Error("NOTION_KEY가 없습니다. .env 또는 환경 변수를 설정하세요.");
  }

  return { notionKey, databaseId };
}

function git(args, options = {}) {
  return execFileSync("git", ["-C", ROOT, ...args], options);
}

function prepareRepository() {
  const branch = git(["branch", "--show-current"], { encoding: "utf8" }).trim();
  if (branch !== "main") {
    throw new Error(`main 브랜치에서 실행하세요. 현재 브랜치: ${branch || "(detached)"}`);
  }

  const status = git(["status", "--porcelain"], { encoding: "utf8" }).trim();
  if (status) {
    throw new Error("커밋되지 않은 변경사항이 있습니다. 먼저 커밋하거나 정리하세요.");
  }

  git(["pull", "--ff-only", "origin", "main"], { stdio: "inherit" });
  const [ahead, behind] = git(
    ["rev-list", "--left-right", "--count", "HEAD...origin/main"],
    { encoding: "utf8" },
  ).trim().split(/\s+/).map(Number);

  if (ahead !== 0 || behind !== 0) {
    throw new Error(`origin/main과 동기화되지 않았습니다. ahead=${ahead}, behind=${behind}`);
  }
}

async function getReadyPages(notion, databaseId) {
  const pages = [];
  let startCursor;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: { property: "Status", select: { equals: "Ready" } },
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    });
    pages.push(...response.results);
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

function imageExtension(url, contentType) {
  const fromType = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
  }[contentType?.split(";")[0].toLowerCase()];
  if (fromType) return fromType;

  const fromPath = path.extname(new URL(url).pathname).slice(1).toLowerCase();
  return /^(gif|jpe?g|png|svg|webp)$/.test(fromPath) ? fromPath : "bin";
}

export async function localizeImages(markdown, slug, fetchImpl = fetch) {
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  const matches = [...markdown.matchAll(imagePattern)].filter(match => {
    try {
      return NOTION_IMAGE_HOST.test(new URL(match[2]).hostname);
    } catch {
      return false;
    }
  });
  const replacements = new Map();
  const assets = [];

  for (const match of matches) {
    const url = match[2];
    if (replacements.has(url)) continue;

    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Notion 이미지 다운로드 실패 (${response.status}): ${new URL(url).hostname}`);
    }

    const extension = imageExtension(url, response.headers.get("content-type"));
    const relativePath = `assets/img/posts/${slug}/image-${assets.length + 1}.${extension}`;
    const buffer = Buffer.from(await response.arrayBuffer());
    replacements.set(url, `/${relativePath}`);
    assets.push({ relativePath, buffer });
  }

  const body = markdown.replace(imagePattern, (full, alt, url) => {
    const replacement = replacements.get(url);
    return replacement ? `![${alt}](${replacement})` : full;
  });

  return { body, assets };
}

export function pageProperties(page) {
  const props = page.properties;
  const richText = prop => prop?.rich_text?.map(text => text.plain_text).join("") ?? "";
  return {
    title: props.Title?.title?.[0]?.plain_text ?? "untitled",
    date: formatDate(props.Date?.date?.start ?? page.created_time),
    tags: props.Tags?.multi_select?.map(tag => tag.name) ?? [],
    categories: props.Categories?.multi_select?.map(category => category.name) ?? [],
    description: richText(props.Description),
    series: props.Series?.select?.name ?? "",
    problem: richText(props.Problem),
    problemUrl: props.ProblemURL?.url ?? "",
    difficulty: props.Difficulty?.select?.name ?? "",
    algorithms: props.Algorithms?.multi_select?.map(item => item.name) ?? [],
    timeComplexity: richText(props.TimeComplexity),
    spaceComplexity: richText(props.SpaceComplexity),
    solutionUrl: props.SolutionURL?.url ?? "",
  };
}

function tracked(relativePath) {
  try {
    git(["ls-files", "--error-unmatch", "--", relativePath], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function assertExistingFile(relativePath, expected) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!existsSync(absolutePath)) return false;
  const actual = readFileSync(absolutePath);
  const expectedBuffer = Buffer.isBuffer(expected) ? expected : Buffer.from(expected);

  if (!actual.equals(expectedBuffer) || !tracked(relativePath)) {
    throw new Error(`기존 파일과 발행 내용이 충돌합니다: ${relativePath}`);
  }
  return true;
}

async function preparePage(page, n2m) {
  const properties = pageProperties(page);
  const slug = slugify(properties.title) || `untitled-${page.id.replace(/-/g, "").slice(0, 8)}`;
  const filename = `${properties.date}-${slug}.md`;
  const postPath = `_posts/${filename}`;
  const mdBlocks = await n2m.pageToMarkdown(page.id);
  const markdown = n2m.toMarkdownString(mdBlocks).parent;
  // 이미지 디렉터리도 포스트 파일명과 같은 date-slug 조합으로 충돌을 방지
  const localized = await localizeImages(markdown, `${properties.date}-${slug}`);
  const content = buildFrontmatter(properties) + localized.body;

  return {
    pageId: page.id,
    title: properties.title,
    postPath,
    content,
    assets: localized.assets,
  };
}

function assertNoPathCollisions(items) {
  const paths = new Set();
  for (const item of items) {
    for (const relativePath of [item.postPath, ...item.assets.map(asset => asset.relativePath)]) {
      if (paths.has(relativePath)) {
        throw new Error(`여러 페이지가 같은 파일을 생성합니다: ${relativePath}`);
      }
      paths.add(relativePath);
    }
  }
}

function writePrepared(items) {
  const files = items.flatMap(item => [
    { relativePath: item.postPath, content: item.content, encoding: "utf8" },
    ...item.assets.map(asset => ({
      relativePath: asset.relativePath,
      content: asset.buffer,
    })),
  ]);
  const pending = files.filter(file => (
    !assertExistingFile(file.relativePath, file.content)
  ));

  for (const file of pending) {
    const absolutePath = path.join(ROOT, file.relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, file.content, file.encoding);
  }

  return pending.map(file => file.relativePath);
}

async function markPublished(notion, items) {
  for (const item of items) {
    await notion.pages.update({
      page_id: item.pageId,
      properties: { Status: { select: { name: "Published" } } },
    });
    console.log(`  ✅ Published: ${item.title}`);
  }
}

async function main() {
  prepareRepository();
  const { notionKey, databaseId } = loadConfig();
  const notion = new Client({ auth: notionKey });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  console.log("📋 Ready 상태 글 확인 중...");
  const pages = await getReadyPages(notion, databaseId);
  if (pages.length === 0) {
    console.log("✅ Ready 상태 글이 없습니다.");
    return;
  }

  console.log(`📝 ${pages.length}개 발견\n`);
  const prepared = [];
  for (const page of pages) {
    console.log(`  변환 중: ${pageProperties(page).title}`);
    prepared.push(await preparePage(page, n2m));
  }

  assertNoPathCollisions(prepared);
  const written = writePrepared(prepared);

  if (written.length > 0) {
    const message = prepared.length === 1
      ? `feat(post): ${prepared[0].title}`
      : `feat(post): ${prepared.length}개 글 발행`;

    console.log("\n🚀 Git 커밋 & 푸시 중...");
    git(["add", "--", ...written], { stdio: "inherit" });
    git(["commit", "-m", message], { stdio: "inherit" });
    git(["push", "origin", "main"], { stdio: "inherit" });
  } else {
    console.log("\nℹ️ 파일은 이미 origin/main에 반영되어 있습니다.");
  }

  console.log("\n📌 Notion 상태 갱신 중...");
  await markPublished(notion, prepared);
  console.log("\n✨ 완료!");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  main().catch(error => {
    console.error("❌ 오류:", error.message);
    process.exit(1);
  });
}
