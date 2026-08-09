(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GHV = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isHtmlBlobPage(pathname) {
    return /\/blob\/.+\.html?$/i.test(pathname);
  }

  function toRawUrl(blobUrl) {
    const url = new URL(blobUrl);
    url.pathname = url.pathname.replace('/blob/', '/raw/');
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  function deriveFileName(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'index.html';
  }

  // 相対パスのCSS/JS/画像がraw.githubusercontent.com上の元ファイルを
  // 参照できるよう、<base>タグを埋め込む。
  function withBaseHref(html, rawUrl) {
    const baseUrl = rawUrl.slice(0, rawUrl.lastIndexOf('/') + 1);
    const baseTag = `<base href="${baseUrl}">`;

    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}`);
    }
    if (/<html[^>]*>/i.test(html)) {
      return html.replace(/<html[^>]*>/i, (match) => `${match}${baseTag}`);
    }
    return `${baseTag}${html}`;
  }

  return { isHtmlBlobPage, toRawUrl, deriveFileName, withBaseHref };
});
