const cart = [];
const apiBase = String(window.JIANGNAN_API_BASE || '').replace(/\/$/, '');
const panel = document.querySelector('.cart-panel');
const scrim = document.querySelector('.scrim');
const items = document.querySelector('.cart-items');
const count = document.querySelector('.cart-count');
const total = document.querySelector('.cart-total');
const checkout = document.querySelector('.checkout');
const formatter = new Intl.NumberFormat('zh-TW');
const dateFormatter = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' });
const toast = document.querySelector('.toast');
const searchDialog = document.querySelector('.search-dialog');
const searchInput = document.querySelector('.search-input');
const searchResults = document.querySelector('.search-results');
let searchableItems = [];

function renderIcons() { window.lucide?.createIcons(); }
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 3200);
}
function money(value) { return `NT$ ${formatter.format(value)}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function updateSearchIndex(products = [], content = []) {
  searchableItems = [
    ...products.map(product => ({ kind: '商品', title: product.name, description: product.kind === 'preorder' ? '預購商品' : '現貨商品', href: product.href || `product.html?id=${encodeURIComponent(product.id)}` })),
    ...content.map(post => ({ kind: post.kind === 'event' ? '活動' : post.kind === 'promotion' ? '優惠' : '公告', title: post.title, description: post.summary, href: post.href || `post.html?slug=${encodeURIComponent(post.slug)}` }))
  ];
}
function renderSearchResults(query = '') {
  const term = query.trim().toLocaleLowerCase('zh-TW');
  const matches = term ? searchableItems.filter(item => `${item.title} ${item.description} ${item.kind}`.toLocaleLowerCase('zh-TW').includes(term)).slice(0, 8) : [];
  searchResults.innerHTML = !term ? '<p class="search-hint">輸入關鍵字，搜尋商品、活動與公告。</p>' : matches.length ? matches.map(item => `<a class="search-result" href="${item.href}"><span class="search-kind">${item.kind}</span><span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || '')}</p></span><span class="search-arrow">→</span></a>`).join('') : '<p class="search-hint">找不到相符內容，請換個關鍵字試試。</p>';
}
function renderCart() {
  items.innerHTML = cart.length ? cart.map((item, index) => `<article class="cart-item"><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.type)}</small></div><div><b>${money(item.price)}</b><button data-remove="${index}">移除</button></div></article>`).join('') : '<p class="empty">尚未加入商品</p>';
  const amount = cart.reduce((sum, item) => sum + item.price, 0);
  total.textContent = money(amount);
  count.textContent = cart.length;
  count.classList.toggle('has-items', cart.length > 0);
  checkout.disabled = cart.length === 0;
}
function setCart(open) { panel.classList.toggle('open', open); scrim.classList.toggle('open', open); panel.setAttribute('aria-hidden', String(!open)); }
function addToCart(button) {
  cart.push({ id: button.dataset.productId || null, name: button.dataset.name, price: Number(button.dataset.price), type: button.dataset.type });
  renderCart();
  setCart(true);
}
function productMarkup(product, index) {
  const preorder = product.kind === 'preorder';
  const due = preorder ? product.depositCents : product.priceCents;
  const type = preorder ? `預購訂金，售價 ${money(product.priceCents)}` : '現貨商品';
  const image = product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}">` : `<span>${String(index + 1).padStart(2, '0')}</span><div class="model-silhouette">${preorder ? 'TCG' : 'CARD'}</div>`;
  const release = preorder ? `<p class="release">預計 ${escapeHtml(product.releaseDate || '待公告')} 到貨</p>` : `<p class="release">${product.availableStock > 0 ? `庫存 ${product.availableStock} 件` : '目前缺貨'}</p>`;
  const disabled = !preorder && product.availableStock < 1;
  const price = product.originalPriceCents ? `<span class="original-price">${money(product.originalPriceCents)}</span><b class="sale-price">${money(product.priceCents)}</b>` : `<b>${money(product.priceCents)}</b>`;
  return `<article class="product-card"><a class="product-art ${product.imageUrl ? 'photo-card' : 'art-mecha'}" href="product.html?id=${encodeURIComponent(product.id)}">${image}</a><div class="product-meta"><p class="tag ${preorder ? 'pre' : 'stock'}">${preorder ? '預購' : '現貨'}</p><h3><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>${release}<div class="price-row"><span class="price-stack">${price}</span><button class="add" data-product-id="${escapeHtml(product.id)}" data-name="${escapeHtml(product.name)}" data-price="${due}" data-type="${escapeHtml(type)}" ${disabled ? 'disabled' : ''}><i data-lucide="plus"></i><span>${disabled ? '暫時缺貨' : preorder ? `訂金 ${money(due)}` : '加入購物車'}</span></button></div></div></article>`;
}
async function fetchPublic(path) {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) throw new Error('公開資料暫時無法讀取');
  return response.json();
}
async function hydratePublicContent() {
  if (!apiBase) return;
  try {
    const [{ data: products }, { data: content }] = await Promise.all([fetchPublic('/api/v1/public/products'), fetchPublic('/api/v1/public/content')]);
    for (const kind of ['preorder', 'in_stock']) {
      const target = document.querySelector(`[data-api-products="${kind}"]`);
      const selected = products.filter(product => product.kind === kind);
      if (target && selected.length) target.innerHTML = selected.map(productMarkup).join('');
    }
    const events = content.filter(post => post.kind === 'event').slice(0, 2);
    const eventTarget = document.querySelector('[data-api-events]');
    if (eventTarget && events.length) eventTarget.innerHTML = events.map(post => `<article><span>${post.startsAt ? String(new Date(post.startsAt).getDate()).padStart(2, '0') : '•'}</span><div><b>${post.startsAt ? dateFormatter.format(new Date(post.startsAt)) : '店內活動'}</b><h3><a href="post.html?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.summary)}</p></div><i data-lucide="arrow-up-right"></i></article>`).join('');
    const news = content.filter(post => post.kind !== 'event').slice(0, 3);
    const newsTarget = document.querySelector('[data-api-news]');
    if (newsTarget && news.length) newsTarget.innerHTML = news.map(post => `<a href="post.html?slug=${encodeURIComponent(post.slug)}"><span>${post.kind === 'promotion' ? '優惠' : '公告'}</span><h3>${escapeHtml(post.title)}</h3><p>${post.startsAt ? new Date(post.startsAt).toLocaleDateString('zh-TW').replaceAll('/', '.') : '最新消息'}</p></a>`).join('');
    updateSearchIndex(products, content); renderIcons();
  } catch (error) { console.warn('Public API unavailable; showing preview content.', error); }
}

document.addEventListener('click', event => { const addButton = event.target.closest('.add'); if (addButton && !addButton.disabled) addToCart(addButton); });
document.querySelectorAll('.cart-trigger').forEach(button => button.addEventListener('click', () => setCart(true)));
document.querySelector('.search-trigger').addEventListener('click', () => { searchDialog.showModal(); searchInput.focus(); });
searchInput.addEventListener('input', () => renderSearchResults(searchInput.value));
searchResults.addEventListener('click', () => searchDialog.close());
document.querySelector('.cart-close').addEventListener('click', () => setCart(false));
scrim.addEventListener('click', () => setCart(false));
items.addEventListener('click', event => { const index = event.target.dataset.remove; if (index !== undefined) { cart.splice(Number(index), 1); renderCart(); } });
document.querySelector('.menu-button').addEventListener('click', event => {
  const nav = document.querySelector('.main-nav'); nav.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(nav.classList.contains('open')));
});
document.querySelectorAll('.filter button:not([disabled])').forEach(button => button.addEventListener('click', () => { document.querySelector('.filter .selected').classList.remove('selected'); button.classList.add('selected'); }));
const consignDialog = document.querySelector('.consign-dialog');
const checkoutDialog = document.querySelector('.checkout-dialog');
document.querySelector('#consign-button').addEventListener('click', () => consignDialog.showModal());
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => showToast(button.dataset.toast)));
consignDialog.querySelector('form').addEventListener('submit', async event => { event.preventDefault(); if (!apiBase) return showToast('此預覽站尚未連接寄售預約服務。'); const form = event.currentTarget; const submit = form.querySelector('button[type="submit"]'); submit.disabled = true; try { const values = new FormData(form); const response = await fetch(`${apiBase}/api/v1/public/consignment-requests`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sellerName: values.get('sellerName'), sellerContact: values.get('sellerContact'), cardDescription: values.get('cardDescription'), privacyConsent: values.get('privacyConsent') === 'on', privacyVersion: '2026-09-local' }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || '寄售預約送出失敗。'); form.reset(); consignDialog.close(); showToast(`寄售預約 ${body.data.caseNumber} 已送出，請等待門市聯繫。`); } catch (error) { showToast(error.message || '寄售預約送出失敗。'); } finally { submit.disabled = false; } });
checkout.addEventListener('click', () => {
  if (!apiBase || cart.some(item => !item.id)) return showToast('此預覽站尚未連接正式訂購服務。');
  checkoutDialog.showModal();
});
checkoutDialog.querySelector('form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]'); submit.disabled = true;
  try {
    const response = await fetch(`${apiBase}/api/v1/checkout/intents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), customerEmail: new FormData(event.currentTarget).get('customerEmail'), items: cart.map(item => ({ productId: item.id, quantity: 1 })) }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '建立訂單失敗');
    cart.length = 0; renderCart(); checkoutDialog.close(); setCart(false); showToast(`訂單 ${body.data.orderNumber} 已建立，請等待付款服務啟用。`);
  } catch (error) { showToast(error.message || '建立訂單失敗，請稍後再試。'); } finally { submit.disabled = false; }
});

renderCart();
updateSearchIndex([...document.querySelectorAll('.product-card')].map((card, index) => ({ id: `preview-${index}`, name: card.querySelector('h3')?.textContent?.trim() || '', kind: card.querySelector('.tag')?.textContent?.trim() === '預購' ? 'preorder' : 'in_stock', href: card.closest('[data-api-products="preorder"]') ? '#new' : '#stock' })), [...document.querySelectorAll('.news-grid a')].map((link, index) => ({ slug: `preview-news-${index}`, kind: link.querySelector('span')?.textContent?.trim() === '活動' ? 'event' : 'notice', title: link.querySelector('h3')?.textContent?.trim() || '', summary: link.querySelector('p')?.textContent?.trim() || '', href: '#news' })));
renderIcons();
hydratePublicContent();
