// Token Radar's page: it reads window.RADAR (the snapshot's scored board, written by main.ts), and
// renders the board, the live-token comparables, the methodology and one protocol's detail view. No
// fetch, no network, no outside asset: every figure on the page comes from the data file beside it.
(function () {
  'use strict';
  var data = window.RADAR;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // ------------------------------------------------------------ formatting
  function usd(n) {
    if (n == null) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function usdFull(n) {
    if (n == null) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(x) {
    if (x == null) return '—';
    return (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1) + '%';
  }
  function ageFmt(days) {
    if (days == null) return '—';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return days + 'd';
  }
  function mult(x) { return '×' + x.toFixed(3); }
  function dateFmt(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00Z');
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  // ------------------------------------------------------------ state
  var state = { tab: 'board', q: '', category: '', chain: '', min: 0, wl: false, sort: 'rank', dir: 1, p: '' };
  function readHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    state.tab = h.get('tab') || 'board';
    state.q = h.get('q') || '';
    state.category = h.get('category') || '';
    state.chain = h.get('chain') || '';
    state.min = parseInt(h.get('min') || '0', 10) || 0;
    state.wl = h.get('wl') === '1';
    state.sort = h.get('sort') || 'rank';
    state.dir = h.get('dir') === '-1' ? -1 : 1;
    state.p = h.get('p') || '';
    if (['board', 'live', 'method'].indexOf(state.tab) < 0) state.tab = 'board';
  }
  function writeHash() {
    var h = new URLSearchParams();
    if (state.tab !== 'board') h.set('tab', state.tab);
    if (state.q) h.set('q', state.q);
    if (state.category) h.set('category', state.category);
    if (state.chain) h.set('chain', state.chain);
    if (state.min) h.set('min', String(state.min));
    if (state.wl) h.set('wl', '1');
    if (state.sort !== 'rank') h.set('sort', state.sort);
    if (state.dir === -1) h.set('dir', '-1');
    if (state.p) h.set('p', state.p);
    var s = h.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
  }

  // ------------------------------------------------------------ header, stats, spotlight
  function renderMeta() {
    $('meta').innerHTML =
      '<div><dt>Snapshot</dt><dd>' + esc(dateFmt(data.as_of)) + '</dd></div>' +
      '<div><dt>Source</dt><dd>' + esc(data.source.split(' http')[0]) + '</dd></div>' +
      '<div><dt>Model</dt><dd>' + esc(data.model_version) + '</dd></div>' +
      '<div><dt>Watchlist floor</dt><dd>' + esc(usd(data.floor_usd)) + '</dd></div>';
  }
  function renderStats() {
    var total = data.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    $('stats').innerHTML =
      stat(usd(total), 'total implied value across the board') +
      stat(data.watchlist_size + ' / ' + data.watchlist_size, 'watchlist protocols covered') +
      stat(String(data.board_size), 'pre-token protocols ranked (' + data.early_size + ' early)') +
      stat(String(data.live_size), 'live-token protocols set aside') +
      stat(mult(data.global_multiple), 'global median mcap / TVL');
    function stat(b, label) { return '<div class="stat"><b>' + esc(b) + '</b><span>' + esc(label) + '</span></div>'; }
  }
  function renderSpotlight() {
    var top = data.rows.slice(0, 3);
    var max = top.length ? top[0].implied_value_usd : 1;
    $('spotlight').innerHTML = top.map(function (r, i) {
      var w = Math.max(4, Math.round((r.implied_value_usd / max) * 100));
      return '<button type="button" class="spot" data-slug="' + esc(r.slug) + '">' +
        '<span class="rank">Rank ' + r.rank + (r.is_watchlist ? ' · Watchlist' : ' · Early') + '</span>' +
        '<h3>' + esc(r.name) + '</h3>' +
        '<p class="cat">' + esc(r.category || 'Other') + ' · TVL ' + esc(usd(r.tvl_usd)) + '</p>' +
        '<div class="val">' + esc(usd(r.implied_value_usd)) + '</div>' +
        '<div class="bar"><i style="width:' + w + '%"></i></div>' +
        '<p class="sub">Implied at ' + esc(mult(r.category_multiple)) + ' of TVL' +
        (r.change_7d != null ? ' · 7d ' + esc(pct(r.change_7d)) : '') + '</p>' +
        '</button>';
    }).join('');
  }

  // ------------------------------------------------------------ board
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return data.rows.filter(function (r) {
      if (state.wl && !r.is_watchlist) return false;
      if (state.min && r.implied_value_usd < state.min) return false;
      if (state.category && (r.category || 'Other') !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
  }
  var SORTS = {
    rank: function (a, b) { return a.rank - b.rank; },
    name: function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; },
    category: function (a, b) { return (a.category || '') < (b.category || '') ? -1 : 1; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    change: function (a, b) { return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d); },
    age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); },
    implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
  };
  function renderBoard() {
    var rows = filteredRows();
    var sortFn = SORTS[state.sort] || SORTS.rank;
    rows = rows.slice().sort(function (a, b) { return sortFn(a, b) * state.dir; });
    var body = $('board-body');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="9"><div class="empty">No protocol matches these filters. Loosen one and the board comes back.</div></td></tr>';
    } else {
      body.innerHTML = rows.map(function (r) {
        var chg = r.change_7d == null ? '<span class="muted">—</span>' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + esc(pct(r.change_7d)) + '</span>';
        return '<tr data-slug="' + esc(r.slug) + '">' +
          '<td class="num">' + r.rank + '</td>' +
          '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || 'Other') + '</td>' +
          '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
          '<td class="num">' + esc(usd(r.tvl_usd)) + '</td>' +
          '<td class="num">' + chg + '</td>' +
          '<td class="num">' + esc(ageFmt(r.age_days)) + '</td>' +
          '<td class="num"><strong>' + esc(usd(r.implied_value_usd)) + '</strong></td>' +
          '<td>' + (r.is_watchlist ? '<span class="badge watch">Watchlist</span>' : '<span class="badge">Early</span>') + '</td>' +
          '</tr>';
      }).join('');
    }
    $('count').textContent = 'Showing ' + rows.length + ' of ' + data.rows.length + ' rows · sorted by ' + state.sort + (state.dir === -1 ? ' (descending)' : ' (ascending)');
    var ths = document.querySelectorAll('#board th[data-sort]');
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      th.setAttribute('aria-sort', th.getAttribute('data-sort') === state.sort ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
    }
  }
  function fillFilters() {
    var cats = {}, chains = {};
    data.rows.forEach(function (r) {
      cats[r.category || 'Other'] = (cats[r.category || 'Other'] || 0) + 1;
      r.chains.forEach(function (c) { chains[c] = (chains[c] || 0) + 1; });
    });
    $('f-category').innerHTML = '<option value="">All categories</option>' + Object.keys(cats).sort().map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + ' (' + cats[c] + ')</option>';
    }).join('');
    $('f-chain').innerHTML = '<option value="">All chains</option>' + Object.keys(chains).sort().map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + ' (' + chains[c] + ')</option>';
    }).join('');
    $('f-q').value = state.q;
    $('f-min').value = String(state.min);
    $('f-watchlist').checked = state.wl;
  }

  // ------------------------------------------------------------ live view
  function renderLive() {
    $('live-body').innerHTML = data.live.map(function (p) {
      var ratio = p.mcap_usd != null && p.tvl_usd > 0 ? (p.mcap_usd / p.tvl_usd).toFixed(3) : '—';
      var chg = p.change_7d == null ? '—' : '<span class="' + (p.change_7d >= 0 ? 'pos' : 'neg') + '">' + esc(pct(p.change_7d)) + '</span>';
      return '<tr>' +
        '<td><span class="name">' + esc(p.name) + '</span><br><span class="slug">' + esc(p.slug) + '</span></td>' +
        '<td>' + esc(p.category || 'Other') + '</td>' +
        '<td>' + esc(p.chains.slice(0, 2).join(', ')) + (p.chains.length > 2 ? ' +' + (p.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + esc(usd(p.tvl_usd)) + '</td>' +
        '<td class="num">' + chg + '</td>' +
        '<td class="num">' + esc(usd(p.mcap_usd)) + '</td>' +
        '<td class="num">' + esc(ratio) + '</td>' +
        '</tr>';
    }).join('');
  }

  // ------------------------------------------------------------ methodology
  function renderMethod() {
    var m = data.model;
    var compRows = data.comparables.map(function (c) {
      return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.n + '</td><td class="num">' + esc(mult(c.median)) + '</td><td class="num">' + esc(mult(c.multiple)) + '</td><td>' + (c.source === 'category' ? 'Category median' : 'Global median') + '</td></tr>';
    }).join('');
    $('method-body').innerHTML =
      '<div class="method">' +
      '<p><strong>Implied value = TVL × category multiple × growth × maturity × breadth.</strong> Every factor comes from the snapshot: nothing is typed in by hand, and no protocol name is ever special-cased — the same function scores all ' + data.board_size + ' rows.</p>' +
      '<div class="formula">implied = round( TVL × <b>categoryMultiple</b> × <b>growthMult</b> × <b>maturityMult</b> × <b>breadthMult</b> )</div>' +
      '<h3>1 · Category multiple — what live tokens are actually worth</h3>' +
      '<p>For each category, the median <strong>market-cap-to-TVL ratio</strong> of the snapshot&rsquo;s live-token protocols in that category (at least ' + m.multiple_min_n + ' of them, market cap and TVL both positive, exchanges excluded). A category with fewer live peers uses the <strong>global median ' + esc(mult(data.global_multiple)) + '</strong> over all ' + data.live_size + ' live protocols shown here. The multiple is clamped to [' + m.multiple_min + ', ' + m.multiple_max + '], so one wild outlier cannot set the price for a whole category.</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Category</th><th class="num">Live peers</th><th class="num">Median mcap / TVL</th><th class="num">Multiple used</th><th>Source</th></tr></thead><tbody>' + compRows + '</tbody></table></div>' +
      '<p>Categories with no row above have fewer than ' + m.multiple_min_n + ' live peers and are priced on the global median. The biggest watchlist category, Risk Curators, has only one live peer, so it is priced on the global median too — a deliberate, stated choice, not a guess hidden in the code.</p>' +
      '<h3>2 · Growth — momentum, capped</h3>' +
      '<p>growthMult = 1 + clamp(change_7d, ' + m.growth_floor + ', +' + m.growth_cap + ') / 100 × ' + m.growth_weight + '. A protocol up 40% in a week scores ×1.20; one down 30% scores ×0.85. The clamp keeps a single week&rsquo;s spike from deciding the rank.</p>' +
      '<h3>3 · Maturity — survival is worth something</h3>' +
      '<p>maturityMult = ' + m.maturity_floor + ' + min(age, ' + m.maturity_days + ' days) / ' + m.maturity_days + ' × ' + m.maturity_range + '. A protocol listed ' + m.maturity_days + ' days ago scores ×1.00; a brand-new one scores ×0.60. Unknown listing date counts as ' + m.unknown_age_days + ' days.</p>' +
      '<h3>4 · Breadth — distribution across chains</h3>' +
      '<p>breadthMult = 1 + ' + m.breadth_per_chain + ' × min(chains − 1, ' + m.breadth_max_chains + '). A protocol on five or more chains scores ×1.20; a single-chain protocol scores ×1.00.</p>' +
      '<h3>Who is on the board</h3>' +
      '<p>The board carries the whole ' + data.watchlist_size + '-protocol watchlist (the floor is ' + esc(usd(data.floor_usd)) + ' of TVL, and every watchlist slug is present), plus the early radar: pre-token protocols below the floor that the watchlist&rsquo;s own rule would keep — no token recorded, no wrapped, staked or bridged product of a token that trades, no versioned pool, no exchange. The live-token protocols are kept apart in the Live token view: they price the board, they are never ranked on it.</p>' +
      '<h3>Farm plans</h3>' +
      '<p>Each protocol&rsquo;s plan is generated from its own record — category, chains, TVL and age — never from a hand-written list of names. Capital scales with TVL ($50–$250), the holding period with age (30–60 days), and the weekly action with the category: supply and borrow for lending, liquidity for a DEX, a vault deposit for a risk curator, a cover purchase for insurance. Every step states its cost and its time.</p>' +
      '<h3>What this is not</h3>' +
      '<p>Implied value is a model of what a token would be worth <em>if</em> it launched at its live peers&rsquo; ratio. It is not a prediction, not a price target, and not advice. A protocol can stay tokenless, launch at a different ratio, or launch and fall. The snapshot is sealed as of ' + esc(dateFmt(data.as_of)) + '; nothing after that date is in these numbers.</p>' +
      '</div>';
  }

  // ------------------------------------------------------------ detail view
  function splitStep(s) {
    var i = s.lastIndexOf(' Cost: ');
    if (i < 0) return { text: s, meta: '' };
    var tail = s.slice(i + 7);
    var mm = tail.match(/^(.*?)\.\s*Time:\s*(.*?)\.?$/);
    return { text: s.slice(0, i), meta: mm ? 'Cost: ' + mm[1] + ' · Time: ' + mm[2] : 'Cost: ' + tail };
  }
  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < data.rows.length; i++) if (data.rows[i].slug === slug) r = data.rows[i];
    var dlg = $('detail');
    if (!r) { if (dlg.open) dlg.close(); return; }
    var comp = null;
    for (var j = 0; j < data.comparables.length; j++) if (data.comparables[j].category === r.category) comp = data.comparables[j];
    var compLine = comp
      ? esc(comp.n) + ' live peers · median ' + esc(mult(comp.median)) + ' · multiple used ' + esc(mult(r.category_multiple))
      : 'Fewer than ' + data.model.multiple_min_n + ' live peers — priced on the global median ' + esc(mult(data.global_multiple));
    var steps = r.farm_steps.map(function (s) {
      var sp = splitStep(s);
      return '<li><b>' + esc(sp.text) + '</b>' + (sp.meta ? '<span class="meta-line">' + esc(sp.meta) + '</span>' : '') + '</li>';
    }).join('');
    $('detail-body').innerHTML =
      '<div class="detail">' +
      '<button type="button" class="close" id="detail-close">Close</button>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="sub">' + esc(r.category || 'Other') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') + ' · ' + (r.is_watchlist ? 'Watchlist' : 'Early radar') + ' · Rank ' + r.rank + ' of ' + data.board_size + '</p>' +
      '<h3>Implied value — how the model gets there</h3>' +
      '<dl class="kv">' +
      '<div><dt>TVL</dt><dd>' + esc(usdFull(r.tvl_usd)) + '</dd></div>' +
      '<div><dt>Category multiple</dt><dd>' + esc(mult(r.category_multiple)) + ' (' + esc(r.category_multiple_source) + ')</dd></div>' +
      '<div><dt>7-day change</dt><dd>' + esc(pct(r.change_7d)) + ' → ' + esc(mult(r.growth_multiplier)) + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + esc(ageFmt(r.age_days)) + (r.listed_at ? ' · listed ' + esc(dateFmt(r.listed_at)) : ' · date unknown') + ' → ' + esc(mult(r.maturity_multiplier)) + '</dd></div>' +
      '<div><dt>Chains</dt><dd>' + r.chains.length + ' → ' + esc(mult(r.breadth_multiplier)) + '</dd></div>' +
      '<div><dt>Implied value</dt><dd class="total">' + esc(usdFull(r.implied_value_usd)) + '</dd></div>' +
      '</dl>' +
      '<h3>Category comparables</h3>' +
      '<p class="sub">' + compLine + '</p>' +
      '<h3>Farm plan — six steps</h3>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<p class="note">The plan is generated from this protocol&rsquo;s own record (category, chains, TVL, age). It is a plan for farming a possible launch, not a guarantee of one.</p>' +
      '</div>';
    $('detail-close').addEventListener('click', function () { setSlug(''); });
    if (!dlg.open) dlg.showModal();
  }
  function setSlug(slug) {
    state.p = slug;
    writeHash();
    render();
  }

  // ------------------------------------------------------------ tabs + render
  function renderTabs() {
    var tabs = document.querySelectorAll('.tabs button');
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute('aria-selected', tabs[i].getAttribute('data-tab') === state.tab ? 'true' : 'false');
    $('view-board').hidden = state.tab !== 'board';
    $('view-live').hidden = state.tab !== 'live';
    $('view-method').hidden = state.tab !== 'method';
  }
  function render() {
    renderTabs();
    if (state.tab === 'board') renderBoard();
    if (state.tab === 'live') renderLive();
    if (state.tab === 'method') renderMethod();
    if (state.p) openDetail(state.p);
    else { var dlg = $('detail'); if (dlg.open) dlg.close(); }
  }

  // ------------------------------------------------------------ events
  function bind() {
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); writeHash(); render(); });
    });
    $('f-q').addEventListener('input', function (e) { state.q = e.target.value; writeHash(); renderBoard(); });
    $('f-category').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); renderBoard(); });
    $('f-chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); renderBoard(); });
    $('f-min').addEventListener('change', function (e) { state.min = parseInt(e.target.value, 10) || 0; writeHash(); renderBoard(); });
    $('f-watchlist').addEventListener('change', function (e) { state.wl = e.target.checked; writeHash(); renderBoard(); });
    document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = 1; }
        writeHash(); renderBoard();
      });
    });
    $('board-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-slug]');
      if (tr) setSlug(tr.getAttribute('data-slug'));
    });
    $('spotlight').addEventListener('click', function (e) {
      var b = e.target.closest('[data-slug]');
      if (b) setSlug(b.getAttribute('data-slug'));
    });
    $('detail').addEventListener('click', function (e) {
      if (e.target === $('detail')) setSlug('');
    });
    $('detail').addEventListener('cancel', function () { setSlug(''); });
    window.addEventListener('hashchange', function () { readHash(); fillFilters(); render(); });
  }

  // ------------------------------------------------------------ boot
  readHash();
  renderMeta();
  renderStats();
  renderSpotlight();
  fillFilters();
  bind();
  render();
})();
