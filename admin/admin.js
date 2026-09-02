const demoBanners = [
  { id: 'bnr-001', name: '九月會員日：卡牌周邊 9 折', owner: '江南寶卡', type: 'store', placement: '首頁主視覺', period: '09/01 - 09/30', impressions: '12,840', clicks: '622', status: '發布中', image: 'https://images.unsplash.com/photo-1703023689733-6a4281149189?auto=format&fit=crop&w=180&q=70' },
  { id: 'bnr-002', name: '星潮玩具新品活動', owner: '星潮玩具', type: 'external', placement: '首頁橫幅 970 × 250', period: '09/02 - 09/16', impressions: '8,120', clicks: '188', status: '待審核', image: 'https://images.unsplash.com/photo-1575767931088-5cb5e584d6bc?auto=format&fit=crop&w=180&q=70' }
];
let banners = demoBanners;
const table = document.querySelector('#banner-table');
const dialog = document.querySelector('#banner-dialog');
const toast = document.querySelector('.toast');
const api = window.JiangnanAdminApi;
const state = document.querySelector('[data-connection-state]');
const placementNames = { hero: '首頁主視覺', home_leaderboard: '首頁橫幅 970 × 250', product_sidebar: '商品側欄 300 × 600', mobile_banner: '手機橫幅' };
const statusNames = { draft: '草稿', pending_review: '待審核', scheduled: '排程中', published: '發布中', disabled: '已停用' };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
function showToast(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timeout); showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2800); }
function statusClass(status) { return status === '發布中' ? 'live' : status === '待審核' ? 'review' : status === '排程中' ? 'scheduled' : ''; }
function render(filter = 'all') {
  const selected = filter === 'all' ? banners : banners.filter(b => b.type === filter);
  table.innerHTML = selected.map(b => `<tr><td><div class="campaign">${b.image ? `<img class="campaign-image" src="${esc(b.image)}" alt="">` : '<span class="campaign-image"></span>'}<div><b>${esc(b.name)}</b><small>${esc(b.owner)} ・ ${esc(b.id)}</small></div></div></td><td><span class="kind ${b.type}">${b.type === 'store' ? '店內活動' : '第三方廣告'}</span></td><td>${esc(b.placement)}</td><td>${esc(b.period)}</td><td>${esc(b.impressions)}<small> 曝光 / ${esc(b.clicks)} 點擊</small></td><td><span class="status ${statusClass(b.status)}">${esc(b.status)}</span></td><td>${actionButton(b)}</td></tr>`).join('');
  document.querySelector('#active-count').textContent = banners.filter(b => b.status === '發布中').length;
}
function apiBanner(item) {
  const format = value => value ? new Date(value).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) : '-';
  return { id: item.id, rawStatus: item.status, name: item.name, owner: item.createdBy || '系統使用者', type: item.kind, placement: placementNames[item.placement] || item.placement, period: `${format(item.startsAt)} - ${format(item.endsAt)}`, impressions: Number(item.impressions).toLocaleString('zh-TW'), clicks: Number(item.clicks).toLocaleString('zh-TW'), status: statusNames[item.status] || item.status, image: item.imageUrl };
}
function actionButton(banner) { if (!api.enabled || !banner.rawStatus) return '<button class="actions" aria-label="展示模式">⋮</button>'; if (banner.rawStatus === 'pending_review') return `<button class="ghost" data-approve="${banner.id}">核准</button>`; if (banner.rawStatus === 'draft') return `<button class="ghost" data-submit="${banner.id}">送審</button>`; if (banner.rawStatus === 'published' || banner.rawStatus === 'scheduled') return `<button class="ghost" data-disable="${banner.id}">停用</button>`; return ''; }
render();
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { document.querySelector('[data-filter].selected').classList.remove('selected'); button.classList.add('selected'); render(button.dataset.filter); }));
document.querySelectorAll('#open-banner, #open-banner-2').forEach(button => button.addEventListener('click', () => dialog.showModal()));
if (api.enabled) document.querySelector('.upload').outerHTML = '<label class="full">素材物件 key<input required name="imageKey" placeholder="banners/2026/10/october-preorder.webp"></label><label class="full">CDN 圖片網址<input required name="imageUrl" type="url" placeholder="https://cdn.example.com/banners/october-preorder.webp"></label>';
document.querySelector('#banner-form').addEventListener('submit', event => {
  event.preventDefault();
  if (api.enabled) return saveBanner(event);
  const data = new FormData(event.currentTarget); const publish = document.activeElement.id === 'publish-new';
  banners.unshift({ id: `bnr-${String(banners.length + 1).padStart(3, '0')}`, name: data.get('name'), owner: data.get('type') === 'store' ? '江南寶卡' : '待填廣告主', type: data.get('type'), placement: data.get('placement'), period: '展示資料', impressions: '-', clicks: '-', status: publish ? '待審核' : '草稿', image: null });
  render(document.querySelector('[data-filter].selected').dataset.filter); dialog.close(); event.currentTarget.reset(); showToast(publish ? '展示資料已送交審核。' : '展示資料草稿已儲存。');
});
async function saveBanner(event) {
  const form = new FormData(event.currentTarget); const placement = { '首頁主視覺': 'hero', '首頁橫幅 970 × 250': 'home_leaderboard', '商品側欄 300 × 600': 'product_sidebar', '手機橫幅': 'mobile_banner' }[form.get('placement')];
  const submitForReview = document.activeElement.id === 'publish-new';
  try { const created = await api.createBanner({ name: form.get('name'), kind: form.get('type'), placement, priority: Number(form.get('priority')), startsAt: new Date(form.get('startsAt')).toISOString(), endsAt: new Date(form.get('endsAt')).toISOString(), targetUrl: form.get('targetUrl') || null, imageKey: form.get('imageKey'), imageUrl: form.get('imageUrl') }); if (submitForReview) await api.submitBanner(created.id); banners = (await api.listBanners()).map(apiBanner); render(document.querySelector('[data-filter].selected').dataset.filter); dialog.close(); event.currentTarget.reset(); showToast(submitForReview ? 'Banner 已送交審核。' : 'Banner 草稿已儲存。'); } catch (error) { showToast(error.message || 'Banner 儲存失敗。'); }
}
table.addEventListener('click', async event => { const id = event.target.dataset.approve || event.target.dataset.submit || event.target.dataset.disable; if (!id) return; try { if (event.target.dataset.approve) await api.approveBanner(id); if (event.target.dataset.submit) await api.submitBanner(id); if (event.target.dataset.disable) await api.disableBanner(id); banners = (await api.listBanners()).map(apiBanner); render(document.querySelector('[data-filter].selected').dataset.filter); showToast('Banner 狀態已更新。'); } catch (error) { showToast(error.message || '狀態更新失敗。'); } });
if (api.enabled) {
  api.listBanners().then(data => { banners = data.map(apiBanner); render(document.querySelector('[data-filter].selected').dataset.filter); state.textContent = '已連線正式 API：Banner 資料依 OIDC 權限讀取。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線正式 API：${error.message}`; state.classList.add('failed'); });
}
