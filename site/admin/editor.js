// Small fixes to the editor's interface, loaded by site/admin/index.html.
(function () {
  // The Image button in the post body offers "Insert from URL", which would make the
  // public page load a photo from another website. The photo fields switch it off with
  // choose_url: false, but Decap does not pass that setting to the body's Image button,
  // and the URL buttons share their style with the upload buttons, so they are hidden by
  // their text. The build also refuses a page that loads anything from another site.
  var URL_BUTTONS = /^(Insert from URL|Replace with URL)$/;
  new MutationObserver(function () {
    Array.prototype.forEach.call(document.querySelectorAll('button'), function (b) {
      if (URL_BUTTONS.test(b.textContent.trim())) b.style.display = 'none';
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
