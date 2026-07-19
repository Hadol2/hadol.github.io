/* Hadol — main.js: dark mode + search */

// ── Dark mode ─────────────────────────────────────────────────────
(function () {
  var toggle = document.getElementById('mode-toggle');
  var label  = toggle && toggle.querySelector('.hd-mode-label');

  function stored() { return localStorage.getItem('hd-mode'); }
  function sysDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }

  function current() {
    return stored() || (sysDark() ? 'dark' : 'light');
  }

  function apply(mode) {
    document.documentElement.setAttribute('data-mode', mode);
    if (label) label.textContent = mode === 'dark' ? 'Dark' : 'White';
  }

  apply(current());

  toggle && toggle.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    localStorage.setItem('hd-mode', next);
    apply(next);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!stored()) apply(e.matches ? 'dark' : 'light');
  });
})();

// ── Mobile navigation ─────────────────────────────────────────────
(function () {
  var trigger = document.getElementById('nav-menu-trigger');
  var menu    = document.getElementById('hd-mobile-nav');

  if (!trigger || !menu) return;

  function close(restoreFocus) {
    menu.classList.remove('active');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', '메뉴 열기');
    if (restoreFocus) trigger.focus();
  }

  trigger.addEventListener('click', function () {
    var opening = !menu.classList.contains('active');
    menu.classList.toggle('active', opening);
    trigger.setAttribute('aria-expanded', String(opening));
    trigger.setAttribute('aria-label', opening ? '메뉴 닫기' : '메뉴 열기');
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) close(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('active')) close(true);
  });

  document.addEventListener('click', function (e) {
    if (!menu.contains(e.target) && !trigger.contains(e.target)) close(false);
  });
})();

// ── Code copy button ──────────────────────────────────────────────
(function () {
  var blocks = document.querySelectorAll('.post-content div.highlight');

  blocks.forEach(function (block) {
    var btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.type = 'button';
    btn.textContent = '복사';
    btn.setAttribute('aria-label', '코드 복사');

    btn.addEventListener('click', function () {
      // 라인 번호 테이블이 있으면 .rouge-code에만 실제 코드가 있음
      var code = block.querySelector('.rouge-code') ||
                 block.querySelector('pre code') ||
                 block.querySelector('pre');
      if (!code) return;

      navigator.clipboard.writeText(code.innerText.replace(/\n$/, '')).then(function () {
        btn.textContent = '복사됨!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = '복사';
          btn.classList.remove('copied');
        }, 1500);
      });
    });

    block.appendChild(btn);
  });
})();

// ── Search widget (상단 네비·홈 히어로 공용) ──────────────────────
// 쿼리 문법: 일반 단어는 제목·본문·태그 검색, #토큰은 태그 필터,
// @토큰은 카테고리 필터. 모든 조건은 AND로 결합.
(function () {
  var data = null;
  var loading = null;

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      loading = fetch('/search.json')
        .then(function (r) { return r.json(); })
        .then(function (j) { data = j; return data; })
        .catch(function () { data = []; return data; });
    }
    return loading;
  }

  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function escRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(text, words) {
    if (!words.length) return esc(text);
    var re = new RegExp('(' + words.map(escRegExp).join('|') + ')', 'gi');
    // split의 캡처 그룹 결과에서 홀수 인덱스가 매치된 단어
    return (text || '').split(re).map(function (part, i) {
      return i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part);
    }).join('');
  }

  function parse(q) {
    var words = [], tags = [], cats = [];
    q.toLowerCase().split(/\s+/).forEach(function (tok) {
      if (!tok) return;
      if (tok[0] === '#' && tok.length > 1) tags.push(tok.slice(1));
      else if (tok[0] === '@' && tok.length > 1) cats.push(tok.slice(1));
      else words.push(tok);
    });
    return { words: words, tags: tags, cats: cats };
  }

  window.hdCreateSearch = function (input, resultsEl, container) {
    var box = container || input;
    var active = -1;
    var optId = (resultsEl.id || 'hd-sr') + '-opt-';

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    if (resultsEl.id) input.setAttribute('aria-controls', resultsEl.id);
    resultsEl.setAttribute('role', 'listbox');

    function items() {
      return resultsEl.querySelectorAll('.hd-search-result');
    }

    function setActive(idx) {
      var list = items();
      if (!list.length) return;
      active = (idx + list.length) % list.length;
      list.forEach(function (el, i) {
        el.classList.toggle('active', i === active);
        el.setAttribute('aria-selected', String(i === active));
      });
      input.setAttribute('aria-activedescendant', list[active].id);
      list[active].scrollIntoView({ block: 'nearest' });
    }

    function hide() {
      resultsEl.classList.remove('active');
      resultsEl.innerHTML = '';
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function run(q) {
      var query = parse(q);
      var empty = !query.words.length && !query.tags.length && !query.cats.length;
      if (!data || empty) { hide(); return; }

      var hits = data.filter(function (p) {
        var title   = (p.title      || '').toLowerCase();
        var content = (p.content    || '').toLowerCase();
        var tags    = (p.tags       || '').toLowerCase();
        var cats    = (p.categories || '').toLowerCase();
        return query.tags.every(function (t) { return tags.includes(t); }) &&
               query.cats.every(function (c) { return cats.includes(c); }) &&
               query.words.every(function (w) {
                 return title.includes(w) || content.includes(w) || tags.includes(w);
               });
      }).slice(0, 8);

      if (!hits.length) {
        resultsEl.innerHTML = '<p class="hd-no-results" role="status">검색 결과가 없습니다.</p>';
      } else {
        resultsEl.innerHTML = hits.map(function (p, i) {
          return '<a href="' + p.url + '" class="hd-search-result"' +
                 ' id="' + optId + i + '" role="option" aria-selected="false">' +
                 '<span class="hd-sr-title">' + highlight(p.title, query.words) + '</span>' +
                 '<span class="hd-sr-date">'  + (p.date || '') + '</span>' +
                 '</a>';
        }).join('');
      }
      active = -1;
      input.setAttribute('aria-expanded', 'true');
      input.removeAttribute('aria-activedescendant');
      resultsEl.classList.add('active');
    }

    input.addEventListener('input', function () {
      load().then(function () { run(input.value.trim()); });
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(active + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(active - 1);
      } else if (e.key === 'Enter') {
        var list = items();
        if (!list.length) return;
        e.preventDefault();
        window.location.href = list[active >= 0 ? active : 0].href;
      } else if (e.key === 'Escape') {
        input.value = '';
        hide();
      }
    });

    document.addEventListener('click', function (e) {
      if (!resultsEl.contains(e.target) && !box.contains(e.target)) hide();
    });

    return { load: load, hide: hide, run: run };
  };
})();

// ── Topnav search ─────────────────────────────────────────────────
(function () {
  var trigger  = document.getElementById('search-trigger');
  var bar      = document.getElementById('hd-search-bar');
  var input    = document.getElementById('search-input');
  var closeBtn = document.getElementById('search-close');

  if (!trigger || !bar || !input) return;

  var search = window.hdCreateSearch(input, document.getElementById('search-results'), bar);

  function open() {
    bar.classList.add('active');
    trigger.setAttribute('aria-expanded', 'true');
    search.load().then(function () { input.focus(); });
  }

  function close() {
    bar.classList.remove('active');
    trigger.setAttribute('aria-expanded', 'false');
    search.hide();
    input.value = '';
  }

  trigger.addEventListener('click', function () {
    if (bar.classList.contains('active')) close();
    else open();
  });

  closeBtn && closeBtn.addEventListener('click', function () {
    close();
    trigger.focus();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      open();
    } else if (e.key === 'Escape' && bar.classList.contains('active')) {
      close();
      trigger.focus();
    }
  });
})();

// ── Hero search (홈) ──────────────────────────────────────────────
(function () {
  var input = document.getElementById('hd-hero-input');
  if (!input) return;

  window.hdCreateSearch(
    input,
    document.getElementById('hero-search-results'),
    input.closest('.hd-hero-search-wrap')
  );
})();

// ── Problems filter (/problems/) ──────────────────────────────────
(function () {
  var list = document.getElementById('problem-list');
  if (!list) return;

  var rows  = list.querySelectorAll('.hd-prob-row');
  var empty = document.getElementById('problem-empty');
  var state = { difficulty: null, algorithm: null };

  function apply() {
    var visible = 0;
    rows.forEach(function (row) {
      var algorithms = (row.getAttribute('data-algorithms') || '').split('|');
      var show = (!state.difficulty || row.getAttribute('data-difficulty') === state.difficulty) &&
                 (!state.algorithm  || algorithms.indexOf(state.algorithm) !== -1);
      row.hidden = !show;
      if (show) visible++;
    });
    if (empty) empty.hidden = visible > 0;
  }

  document.querySelectorAll('.hd-prob-filter-group').forEach(function (group) {
    var key = group.getAttribute('data-filter');
    group.querySelectorAll('.hd-prob-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        var value = pill.getAttribute('data-value');
        state[key] = state[key] === value ? null : value;
        group.querySelectorAll('.hd-prob-pill').forEach(function (p) {
          var on = state[key] === p.getAttribute('data-value');
          p.classList.toggle('active', on);
          p.setAttribute('aria-pressed', String(on));
        });
        apply();
      });
    });
  });
})();

// ── Heading anchor links (포스트 헤딩 공유) ───────────────────────
(function () {
  var headings = document.querySelectorAll(
    '.post-content h2[id], .post-content h3[id], .post-content h4[id]'
  );

  headings.forEach(function (heading) {
    var btn = document.createElement('button');
    btn.className = 'heading-anchor';
    btn.type = 'button';
    btn.textContent = '#';
    btn.setAttribute('aria-label', '섹션 링크 복사');

    btn.addEventListener('click', function () {
      var hash = '#' + heading.id;
      history.replaceState(null, '', hash);
      navigator.clipboard.writeText(location.origin + location.pathname + hash).then(function () {
        btn.textContent = '복사됨';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = '#';
          btn.classList.remove('copied');
        }, 1200);
      });
    });

    heading.appendChild(btn);
  });
})();

// ── Reading progress (포스트) ─────────────────────────────────────
(function () {
  var article = document.querySelector('.post-body');
  if (!article) return;

  var bar = document.createElement('div');
  bar.className = 'reading-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  function update() {
    var rect  = article.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    var done  = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
    bar.style.transform = 'scaleX(' + done + ')';
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
})();
