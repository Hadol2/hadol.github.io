# Hadol_s

개발 기록, 프로젝트, PS 풀이를 남기는 개인 기술 블로그.

**[→ hadol2.github.io](https://hadol2.github.io)**

---

## Stack

- **Jekyll** — 정적 사이트 생성
- **GitHub Pages** — 호스팅 및 자동 배포
- **Notion** — 글 작성 에디터

## 로컬 실행

```bash
bundle install
bundle exec jekyll serve
# http://localhost:4000
```

## 글 발행

최초 한 번 의존성과 환경 변수를 준비한다.

```bash
cd scripts
npm ci
cd ..
cp .env.example .env
```

`.env`의 `NOTION_KEY`와 `NOTION_DATABASE_ID`를 실제 값으로 바꾼다. 이후
노션 Posts DB에서 글의 Status를 `Ready`로 변경하고 실행한다.

```bash
node scripts/publish.js
```

발행 전에는 `main` 브랜치의 작업 트리가 깨끗해야 한다. 스크립트는
Notion → Markdown 변환, 임시 이미지의 로컬 저장, `_posts/` 커밋과 푸시를
완료한 다음 Notion 상태를 `Published`로 변경한다.

푸시에 실패하면 Notion 상태는 `Ready`로 유지된다. Git 문제를 해결해
`origin/main`과 동기화한 다음 스크립트를 다시 실행하면 된다.

### 시리즈

글을 시리즈로 묶으려면 노션 Posts DB에 `Series`(Select) 속성을 채운다.
같은 시리즈의 글이 날짜순으로 포스트 하단에 목록으로 표시된다.

### PS 글 속성

PS 풀이 글은 노션 Posts DB에 아래 속성을 추가로 채우면 포스트 상단에
문제 정보 박스가 표시된다. 모두 선택 사항이며 빈 값은 생략된다.

| Notion 속성       | 타입         | front matter       | 예시                                    |
| ----------------- | ------------ | ------------------ | --------------------------------------- |
| `Problem`         | Text         | `problem`          | `BOJ 13549 — 숨바꼭질 3`                 |
| `ProblemURL`      | URL          | `problem_url`      | `https://www.acmicpc.net/problem/13549` |
| `Difficulty`      | Select       | `difficulty`       | `골드 5`                                 |
| `Algorithms`      | Multi-select | `algorithms`       | `0-1 BFS`, `덱`                          |
| `TimeComplexity`  | Text         | `time_complexity`  | `O(V+E)`                                 |
| `SpaceComplexity` | Text         | `space_complexity` | `O(V)`                                   |
| `SolutionURL`     | URL          | `solution_url`     | 풀이 코드 GitHub 링크                    |

`problem`·`difficulty`·`algorithms` 중 하나라도 있는 글은 `/problems/`
페이지에 자동으로 목록화되며 난이도·알고리즘 필터로 걸러볼 수 있다.

발행 스크립트 테스트:

```bash
npm test --prefix scripts
```

## 프로젝트

프로젝트는 `_projects/` 컬렉션으로 관리한다. 파일 하나가 카드 하나이며,
상세 페이지(`/projects/<파일명>/`)가 자동 생성된다.

```markdown
---
name: "프로젝트 이름"
desc: "한 줄 설명"
year: 2025
status: wip # done | wip
featured: true # 홈 화면 노출 여부
tags: [Jekyll, SCSS]
links:
  github: "https://github.com/..."
  demo: "https://..." # 선택
  post: "/posts/..." # 개발기 링크, 선택
---

상세 페이지 본문 (마크다운)
```

## License

[MIT](./LICENSE)
