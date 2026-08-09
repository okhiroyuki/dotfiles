(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const filenameEl = document.getElementById('ghv-filename');
  const sourceLinkEl = document.getElementById('ghv-source-link');
  const frameEl = document.getElementById('ghv-frame');
  const sourceEl = document.getElementById('ghv-source');
  const toggleButton = document.getElementById('ghv-toggle-source');

  function showError(message) {
    filenameEl.textContent = message;
    frameEl.hidden = true;
    toggleButton.hidden = true;
    sourceLinkEl.hidden = true;
  }

  if (!id) {
    showError('表示するデータが見つかりません。GitHubのファイルページから開き直してください。');
    return;
  }

  chrome.storage.local.get(id, (items) => {
    const data = items[id];
    if (!data) {
      showError('プレビューデータが見つかりません。GitHubのファイルページから開き直してください。');
      return;
    }

    filenameEl.textContent = data.fileName;
    filenameEl.title = data.source;
    sourceLinkEl.href = data.source;
    frameEl.srcdoc = data.html;
    sourceEl.textContent = data.html;

    chrome.storage.local.remove(id);

    let showingSource = false;
    toggleButton.addEventListener('click', () => {
      showingSource = !showingSource;
      frameEl.hidden = showingSource;
      sourceEl.hidden = !showingSource;
      toggleButton.textContent = showingSource ? 'プレビューを表示' : 'ソースを表示';
    });
  });
})();
