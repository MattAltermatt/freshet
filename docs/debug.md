---
title: Debugging templates
description: How to inspect the parsed JSON while authoring a Freshet template — the __root handle and the json / tree filters.
permalink: /debug/
---

# Debugging templates

When you're writing a template against an unfamiliar API response, the first move is usually *"what's actually in this thing?"* — what fields exist, what shape the arrays take, where the values you care about live. Freshet ships three small helpers that make that fast.

> 💡 **Try it without setup.** A template named **`json-debug`** is bundled on every install. Open the **Templates** tab → pick `json-debug` → paste any JSON into the **Sample JSON** pane. The preview shows all three debug views side-by-side. Copy whichever pattern you want into your own template.

## The `__root` handle

Inside a template, top-level fields of an object root are spread directly into the Liquid context — that's why `{% raw %}{{ id }}{% endraw %}` works without any `root.` prefix. The trade-off is that there's no single name for the whole root object.

`__root` fixes that. It's a debug handle that always points at the parsed JSON, no matter the root shape:

| Root shape | `__root` resolves to |
|---|---|
| Object (`{ "id": 1, ... }`) | the whole object |
| Array (`[{...}, {...}]`) | the whole array (same as `items`) |
| Primitive (`"hello"`, `42`) | the value |

So `{% raw %}{{ __root | json }}{% endraw %}` always gives you the full payload, regardless of whether the API returned an object or an array.

If your payload happens to contain a literal `__root` key, the debug handle takes precedence — the spread runs first and the explicit `__root` injection wins. This is the desired behavior for debugging.

## The three debug filters

All three are filters you pipe `__root` (or any subtree) through. They differ in **how the dump looks**, not in what data they show.

### `json` — compact one-liner

{% raw %}
```liquid
<pre>{{ __root | json }}</pre>
```
{% endraw %}

```
{"id":"user_42","name":"Ada Lovelace","tags":["pioneer","mathematician"]...}
```

**Use when:** the payload is tiny, you want to confirm the exact shape, or you're going to copy/paste the dump into another tool.

**Skip when:** the payload is more than ~10 fields — it becomes unreadable on one line.

### `json: 2` — pretty-printed text

{% raw %}
```liquid
<pre>{{ __root | json: 2 }}</pre>
```
{% endraw %}

```
{
  "id": "user_42",
  "name": "Ada Lovelace",
  "tags": [
    "pioneer",
    "mathematician"
  ]
}
```

The `2` is the indent — `json: 4` works too, but two spaces is the conventional default.

**Use when:** the payload is medium (a few dozen fields), you want to read the structure top-to-bottom, or you want to grep within the rendered preview for specific keys.

**Skip when:** the payload is huge — you'll be scrolling forever to find the field you actually care about.

### `tree` — collapsible interactive view

{% raw %}
```liquid
{{ __root | tree }}
```
{% endraw %}

Renders a clickable tree with native `<details>`/`<summary>` toggles — no JavaScript involved. Top two levels open by default; click any triangle to expand or collapse a node. Each value is color-coded by type: orange keys, green strings, blue numbers, purple booleans, gray nulls.

**Use when:** the payload is large or deeply nested. You can collapse branches you don't care about and zoom into the one you do.

**Skip when:** you're going to copy/paste the output anywhere else (the rendered HTML doesn't paste as JSON).

#### Optional max-depth argument

{% raw %}
```liquid
{{ __root | tree: 3 }}
```
{% endraw %}

Limits how deep the recursion goes. Beyond the cap, the branch is replaced with a `…` summary node showing only its size (`{4}` or `[12]`). Default cap is 50, which effectively means "unlimited" for any realistic payload.

## Picking between the three

| Payload size | First reach for |
|---|---|
| ≤ 10 fields | `json` (compact) |
| 10–50 fields | `json: 2` (pretty) |
| 50+ fields, or anything deeply nested | `tree` (collapsible) |

If you're not sure, start with `tree` — collapsing branches you don't need is faster than scrolling through pretty-printed text.

## Drilling into a subtree

All three filters accept any value, not just `__root`. So when you've found the part of the payload you care about, narrow the dump:

{% raw %}
```liquid
{{ user.address | json: 2 }}
{{ history | tree }}
{{ items[0].metrics | json }}
```
{% endraw %}

This is often the workflow:

1. `{% raw %}{{ __root | tree }}{% endraw %}` — survey the whole shape.
2. Copy the dotted path of the subtree you actually need.
3. Replace `__root` with that path so the debug view stays focused.

## Sanitizer guarantees

All three filter outputs go through Freshet's sanitizer (`<script>`, `<iframe>`, `on*=` handlers, and `javascript:`/`data:` URLs are stripped on the way out). String values that contain HTML-like content (`<b>hi</b>`) are HTML-escaped before being shown — what you see in the dump is the literal characters, never an injected element.

## Removing the dump before you ship

The debug filters are perfectly safe to leave in a template — they're just extra HTML — but they're noise once you've stopped iterating. The conventional cleanup pattern is to wrap the dump in a `{% raw %}{% if vars.debug %}{% endraw %}` guard:

{% raw %}
```liquid
{% if vars.debug %}
  <details><summary>Debug</summary>{{ __root | tree }}</details>
{% endif %}
```
{% endraw %}

Then the dump only appears when the matching rule has a `debug=1` (or any truthy value) variable. Toggle it on per-rule when you need to revisit, off when you don't.
