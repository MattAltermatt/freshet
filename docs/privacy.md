---
title: Privacy Policy
permalink: /privacy/
---

# Freshet Privacy Policy

**Last updated: 2026-04-17**

## Summary

Freshet is a Chrome extension that renders JSON responses as user-templated HTML, locally, in your browser. It does not collect, transmit, or share any personal information.

## Data the extension stores

The extension stores **only your own configuration**: the rules and templates you create on the Options page, plus a per-host "skip" toggle from the popup.

This data is stored using Chrome's built-in `chrome.storage` API:

- **`chrome.storage.sync`** by default — synced by Chrome itself, across devices where you are signed into the same Google account, subject to Chrome's own storage limits. If your configuration grows beyond Chrome's ~100 KB sync quota, the extension automatically switches to `chrome.storage.local`, which is stored only on your local device and never synced.
- **`chrome.storage.local`** — stored only on your local device.

Both storage areas are scoped to this extension and are not accessible to other websites or extensions.

## Data the extension does NOT collect

The extension does not:

- Make any network requests of its own
- Send analytics or telemetry to anyone
- Contact external servers
- Track your browsing activity
- Read or transmit page content for any purpose other than rendering it locally according to your configured rules
- Embed any third-party SDKs, trackers, or advertising

## How the content script works

When a page loads, the extension's content script reads the page's text and checks whether any rule you configured matches the page URL. If a match is found and the page contains valid JSON, the extension renders it according to your template. **All processing happens in your browser. Nothing is sent anywhere.**

## Permissions and why they are needed

| Permission | Purpose |
|---|---|
| `storage` | Persist your rules and templates locally and via Chrome's sync. |
| `tabs` | The popup reads the active tab's URL to show match status and the per-host skip toggle. |
| `<all_urls>` (host permission) | The content script must be able to inspect arbitrary pages so it can apply the user-configured rules you set up. |

## Data you can export, share, or delete

- **Delete:** uninstalling the extension from `chrome://extensions` clears all extension storage. You may also clear individual rules and templates from the Options page.
- **Sharing:** the extension does not share data with anyone. A future export feature may allow you to manually export your templates as files; if/when that ships, it will include a "scrub before share" dialog that gives you control over what is included.

## Third parties

There are no third-party services, analytics, advertising, or telemetry providers integrated into this extension.

## Changes to this policy

If this policy materially changes, the "Last updated" date at the top of this page will be revised, and the changes will be summarized in the [project changelog](https://github.com/MattAltermatt/freshet/releases).

## Contact

Questions, concerns, or reports of policy violations:

- **GitHub Issues** (preferred): [github.com/MattAltermatt/freshet/issues](https://github.com/MattAltermatt/freshet/issues)
- **Email** (for private or security matters only): altermatt@gmail.com
