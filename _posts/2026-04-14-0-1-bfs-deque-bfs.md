---
title: "0-1 BFS (Deque BFS) 란?"
date: 2026-04-14 00:00:00 +0900
categories: [algorithm]
tags: [PS]
description: "Deque BFS 설명 및 관련 문제 풀이"
---

## 핵심 요약

간선 가중치가 **0 또는 1**만 존재할 때, 일반 BFS 대신 **deque(양방향 큐)** 를 써서 O(V+E)에 최단경로를 구하는 기법이다. 비용 0인 이동은 deque 앞에, 비용 1인 이동은 deque 뒤에 넣는 것이 전부다.

---

## 개념 설명

### 왜 일반 BFS가 안 되는가?

일반 BFS는 "먼저 방문 = 최단거리" 가 성립하는 이유가, 모든 간선 비용이 동일하기 때문이다. 그런데 어떤 이동은 0초, 어떤 이동은 1초라면 이 전제가 깨진다. 비용 0짜리 이동을 여러 번 해도 총 비용이 안 늘어나므로, 단순 큐로는 "현재 꺼낸 노드가 최소 비용" 임을 보장할 수 없다.

그렇다고 다익스트라를 쓰면 O(E log V)인데, 가중치가 0/1뿐이라면 훨씬 더 단순하고 빠른 방법이 있다.

### 0-1 BFS의 아이디어

핵심은 **"비용 0짜리 이동은 현재 레벨에서 처리한다"** 는 것이다.

- 비용 **0** 인 간선 → 총 비용 그대로이므로 **deque 앞**(`push_front`)에 삽입
- 비용 **1** 인 간선 → 총 비용이 1 증가하므로 **deque 뒤**(`push_back`)에 삽입

이렇게 하면 deque에서 꺼내는 노드는 항상 현재까지의 최소 비용 순서가 보장된다. 다익스트라의 우선순위 큐를 O(1) 삽입 deque으로 대체한 셈이다.

**언제 쓰나?**
- 그래프 간선 가중치가 오직 0과 1만 존재할 때
- 상태공간 탐색에서 어떤 행동은 무료(0), 어떤 행동은 비용 1일 때
- BFS보다 유연하고 다익스트라보다 빠른 풀이가 필요할 때

**시간복잡도**: O(V + E) — 다익스트라의 O(E log V)보다 빠르다

**핵심 패턴 (C++)**

```cpp
#include <bits/stdc++.h>
using namespace std;

const int MAX = 100001;
int dist[MAX];

void bfs01(int start, int end) {
    fill(dist, dist + MAX, INT_MAX);
    deque<int> dq;

    dist[start] = 0;
    dq.push_back(start);

    while (!dq.empty()) {
        int cur = dq.front();
        dq.pop_front();

        // 비용 0인 이동 → deque 앞에
        if (cur * 2 < MAX && dist[cur * 2] > dist[cur]) {
            dist[cur * 2] = dist[cur];
            dq.push_front(cur * 2);
        }

        // 비용 1인 이동 → deque 뒤에
        for (int next : {cur - 1, cur + 1}) {
            if (next >= 0 && next < MAX && dist[next] > dist[cur] + 1) {
                dist[next] = dist[cur] + 1;
                dq.push_back(next);
            }
        }
    }

    cout << dist[end] << "\n";
}
```

---

## 문제에서의 적용

**BOJ 13549**

수빈이는 위치 N에서 출발해 동생이 있는 위치 K에 도달해야 한다. 이동 방법은 세 가지다.

- X → X-1 또는 X+1 : **1초** 소요
- X → 2X 순간이동 : **0초** 소요

가중치가 딱 0과 1이므로, 0-1 BFS가 최적이다. 순간이동(×2)은 비용 0이니 deque 앞, 걷기(±1)는 비용 1이니 deque 뒤에 넣으면 된다.

```cpp
while (!dq.empty()) {
    int cur = dq.front();
    dq.pop_front();

    if (cur == K) {
        cout << dist[K];
        return;
    }

    // 순간이동: 0초 → 앞에
    if (cur * 2 <= 100000 && dist[cur * 2] > dist[cur]) {
        dist[cur * 2] = dist[cur];
        dq.push_front(cur * 2);
    }

    // 걷기: 1초 → 뒤에
    for (int nx : {cur - 1, cur + 1}) {
        if (nx >= 0 && nx <= 100000 && dist[nx] > dist[cur] + 1) {
            dist[nx] = dist[cur] + 1;
            dq.push_back(nx);
        }
    }
}
```

**포인트**: N >= K이면 순간이동이 무의미하므로 단순히 N - K가 답이다.

---

## 주의할 점 / 흔한 실수

- **실수 1: 범위 초과** — `cur * 2`가 100000을 넘을 수 있으니 반드시 범위 체크
- **실수 2: dist 초기화 안 함** — INT_MAX로 초기화하지 않으면 오답 또는 무한루프
- **실수 3: 음수 위치** — `cur - 1`이 0 미만이 될 수 있으니 `nx >= 0` 조건 필수
- **실수 4: 일반 BFS로 풀기** — 비용이 0/1 혼재인데 queue만 쓰면 최단경로 보장 안 됨
- **실수 5: cur * 2 오버플로우** — 이 문제는 최대 100000이라 괜찮으나 일반적으론 주의

---

## 추가로 알면 좋은 것

**다익스트라와의 관계**: 0-1 BFS는 가중치가 0/1로 제한된 다익스트라의 특수 케이스다. 가중치 범위가 0~K로 늘어나면 Dial's Algorithm(버킷 큐)을 쓰고, 일반적인 양수 가중치면 다익스트라를 쓴다.

**변형 문제 유형**:
- 격자에서 어떤 칸은 무료 통과, 어떤 칸은 비용 1 → 0-1 BFS
- 문 열기(비용 1) vs 그냥 통과(비용 0) 유형

**연습 추천 문제**:
- BOJ 1261 (알고스팟) — 0-1 BFS 교과서 문제
- BOJ 13913 (숨바꼭질 4) — 경로 복원 추가
