// Rebrand notice.
// Only shown to visitors arriving from the old quintesmarthomes.ca / quintesmarthomes.com domains.
// The redirect on the old domains should add ?from=quintesmarthomes to the URL; the referrer
// check below is a backup in case the redirect ever drops the query string.
(() => {
  const PARAM = 'from';
  const VALUE = 'quintesmarthomes';
  const OLD_HOSTS = ['quintesmarthomes.ca', 'quintesmarthomes.com'];

  const url = new URL(window.location.href);
  const fromParam = url.searchParams.get(PARAM) === VALUE;

  let fromReferrer = false;
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      fromReferrer = OLD_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    }
  } catch (e) { /* bad referrer, ignore */ }

  if (!fromParam && !fromReferrer) return;

  // Remove the marker from the address bar so a refresh, bookmark or shared link doesn't show it again
  if (fromParam) {
    url.searchParams.delete(PARAM);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }

  const show = () => {
    const dialog = document.getElementById('rebrandNotice');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    dialog.showModal();

    // Click on the dark backdrop closes it
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }
})();
