const cart = [];
const apiBase = String(window.JIANGNAN_API_BASE || '').replace(/\/$/, '');
const panel = document.querySelector('.cart-panel');
const scrim = document.querySelector('.scrim');
const items = document.querySelector('.cart-items');
const count = document.querySelector('.cart-count');
const total = document.querySelector('.cart-total');
const checkout = document.querySelector('.checkout');
const cartBreakdown = document.querySelector('.cart-breakdown');
const preorderBreakdown = document.querySelector('[data-cart-preorder]');
const stockBreakdown = document.querySelector('[data-cart-stock]');
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
function persistCart() { sessionStorage.setItem('jiangnan-cart', JSON.stringify(cart)); }
function restoreCart() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('jiangnan-cart') || '[]');
    if (!Array.isArray(saved)) throw new Error('購物車資料格式錯誤');
    for (const item of saved) {
      const maxQuantity = Math.max(1, Math.min(10, Number(item.maxQuantity)));
      const quantity = Math.max(1, Math.min(maxQuantity, Number(item.quantity)));
      if (typeof item.name !== 'string' || typeof item.type !== 'string' || !Number.isFinite(Number(item.price)) || !Number.isInteger(quantity)) continue;
      cart.push({ id: typeof item.id === 'string' ? item.id : null, name: item.name, price: Number(item.price), type: item.type, quantity, maxQuantity });
    }
  } catch { sessionStorage.removeItem('jiangnan-cart'); }
}
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
  items.innerHTML = cart.length ? cart.map((item, index) => `<article class="cart-item"><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.type)}${item.maxQuantity < 10 ? ` ・ 最多 ${item.maxQuantity} 件` : ''}</small></div><div class="cart-line-price"><b>${money(item.price * item.quantity)}</b><div class="cart-quantity" aria-label="${escapeHtml(item.name)} 數量"><button data-quantity="${index}" data-change="-1" aria-label="減少數量" ${item.quantity <= 1 ? 'disabled' : ''}>−</button><span>${item.quantity}</span><button data-quantity="${index}" data-change="1" aria-label="增加數量" ${item.quantity >= item.maxQuantity ? 'disabled' : ''}>+</button></div><button class="cart-remove" data-remove="${index}">移除</button></div></article>`).join('') : '<p class="empty">尚未加入商品</p>';
  const amount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const preorderAmount = cart.filter(item => item.type.startsWith('預購訂金')).reduce((sum, item) => sum + item.price * item.quantity, 0);
  const stockAmount = amount - preorderAmount;
  total.textContent = money(amount);
  cartBreakdown.hidden = amount === 0;
  preorderBreakdown.hidden = preorderAmount === 0;
  stockBreakdown.hidden = stockAmount === 0;
  preorderBreakdown.querySelector('b').textContent = money(preorderAmount);
  stockBreakdown.querySelector('b').textContent = money(stockAmount);
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  count.textContent = quantity;
  count.classList.toggle('has-items', quantity > 0);
  checkout.disabled = cart.length === 0;
  persistCart();
}
function setCart(open) { panel.classList.toggle('open', open); scrim.classList.toggle('open', open); panel.setAttribute('aria-hidden', String(!open)); }
function addCartItem(item) {
  const id = item.id || null;
  const maxQuantity = Math.max(1, Math.min(10, Number(item.maxQuantity || 10)));
  const existing = cart.find(current => (id && current.id === id) || (!id && current.name === item.name && current.type === item.type));
  if (existing) { existing.quantity = Math.min(existing.quantity + 1, existing.maxQuantity); if (existing.quantity === existing.maxQuantity) showToast(`此商品最多可加入 ${existing.maxQuantity} 件。`); }
  else cart.push({ id, name: item.name, price: Number(item.price), type: item.type, quantity: 1, maxQuantity });
  renderCart();
  setCart(true);
}
function addToCart(button) { addCartItem({ id: button.dataset.productId, name: button.dataset.name, price: button.dataset.price, type: button.dataset.type, maxQuantity: button.dataset.maxQuantity }); }
function productMarkup(product, index) {
  const preorder = product.kind === 'preorder';
  const due = preorder ? product.depositCents : product.priceCents;
  const type = preorder ? `預購訂金，售價 ${money(product.priceCents)}` : '現貨商品';
  const image = product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}">` : `<span>${String(index + 1).padStart(2, '0')}</span><div class="model-silhouette">${preorder ? 'TCG' : 'CARD'}</div>`;
  const release = preorder ? `<p class="release">預計 ${escapeHtml(product.releaseDate || '待公告')} 到貨</p>` : `<p class="release">${product.availableStock > 0 ? `庫存 ${product.availableStock} 件` : '目前缺貨'}</p>`;
  const disabled = !preorder && product.availableStock < 1;
  const price = product.originalPriceCents ? `<span class="original-price">${money(product.originalPriceCents)}</span><b class="sale-price">${money(product.priceCents)}</b>` : `<b>${money(product.priceCents)}</b>`;
  return `<article class="product-card" data-category="${escapeHtml(product.category || 'booster')}"><a class="product-art ${product.imageUrl ? 'photo-card' : 'art-mecha'}" href="product.html?id=${encodeURIComponent(product.id)}">${image}</a><div class="product-meta"><p class="tag ${preorder ? 'pre' : 'stock'}">${preorder ? '預購' : '現貨'}</p><h3><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>${release}<div class="price-row"><span class="price-stack">${price}</span><button class="add" data-product-id="${escapeHtml(product.id)}" data-name="${escapeHtml(product.name)}" data-price="${due}" data-max-quantity="${preorder ? 10 : product.availableStock}" data-type="${escapeHtml(type)}" ${disabled ? 'disabled' : ''}><i data-lucide="plus"></i><span>${disabled ? '暫時缺貨' : preorder ? `訂金 ${money(due)}` : '加入購物車'}</span></button></div></div></article>`;
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
      if (target) target.innerHTML = selected.map(productMarkup).join('');
    }
    const events = content.filter(post => post.kind === 'event').slice(0, 2);
    const eventTarget = document.querySelector('[data-api-events]');
    if (eventTarget) eventTarget.innerHTML = events.length ? events.map(post => `<article><span>${post.startsAt ? String(new Date(post.startsAt).getDate()).padStart(2, '0') : '•'}</span><div><b>${post.startsAt ? dateFormatter.format(new Date(post.startsAt)) : '店內活動'}</b><h3><a href="post.html?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.summary)}</p></div><i data-lucide="arrow-up-right"></i></article>`).join('') : '<p class="filter-empty">目前沒有活動。</p>';
    const news = content.filter(post => post.kind !== 'event').slice(0, 3);
    const newsTarget = document.querySelector('[data-api-news]');
    if (newsTarget) newsTarget.innerHTML = news.length ? news.map(post => `<a href="post.html?slug=${encodeURIComponent(post.slug)}"><span>${post.kind === 'promotion' ? '優惠' : '公告'}</span><h3>${escapeHtml(post.title)}</h3><p>${post.startsAt ? new Date(post.startsAt).toLocaleDateString('zh-TW').replaceAll('/', '.') : '最新消息'}</p></a>`).join('') : '<p class="filter-empty">目前沒有公告。</p>';
    updateSearchIndex(products, content); applyStockFilter(); renderIcons();
  } catch (error) { console.warn('Public API unavailable; showing preview content.', error); }
}

document.addEventListener('click', event => { const addButton = event.target.closest('.add'); if (addButton && !addButton.disabled) addToCart(addButton); });
document.querySelectorAll('.cart-trigger').forEach(button => button.addEventListener('click', () => setCart(true)));
document.querySelector('.search-trigger').addEventListener('click', () => { searchDialog.showModal(); searchInput.focus(); });
searchInput.addEventListener('input', () => renderSearchResults(searchInput.value));
searchResults.addEventListener('click', () => searchDialog.close());
document.querySelector('.cart-close').addEventListener('click', () => setCart(false));
scrim.addEventListener('click', () => setCart(false));
items.addEventListener('click', event => { const removeIndex = event.target.dataset.remove; const quantityIndex = event.target.dataset.quantity; if (removeIndex !== undefined) { cart.splice(Number(removeIndex), 1); renderCart(); } else if (quantityIndex !== undefined) { const item = cart[Number(quantityIndex)]; if (!item) return; item.quantity = Math.max(1, Math.min(item.maxQuantity, item.quantity + Number(event.target.dataset.change))); renderCart(); } });
document.querySelector('.menu-button').addEventListener('click', event => {
  const nav = document.querySelector('.main-nav'); nav.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(nav.classList.contains('open')));
});
let selectedStockCategory = 'all';
function applyStockFilter() { const cards = [...document.querySelectorAll('.stock-layout .product-card')]; cards.forEach(card => { card.hidden = selectedStockCategory !== 'all' && card.dataset.category !== selectedStockCategory; }); const grid = document.querySelector('[data-api-products="in_stock"]'); if (!grid) return; let empty = grid.querySelector('.filter-empty'); if (!empty) { empty = document.createElement('p'); empty.className = 'filter-empty'; empty.textContent = '此分類目前沒有現貨商品。'; grid.append(empty); } empty.hidden = cards.some(card => !card.hidden); }
const stockFilter = document.querySelector('.filter');
if (stockFilter) {
  const categories = ['all', 'booster', 'single_card', 'accessories'];
  stockFilter.querySelectorAll('button').forEach((button, index) => { button.disabled = false; button.dataset.category = categories[index]; });
  stockFilter.insertAdjacentHTML('beforeend', '<button type="button" data-category="toy_model">玩具模型</button>');
  stockFilter.addEventListener('click', event => { const button = event.target.closest('button[data-category]'); if (!button) return; stockFilter.querySelector('.selected')?.classList.remove('selected'); button.classList.add('selected'); selectedStockCategory = button.dataset.category; applyStockFilter(); });
}
const consignDialog = document.querySelector('.consign-dialog');
const checkoutDialog = document.querySelector('.checkout-dialog');
const orderConfirmationDialog = document.querySelector('.order-confirmation-dialog');
let checkoutIdempotencyKey = null;
function showOrderConfirmation(order) {
  orderConfirmationDialog.querySelector('[data-order-number]').textContent = order.orderNumber;
  orderConfirmationDialog.querySelector('[data-order-amount]').textContent = money(order.amountDueCents);
  orderConfirmationDialog.querySelector('[data-order-expires]').textContent = order.expiresAt ? new Date(order.expiresAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '待確認';
  orderConfirmationDialog.showModal();
}
document.querySelector('#consign-button').addEventListener('click', () => consignDialog.showModal());
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelector('[data-close-order]').addEventListener('click', () => orderConfirmationDialog.close());
document.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => showToast(button.dataset.toast)));
consignDialog.querySelector('form').addEventListener('submit', async event => { event.preventDefault(); if (!apiBase) return showToast('此預覽站尚未連接寄售預約服務。'); const form = event.currentTarget; const submit = form.querySelector('button[type="submit"]'); submit.disabled = true; try { const values = new FormData(form); const response = await fetch(`${apiBase}/api/v1/public/consignment-requests`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sellerName: values.get('sellerName'), sellerContact: values.get('sellerContact'), cardDescription: values.get('cardDescription'), privacyConsent: values.get('privacyConsent') === 'on', privacyVersion: '2026-09-local' }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || '寄售預約送出失敗。'); form.reset(); consignDialog.close(); showToast(`寄售預約 ${body.data.caseNumber} 已送出，請等待門市聯繫。`); } catch (error) { showToast(error.message || '寄售預約送出失敗。'); } finally { submit.disabled = false; } });
async function beginCheckout() {
  if (!apiBase || cart.some(item => !item.id)) return showToast('此預覽站尚未連接正式訂購服務。');
  if (!window.JiangnanCustomer?.customer) { window.JiangnanCustomer?.openMember(); return showToast('請先登入或註冊會員後再結帳。'); }
  if (!(await window.JiangnanCustomer.requirePhone())) return;
  checkoutIdempotencyKey = crypto.randomUUID();
  checkoutDialog.showModal();
}
checkout.addEventListener('click', beginCheckout);
document.addEventListener('jiangnan:phone-verified', beginCheckout);
checkoutDialog.addEventListener('close', () => { checkoutIdempotencyKey = null; });
checkoutDialog.querySelector('form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]'); submit.disabled = true;
  try {
    const response = await fetch(`${apiBase}/api/v1/checkout/intents`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionStorage.getItem('jiangnan-customer-token') || ''}` }, body: JSON.stringify({ idempotencyKey: checkoutIdempotencyKey ??= crypto.randomUUID(), items: cart.map(item => ({ productId: item.id, quantity: item.quantity })) }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '建立訂單失敗');
    cart.length = 0; renderCart(); checkoutDialog.close(); setCart(false); showOrderConfirmation(body.data);
  } catch (error) { showToast(error.message || '建立訂單失敗，請稍後再試。'); } finally { submit.disabled = false; }
});

restoreCart();
renderCart();
try {
  const pendingCartItem = JSON.parse(sessionStorage.getItem('jiangnan-cart-pending') || 'null');
  if (pendingCartItem) { sessionStorage.removeItem('jiangnan-cart-pending'); addCartItem(pendingCartItem); }
} catch { sessionStorage.removeItem('jiangnan-cart-pending'); }
['booster', 'single_card', 'accessories', 'toy_model', 'accessories'].forEach((category, index) => { const card = document.querySelectorAll('.product-card')[index]; if (card) card.dataset.category = category; });
updateSearchIndex([...document.querySelectorAll('.product-card')].map((card, index) => ({ id: `preview-${index}`, name: card.querySelector('h3')?.textContent?.trim() || '', kind: card.querySelector('.tag')?.textContent?.trim() === '預購' ? 'preorder' : 'in_stock', href: card.closest('[data-api-products="preorder"]') ? '#new' : '#stock' })), [...document.querySelectorAll('.news-grid a')].map((link, index) => ({ slug: `preview-news-${index}`, kind: link.querySelector('span')?.textContent?.trim() === '活動' ? 'event' : 'notice', title: link.querySelector('h3')?.textContent?.trim() || '', summary: link.querySelector('p')?.textContent?.trim() || '', href: '#news' })));
applyStockFilter();
renderIcons();
hydratePublicContent();
