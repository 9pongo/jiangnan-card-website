// Set window.JIANGNAN_API_BASE during production deployment. GitHub Pages keeps the placeholder when no API exists.
const bannerApi = window.JIANGNAN_API_BASE;
const placements = [{ key: 'hero', element: '.hero', hero: true }, { key: 'home_leaderboard', element: '#home-leaderboard' }, { key: 'product_sidebar', element: '.side-ad' }, { key: 'mobile_banner', element: '#mobile-banner' }];
function safeUrl(value, allowInternal = false) {
  if (allowInternal && typeof value === 'string' && /^\/[a-zA-Z0-9/_?=&-]*$/.test(value)) return value;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
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
    const imageUrl = safeUrl(banner?.imageUrl);
    if (!imageUrl) return;
    const target = document.querySelector(element);
    if (!target) return;
    const targetUrl = safeUrl(banner.targetUrl, true);
    if (key === 'hero') {
      const image = target.querySelector(':scope > img');
      if (!image) return;
      image.src = imageUrl;
      image.alt = String(banner.name || '首頁主視覺 Banner');
      if (targetUrl) {
        const link = document.createElement('a');
        link.className = 'hero-banner-link';
        link.href = targetUrl;
        link.setAttribute('aria-label', String(banner.name || '查看首頁主視覺 Banner'));
        if (targetUrl.startsWith('http')) { link.rel = 'noopener sponsored'; link.target = '_blank'; }
        link.addEventListener('click', () => recordEvent(banner.id, 'click'));
        target.prepend(link);
      }
      target.dataset.bannerKind = banner.kind === 'external' ? 'external' : 'store';
      recordEvent(banner.id, 'impression');
      return;
    }
    const link = document.createElement('a');
    link.className = `managed-banner ${banner.kind === 'external' ? 'external' : 'store'}`;
    link.href = targetUrl || '#';
    if (targetUrl?.startsWith('http')) { link.rel = 'noopener sponsored'; link.target = '_blank'; }
    const image = document.createElement('img'); image.src = imageUrl; image.alt = String(banner.name || 'Banner');
    const label = document.createElement('span'); label.textContent = banner.kind === 'external' ? '廣告' : '店內活動';
    link.append(image, label); target.replaceChildren(link);
    recordEvent(banner.id, 'impression');
    link.addEventListener('click', () => recordEvent(banner.id, 'click'));
  } catch { /* Public pages must remain usable when a campaign service is unavailable. */ }
}
ensureMobilePlacement();
placements.forEach(loadBanner);
function recordEvent(id, type) {
  const eventKey = crypto.randomUUID();
  fetch(`${bannerApi}/api/v1/public/banners/${id}/events/${type}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventKey }), keepalive: true }).catch(() => {});
}
