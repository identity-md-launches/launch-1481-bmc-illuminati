/* Add one link to the published site's existing header; leave its React assets and routes intact. */
(function () {
  function addMintLink() {
    const actions = document.querySelector('.header-actions');
    if (actions && !actions.querySelector('[data-bmc-mint-link]')) {
      const link = document.createElement('a');
      link.href = './mint/';
      link.textContent = 'MINT BMC PASS';
      link.className = 'btn bmc-mint-nav';
      link.setAttribute('data-bmc-mint-link', '');
      actions.prepend(link);
    }
  }
  new MutationObserver(addMintLink).observe(document.getElementById('root'), { childList: true, subtree: true });
  addMintLink();
})();
