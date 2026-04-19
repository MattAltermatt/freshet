---
title: Try Freshet
description: Thaw any JSON URL into a more useful page. Five live demos — raw JSON in, rendered dashboard out.
---

<style>
  /* Override the Jekyll minimal theme's tight 500px-floated content column for
     this marketing page. The theme styles every <section> with
     `width:500px; float:right;` and pins the sidebar <header> with
     `position:fixed`, which jointly squish demo blocks into an unreadable column.
     For /try/ we want the full viewport: drop the sidebar, unfloat the content,
     widen the wrapper. The install banner below already carries the brand. */
  body { padding: 24px !important; }
  .wrapper { width: auto !important; max-width: 1100px !important; margin: 0 auto !important; padding: 0 !important; }
  .wrapper > header { display: none !important; }
  .wrapper > section { width: auto !important; max-width: none !important; float: none !important; padding-bottom: 32px !important; }

  .try-hero { text-align:center; padding:24px 0 8px; max-width:880px; margin:0 auto; }
  .try-hero h1 { margin:0 0 6px; font-size:32px; }
  .try-hero p { margin:0; color:#656d76; }
  .try-note {
    margin:18px auto;
    max-width:880px;
    background:#fff8c5;
    border:1px solid #d4a72c;
    border-radius:6px;
    padding:10px 14px;
    font-size:13px;
    color:#7d4e00;
  }
  .try-demo {
    margin:32px auto;
    max-width:880px;
    border:1px solid #d0d7de;
    border-radius:10px;
    overflow:hidden;
    background:#ffffff;
  }
  .try-demo__head {
    padding:14px 18px;
    background:#f6f8fa;
    border-bottom:1px solid #d0d7de;
    display:flex;
    align-items:baseline;
    flex-wrap:wrap;
    gap:8px 14px;
  }
  .try-demo__name { margin:0; font-size:16px; font-weight:600; }
  .try-demo__pattern {
    font-family:ui-monospace,Menlo,monospace;
    font-size:12px;
    color:#656d76;
    background:#ffffff;
    border:1px solid #d0d7de;
    padding:2px 8px;
    border-radius:4px;
  }
  .try-demo__tag {
    font:600 10px/1 ui-monospace,Menlo,monospace;
    text-transform:uppercase;
    letter-spacing:.06em;
    padding:3px 8px;
    border-radius:999px;
  }
  .try-demo__tag--enabled  { background:rgba(26,127,55,.12);  color:#1a7f37; }
  .try-demo__tag--disabled { background:rgba(101,109,118,.12); color:#656d76; }
  .try-demo__body { padding:16px 18px; }
  .try-demo__cols {
    display:grid;
    grid-template-columns:1fr;
    gap:14px;
  }
  @media (min-width:760px) {
    .try-demo__cols { grid-template-columns:1fr 1fr; }
  }
  .try-demo__col {
    /* Critical: lets the grid item shrink below its intrinsic content width.
       Without this, the wide <pre> JSON block forces the left column to its
       natural size and squeezes the screenshot column to a sliver. */
    min-width:0;
  }
  .try-demo__col h3 {
    margin:0 0 6px;
    font:600 11px/1 ui-monospace,Menlo,monospace;
    color:#656d76;
    text-transform:uppercase;
    letter-spacing:.06em;
  }
  .try-demo__json {
    max-height:280px;
    overflow:auto;
    background:#0d1117;
    color:#e6edf3;
    border-radius:6px;
    padding:12px;
    font:12px/1.45 ui-monospace,Menlo,monospace;
    margin:0;
  }
  .try-demo__shot {
    background:#f6f8fa;
    border:1px solid #d0d7de;
    border-radius:6px;
    overflow:hidden;
    line-height:0;
  }
  .try-demo__shot img { display:block; width:100%; height:auto; }
  .try-demo__cta {
    margin-top:14px;
    padding:14px 18px;
    background:#f6f8fa;
    border-top:1px solid #d0d7de;
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    gap:10px 16px;
    font-size:13px;
  }
  .try-demo__cta a.try-link {
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:8px 14px;
    background:#cf222e;
    color:#ffffff;
    border-radius:6px;
    text-decoration:none;
    font-weight:600;
  }
  .try-demo__cta a.try-link:hover { background:#a40e26; }
  .try-demo__cta-needs-ext {
    flex:1 1 100%;
    margin:6px 0 0;
    font-size:12px;
    color:#9a6700;
  }

  /* Install CTA — sits between the hero and the first demo block */
  .try-install {
    max-width:880px;
    margin:24px auto;
    padding:14px 18px;
    background:#fff7ed;
    border:1px solid #ea580c;
    border-left-width:4px;
    border-radius:6px;
    color:#1f2328;
    font-size:14px;
    line-height:1.5;
  }
  .try-install strong { color:#c2410c; }
  .try-install-link {
    display:inline-block;
    margin-top:6px;
    color:#c2410c;
    font-weight:600;
    text-decoration:none;
  }
  .try-install-link:hover { text-decoration:underline; }
  .try-demo__cta details { font-size:12px; color:#656d76; flex:1 1 100%; }
  .try-demo__cta summary { cursor:pointer; padding:6px 0; font-weight:500; }
  .try-demo__cta ol { margin:6px 0 0 18px; padding:0; }
  .try-demo__cta code { background:#f6f8fa; border:1px solid #d0d7de; padding:1px 6px; border-radius:3px; font-size:11px; }
</style>

<div class="try-hero">
  <h1>Thaw any JSON URL into a more useful page</h1>
  <p>Five live demos — fields surfaced, statuses colored, IDs turned into clickable links. <strong>JSON in. Page out.</strong></p>
</div>

<aside class="try-install">
  <strong>You'll need Freshet installed.</strong>
  These demos render through the extension running in your browser. Without it, the
  "Try it live" links open raw JSON — Freshet is what turns it into the styled dashboard
  on the right.
  <br><a class="try-install-link" href="https://github.com/MattAltermatt/freshet#install">Install Freshet (from source) →</a>
</aside>

<!-- ─── Service Health (self-hosted, enabled by default) ─── -->
<article class="try-demo" id="service-health">
  <div class="try-demo__head">
    <h2 class="try-demo__name">Service Health</h2>
    <code class="try-demo__pattern">mattaltermatt.github.io/freshet/examples/services/*</code>
    <span class="try-demo__tag try-demo__tag--enabled">Enabled out of the box</span>
  </div>
  <div class="try-demo__body">
    <div class="try-demo__cols">
      <div class="try-demo__col">
        <h3>Raw JSON</h3>
<pre class="try-demo__json">{
  "name": "Payments",
  "slug": "payments",
  "status": "degraded",
  "uptime30d": 99.92,
  "lastIncidentAt": "2026-04-18T14:22:00Z",
  "oncall": { "name": "Priya Raman", "handle": "@priya" },
  "dependencies": [
    { "name": "Postgres (primary)", "status": "operational" },
    { "name": "Redis (rate-limit)", "status": "degraded" }
  ],
  "recentIncidents": [
    { "id": "INC-2026-001", "title": "Elevated 5xx on /charge…",
      "severity": "sev-2", "openedAt": "2026-04-18T14:22:00Z",
      "resolvedAt": null }
  ],
  "repo": "example/payments-service"
}</pre>
      </div>
      <div class="try-demo__col">
        <h3>Freshet output</h3>
        <div class="try-demo__shot"><img src="{{ '/assets/try/service-health.png' | relative_url }}" alt="Service Health card rendered by Freshet — Payments service with PRODUCTION env chip, status pills, dependencies grid, and recent incidents"></div>
      </div>
    </div>
  </div>
  <div class="try-demo__cta">
    <a class="try-link" href="https://mattaltermatt.github.io/freshet/examples/services/payments.json">Try it live →</a>
    <span>Click → Freshet renders the styled SRE-style health card. The recent-incidents list is clickable; each row navigates to the incident-detail demo below.</span>
  </div>
</article>

<!-- ─── Incident Detail (self-hosted, enabled by default) ─── -->
<article class="try-demo" id="incident-detail">
  <div class="try-demo__head">
    <h2 class="try-demo__name">Incident Detail</h2>
    <code class="try-demo__pattern">mattaltermatt.github.io/freshet/examples/incidents/*</code>
    <span class="try-demo__tag try-demo__tag--enabled">Enabled out of the box</span>
  </div>
  <div class="try-demo__body">
    <div class="try-demo__cols">
      <div class="try-demo__col">
        <h3>Raw JSON</h3>
<pre class="try-demo__json">{
  "id": "INC-2026-001",
  "title": "Elevated 5xx on /charge — Redis rate-limiter saturating",
  "severity": "sev-2",
  "status": "monitoring",
  "openedAt": "2026-04-18T14:22:00Z",
  "service": { "name": "Payments", "slug": "payments" },
  "oncall": { "name": "Priya Raman", "handle": "@priya" },
  "timeline": [
    { "at": "…14:22:00Z", "author": "alertmanager",
      "kind": "alert",  "message": "5xx-rate alert fired…" },
    { "at": "…14:24:30Z", "author": "@priya",
      "kind": "ack",    "message": "Acknowledged. Investigating…" },
    { "at": "…14:34:45Z", "author": "deploybot",
      "kind": "deploy", "message": "Flag rolled to 100%…" }
  ]
}</pre>
      </div>
      <div class="try-demo__col">
        <h3>Freshet output</h3>
        <div class="try-demo__shot"><img src="{{ '/assets/try/incident-detail.png' | relative_url }}" alt="Incident detail page rendered by Freshet — INC-2026-001 with severity + status chips, summary + impact cards, and a kind-coded timeline rail"></div>
      </div>
    </div>
  </div>
  <div class="try-demo__cta">
    <a class="try-link" href="https://mattaltermatt.github.io/freshet/examples/incidents/INC-2026-001.json">Try it live →</a>
    <span>Renders the incident with a kind-coded timeline rail (alert ▸ ack ▸ deploy ▸ update). Breadcrumb back to service is built from <code>service.slug</code> alone — no URL field in the JSON.</span>
  </div>
</article>

<!-- ─── GitHub Repo (real API, disabled by default) ─── -->
<article class="try-demo" id="github-repo">
  <div class="try-demo__head">
    <h2 class="try-demo__name">GitHub Repo</h2>
    <code class="try-demo__pattern">api.github.com/repos/*/*</code>
    <span class="try-demo__tag try-demo__tag--disabled">Disabled by default</span>
  </div>
  <div class="try-demo__body">
    <div class="try-demo__cols">
      <div class="try-demo__col">
        <h3>Raw JSON (truncated)</h3>
<pre class="try-demo__json">{
  "full_name": "facebook/react",
  "description": "The library for web and native user interfaces.",
  "stargazers_count": 234567,
  "forks_count": 47890,
  "open_issues_count": 825,
  "language": "JavaScript",
  "license": { "name": "MIT License", "spdx_id": "MIT" },
  "topics": ["react", "javascript", "frontend", "library", "ui"],
  "owner": { "login": "facebook",
             "avatar_url": "https://avatars.…" },
  "pushed_at": "2026-04-15T23:00:00Z",
  "archived": false
}</pre>
      </div>
      <div class="try-demo__col">
        <h3>Freshet output</h3>
        <div class="try-demo__shot"><img src="{{ '/assets/try/github-repo.png' | relative_url }}" alt="GitHub repo card rendered by Freshet — facebook/react with Active pulse, JavaScript language chip, stat tiles, topic chips, and Issues/PRs/Releases footer"></div>
      </div>
    </div>
  </div>
  <div class="try-demo__cta">
    <a class="try-link" href="https://api.github.com/repos/facebook/react">Try it live →</a>
    <details>
      <summary>How to enable</summary>
      <ol>
        <li>Open Freshet → <strong>Options</strong> → <strong>Rules</strong> tab.</li>
        <li>Find <code>api.github.com</code> / <code>/repos/*/*</code> in the list (it has an "Example" pill).</li>
        <li>Flip the toggle on, then click "Try it live" above.</li>
      </ol>
    </details>
  </div>
</article>

<!-- ─── Pokémon (real API, disabled by default) ─── -->
<article class="try-demo" id="pokemon">
  <div class="try-demo__head">
    <h2 class="try-demo__name">Pokémon (PokéAPI)</h2>
    <code class="try-demo__pattern">pokeapi.co/api/v2/pokemon/*</code>
    <span class="try-demo__tag try-demo__tag--disabled">Disabled by default</span>
  </div>
  <div class="try-demo__body">
    <div class="try-demo__cols">
      <div class="try-demo__col">
        <h3>Raw JSON (truncated)</h3>
<pre class="try-demo__json">{
  "id": 25,
  "name": "pikachu",
  "height": 4,
  "weight": 60,
  "types": [{ "type": { "name": "electric" } }],
  "abilities": [
    { "ability": { "name": "static" },        "is_hidden": false },
    { "ability": { "name": "lightning-rod" }, "is_hidden": true  }
  ],
  "stats": [
    { "base_stat": 35, "stat": { "name": "hp"     } },
    { "base_stat": 90, "stat": { "name": "speed"  } }
  ],
  "sprites": { "other": { "official-artwork": {
    "front_default": "https://…/25.png" } } }
}</pre>
      </div>
      <div class="try-demo__col">
        <h3>Freshet output</h3>
        <div class="try-demo__shot"><img src="{{ '/assets/try/pokemon.png' | relative_url }}" alt="Pokémon card rendered by Freshet — Pikachu with official artwork, electric type chip, color-coded stat bars, and abilities list"></div>
      </div>
    </div>
  </div>
  <div class="try-demo__cta">
    <a class="try-link" href="https://pokeapi.co/api/v2/pokemon/pikachu">Try it live →</a>
    <details>
      <summary>How to enable</summary>
      <ol>
        <li>Open Freshet → <strong>Options</strong> → <strong>Rules</strong> tab.</li>
        <li>Find <code>pokeapi.co</code> / <code>/api/v2/pokemon/*</code> in the list (it has an "Example" pill).</li>
        <li>Flip the toggle on, then click "Try it live" above.</li>
      </ol>
    </details>
  </div>
</article>

<!-- ─── REST Countries (real API, disabled by default) ─── -->
<article class="try-demo" id="country">
  <div class="try-demo__head">
    <h2 class="try-demo__name">Countries (REST Countries)</h2>
    <code class="try-demo__pattern">restcountries.com/v3.1/name/*</code>
    <span class="try-demo__tag try-demo__tag--disabled">Disabled by default</span>
  </div>
  <div class="try-demo__body">
    <div class="try-demo__cols">
      <div class="try-demo__col">
        <h3>Raw JSON (truncated)</h3>
<pre class="try-demo__json">[{
  "name": { "common": "Japan", "official": "Japan",
            "nativeName": { "jpn": { "common": "日本" } } },
  "capital": ["Tokyo"],
  "region": "Asia",
  "subregion": "Eastern Asia",
  "population": 125836021,
  "area": 377930,
  "languages": { "jpn": "Japanese" },
  "currencies": { "JPY": { "name": "Japanese yen", "symbol": "¥" } },
  "flag": "🇯🇵",
  "flags": { "svg": "https://flagcdn.com/jp.svg" },
  "timezones": ["UTC+09:00"]
}]</pre>
      </div>
      <div class="try-demo__col">
        <h3>Freshet output</h3>
        <div class="try-demo__shot"><img src="{{ '/assets/try/country.png' | relative_url }}" alt="Country card rendered by Freshet — Japan with flag emoji + SVG, native name, capital/population/area metrics, and language/currency chips"></div>
      </div>
    </div>
  </div>
  <div class="try-demo__cta">
    <a class="try-link" href="https://restcountries.com/v3.1/name/japan">Try it live →</a>
    <details>
      <summary>How to enable</summary>
      <ol>
        <li>Open Freshet → <strong>Options</strong> → <strong>Rules</strong> tab.</li>
        <li>Find <code>restcountries.com</code> / <code>/v3.1/name/*</code> in the list (it has an "Example" pill).</li>
        <li>Flip the toggle on, then click "Try it live" above.</li>
      </ol>
      <p style="margin-top:8px">REST Countries returns a top-level <strong>array</strong> of matches. Freshet exposes array-root JSON as <code>items</code>, so the template's first line is <code>{% raw %}{% assign c = items[0] %}{% endraw %}</code> — predictable handle for the rest of the markup.</p>
    </details>
  </div>
</article>

---

[← Back to Freshet home](/freshet/)
