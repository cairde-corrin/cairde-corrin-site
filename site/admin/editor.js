// Small fixes to the editor's interface, loaded by site/admin/index.html.
(function () {
  // The Image button in the post body offers "Insert from URL", which would make the
  // public page load a photo from another website. The photo fields switch it off with
  // choose_url: false, but Decap does not pass that setting to the body's Image button,
  // and the URL buttons share their style with the upload buttons, so they are hidden by
  // their text. The build also refuses a page that loads anything from another site.
  //
  // "Delete published entry" and "Unpublish" are hidden the same way. Decap carries both
  // out by committing straight to main, not through a pull request, so once main is
  // protected (docs/SECURITY.md) they can only fail. Editors take a post down with its
  // "Take this off the website" tick instead, which is published like any other change.
  var HIDE = /^(Insert from URL|Replace with URL|Delete published entry|Unpublish)$/;
  new MutationObserver(function () {
    Array.prototype.forEach.call(document.querySelectorAll('button, [role="button"], [role="menuitem"]'), function (b) {
      if (HIDE.test(b.textContent.trim())) b.style.display = 'none';
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // A Help button on every editor screen, opening the editor guide (admin/help/) in a new tab
  var help = document.createElement('a');
  help.href = '/admin/help/'; help.target = '_blank'; help.rel = 'noopener';
  help.textContent = 'Help'; help.setAttribute('aria-label', 'Help: how to use the editor (opens in a new tab)');
  help.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:1000;padding:10px 18px;border-radius:999px;' +
    'background:#24451A;color:#fff;font:600 14px/1 system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.25)';
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(help); });
})();
