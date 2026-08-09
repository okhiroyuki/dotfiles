(function () {
  'use strict';

  const BUTTON_ID = 'ghv-view-html-button';
  let lastPathname = '';

  function removeButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();
  }

  function injectButton() {
    if (!GHV.isHtmlBlobPage(location.pathname)) return;
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'ghv-view-html-button';
    button.textContent = 'HTMLとして表示';
    button.addEventListener('click', onClick);
    document.body.appendChild(button);
  }

  async function onClick() {
    const button = document.getElementById(BUTTON_ID);
    const rawUrl = GHV.toRawUrl(location.href);
    const fileName = GHV.deriveFileName(location.pathname);

    button.disabled = true;
    button.textContent = '読み込み中…';

    try {
      const response = await fetch(rawUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const rawHtml = await response.text();
      const html = GHV.withBaseHref(rawHtml, rawUrl);
      const id = crypto.randomUUID();

      await chrome.storage.local.set({
        [id]: { html, source: location.href, fileName },
      });

      window.open(`${chrome.runtime.getURL('viewer.html')}?id=${id}`, '_blank', 'noopener');
    } catch (error) {
      alert(`HTMLの取得に失敗しました: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = 'HTMLとして表示';
    }
  }

  function handleNavigation() {
    if (location.pathname === lastPathname) return;
    lastPathname = location.pathname;
    removeButton();
    injectButton();
  }

  handleNavigation();
  setInterval(handleNavigation, 500);
  document.addEventListener('turbo:load', handleNavigation);
  document.addEventListener('pjax:end', handleNavigation);
})();
