import { match } from '../matcher/matcher';
import { createStorage } from '../storage/storage';

async function boot(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const host = (() => {
    try {
      return url ? new URL(url).hostname : '';
    } catch {
      return '';
    }
  })();

  document.getElementById('url')!.textContent = url;

  const storage = createStorage(chrome.storage);
  const [rules, skipList] = await Promise.all([storage.getRules(), storage.getHostSkipList()]);
  const matched = match(url, rules);
  document.getElementById('rule')!.textContent = matched?.templateName ?? '(none)';

  const skipBox = document.getElementById('skip') as HTMLInputElement;
  skipBox.checked = skipList.includes(host);
  skipBox.addEventListener('change', async () => {
    const next = skipBox.checked
      ? Array.from(new Set([...skipList, host]))
      : skipList.filter((h) => h !== host);
    await storage.setHostSkipList(next);
  });

  document
    .getElementById('open-options')!
    .addEventListener('click', () => chrome.runtime.openOptionsPage());
}

void boot();
