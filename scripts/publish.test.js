import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFrontmatter,
  formatDate,
  localizeImages,
  pageProperties,
  slugify,
} from "./publish.js";

test("slugify handles Korean text and punctuation", () => {
  assert.equal(slugify("벨만-포드: 알고리즘이란?"), "벨만-포드-알고리즘이란");
  assert.equal(slugify("***"), "");
});

test("formatDate accepts ISO dates and falls back for invalid input", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");
  assert.equal(formatDate("2026-04-16T12:00:00.000Z", now), "2026-04-16");
  assert.equal(formatDate("invalid", now), "2026-07-17");
});

test("front matter safely quotes titles, descriptions, and arrays", () => {
  const result = buildFrontmatter({
    title: "제목 \"인용\"",
    date: "2026-07-17",
    tags: ["C++", "a, b"],
    categories: ["dev:log"],
    description: "첫 줄\n둘째 줄",
  });

  assert.match(result, /title: "제목 \\\"인용\\\""/);
  assert.match(result, /tags: \["C\+\+","a, b"\]/);
  assert.match(result, /description: "첫 줄\\n둘째 줄"/);
});

test("PS fields appear in front matter only when present", () => {
  const base = {
    title: "숨바꼭질 3",
    date: "2026-07-17",
    tags: ["PS"],
    categories: ["algorithm"],
  };

  const plain = buildFrontmatter(base);
  assert.doesNotMatch(plain, /series|problem|difficulty|algorithms|complexity|solution_url/);

  const ps = buildFrontmatter({
    ...base,
    series: "그래프 알고리즘",
    problem: "BOJ 13549 — 숨바꼭질 3",
    problemUrl: "https://www.acmicpc.net/problem/13549",
    difficulty: "골드 5",
    algorithms: ["0-1 BFS", "덱"],
    timeComplexity: "O(V+E)",
    spaceComplexity: "O(V)",
    solutionUrl: "https://github.com/example/ps",
  });

  assert.match(ps, /series: "그래프 알고리즘"/);
  assert.match(ps, /problem: "BOJ 13549 — 숨바꼭질 3"/);
  assert.match(ps, /problem_url: "https:\/\/www\.acmicpc\.net\/problem\/13549"/);
  assert.match(ps, /difficulty: "골드 5"/);
  assert.match(ps, /algorithms: \["0-1 BFS","덱"\]/);
  assert.match(ps, /time_complexity: "O\(V\+E\)"/);
  assert.match(ps, /space_complexity: "O\(V\)"/);
  assert.match(ps, /solution_url: "https:\/\/github\.com\/example\/ps"/);
});

test("pageProperties maps Notion PS properties and defaults when absent", () => {
  const page = {
    created_time: "2026-07-17T00:00:00.000Z",
    properties: {
      Title: { title: [{ plain_text: "숨바꼭질 3" }] },
      Series: { select: { name: "그래프 알고리즘" } },
      Problem: { rich_text: [{ plain_text: "BOJ 13549 — 숨바꼭질 3" }] },
      ProblemURL: { url: "https://www.acmicpc.net/problem/13549" },
      Difficulty: { select: { name: "골드 5" } },
      Algorithms: { multi_select: [{ name: "0-1 BFS" }, { name: "덱" }] },
      TimeComplexity: { rich_text: [{ plain_text: "O(V+E)" }] },
    },
  };

  const props = pageProperties(page);
  assert.equal(props.series, "그래프 알고리즘");
  assert.equal(props.problem, "BOJ 13549 — 숨바꼭질 3");
  assert.equal(props.problemUrl, "https://www.acmicpc.net/problem/13549");
  assert.equal(props.difficulty, "골드 5");
  assert.deepEqual(props.algorithms, ["0-1 BFS", "덱"]);
  assert.equal(props.timeComplexity, "O(V+E)");
  assert.equal(props.spaceComplexity, "");
  assert.equal(props.solutionUrl, "");
});

test("Notion-hosted images are converted to deterministic local assets", async () => {
  const png = Uint8Array.from([137, 80, 78, 71]);
  const fetchMock = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "image/png" },
    arrayBuffer: async () => png.buffer,
  });

  const result = await localizeImages(
    "앞 ![배포](https://prod-files-secure.s3.us-west-2.amazonaws.com/image?token=1) 뒤",
    "테스트-글",
    fetchMock,
  );

  assert.equal(result.body, "앞 ![배포](/assets/img/posts/테스트-글/image-1.png) 뒤");
  assert.equal(result.assets[0].relativePath, "assets/img/posts/테스트-글/image-1.png");
  assert.deepEqual(result.assets[0].buffer, Buffer.from(png));
});
