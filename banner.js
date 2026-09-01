// Set window.JIANGNAN_API_BASE during production deployment. GitHub Pages keeps the placeholder when no API exists.
const bannerApi = window.JIANGNAN_API_BASE;
const placements = [{ key: 'home_leaderboard', element: '#home-leaderboard' }, { key: 'product_sidebar', element: '.side-ad' }];
async function loadBanner({ key, element }) {
  if (!bannerApi) return;
  try {
    const response = await fetch(`${bannerApi}/api/v1/public/banners/${key}`);
    if (!response.ok) return;
    const { data } = await response.json();
    const banner = data[0];
    if (!banner?.imageUrl) return;
    const target = document.querySelector(element);
    target.innerHTML = `<a class="managed-banner ${banner.kind}" href="${banner.targetUrl || '#'}" ${banner.targetUrl?.startsWith('http') ? 'rel="noopener sponsored" target="_blank"' : ''}><img src="${banner.imageUrl}" alt="${banner.name}"><span>${banner.kind === 'external' ? '廣告' : '店內活動'}</span></a>`;
  } catch { /* Public pages must remain usable when a campaign service is unavailable. */ }
}
placements.forEach(loadBanner);
