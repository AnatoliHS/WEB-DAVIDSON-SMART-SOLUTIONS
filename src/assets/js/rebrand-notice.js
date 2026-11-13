// Rebrand notice: shown only to visitors redirected from the old quintesmarthomes.ca domain.
// The redirect on the old domain adds ?from=quintesmarthomes to the URL. Visitors who come
// straight to davidsonsmartsolutions.ca never see the notice.
(() => {
  const PARAM = 'from';
  const VALUE = 'quintesmarthomes';
  const OLD_HOST = 'quintesmarthomes.ca';

  const url = new URL(window.location.href);
  const fromParam = url.searchParams.get(PARAM) === VALUE;

  // Backup check in case the redirect ever drops the query string
  let fromReferrer = false;
  try {
    fromReferrer = !!document.referrer && new URL(document.referrer).hostname.endsWith(OLD_HOST);
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
