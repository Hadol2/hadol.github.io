---
name: "hadol2.github.io"
desc: "개인 개발 블로그"
year: 2025
status: wip
featured: true
tags: [Jekyll, SCSS, GitHub Pages]
links:
  github: "https://github.com/Hadol2/hadol2.github.io"
---

## 무엇을 만들었나

Jekyll로 직접 만든 개인 기술 블로그. 테마를 쓰지 않고 레이아웃과 SCSS를
바닥부터 작성했고, GitHub Pages + GitHub Actions로 자동 배포한다.

## 주요 기능

- **Notion 발행 파이프라인** — 글은 노션에서 쓰고, `scripts/publish.js`가
  Notion API로 Markdown 변환·이미지 저장·커밋·푸시까지 자동 처리
- **PS 풀이 구조** — 문제·난이도·알고리즘·복잡도를 프런트매터로 받아
  포스트 상단에 문제 정보 박스 표시
- **글 시리즈·관련 글 추천** — 시리즈 목록과 태그 기반 관련 글을 빌드
  타임에 생성
- **검색** — `search.json` 기반 클라이언트 검색. 키보드 이동, 검색어 강조,
  `#태그`·`@카테고리` 필터 지원
- **다크 모드** — CSS 변수 + `data-mode` 속성 전환
