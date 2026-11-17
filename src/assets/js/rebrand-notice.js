// Rebrand notice.
// - Until SHOW_ALL_UNTIL: every visitor sees it once (remembered in localStorage).
// - Always: visitors redirected from the old quintesmarthomes.ca domain see it on arrival.
//   The redirect on the old domain adds ?from=quintesmarthomes to the URL.
// After SHOW_ALL_UNTIL passes, the notice automatically goes back to old-domain visitors only.
(() => {
  const PARAM = 'from';
  const VALUE = 'quintesmarthomes';
  const OLD_HOST = 'quintesmarthomes.ca';
  const SHOW_ALL_UNTIL = new Date('2027-05-17T00:00:00'); // 6 months from launch (2026-11-17)
  const SEEN_KEY = 'rebrandNoticeSeen';

  const url = new URL(window.location.href);
  const fromParam = url.searchParams.get(PARAM) === VALUE;

  // Backup check in case the redirect ever drops the query string
  let fromReferrer = false;
  try {
    fromReferrer = !!document.referrer && new URL(document.referrer).hostname.endsWith(OLD_HOST);
  } catch (e) { /* bad referrer, ignore */ }

  const fromOldDomain = fromParam || fromReferrer;

  let alreadySeen = false;
  try {
    alreadySeen = localStorage.getItem(SEEN_KEY) === '1';
  } catch (e) { /* storage blocked, treat as not seen */ }

  const showToEveryone = new Date() < SHOW_ALL_UNTIL && !alreadySeen;

  if (!fromOldDomain && !showToEveryone) return;

  // Remove the marker from the address bar so a refresh, bookmark or shared link doesn't show it again
  if (fromParam) {
    url.searchParams.delete(PARAM);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }

  const show = () => {
    const dialog = document.getElementById('rebrandNotice');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    dialog.showModal();

    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch (e) { /* storage blocked, ignore */ }

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
