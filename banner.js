// Set window.JIANGNAN_API_BASE during production deployment. GitHub Pages keeps the placeholder when no API exists.
const bannerApi = window.JIANGNAN_API_BASE;
const placements = [{ key: 'home_leaderboard', element: '#home-leaderboard' }, { key: 'product_sidebar', element: '.side-ad' }, { key: 'mobile_banner', element: '#mobile-banner' }];
function ensureMobilePlacement() {
  if (document.querySelector('#mobile-banner')) return;
  const stockLayout = document.querySelector('.stock-layout');
  if (stockLayout) stockLayout.insertAdjacentHTML('afterend', '<aside id="mobile-banner" class="mobile-banner-slot" aria-label="手機廣告版位"><span>ADVERTISEMENT</span><b>320 × 100</b></aside>');
}
async function loadBanner({ key, element }) {
  if (key === 'mobile_banner') ensureMobilePlacement();
  if (!bannerApi) return;
  try {
    const response = await fetch(`${bannerApi}/api/v1/public/banners/${key}`);
    if (!response.ok) return;
    const { data } = await response.json();
    const banner = data[0];
    if (!banner?.imageUrl) return;
    const target = document.querySelector(element);
    if (!target) return;
    target.innerHTML = `<a class="managed-banner ${banner.kind}" href="${banner.targetUrl || '#'}" ${banner.targetUrl?.startsWith('http') ? 'rel="noopener sponsored" target="_blank"' : ''}><img src="${banner.imageUrl}" alt="${banner.name}"><span>${banner.kind === 'external' ? '廣告' : '店內活動'}</span></a>`;
    recordEvent(banner.id, 'impression');
    target.querySelector('a').addEventListener('click', () => recordEvent(banner.id, 'click'));
  } catch { /* Public pages must remain usable when a campaign service is unavailable. */ }
}
ensureMobilePlacement();
placements.forEach(loadBanner);
function recordEvent(id, type) {
  const eventKey = crypto.randomUUID();
  fetch(`${bannerApi}/api/v1/public/banners/${id}/events/${type}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventKey }), keepalive: true }).catch(() => {});
}
