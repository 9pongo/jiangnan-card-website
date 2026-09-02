document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="brand-logo.css">');

const apiBase = String(window.JIANGNAN_API_BASE || '').replace(/\/$/, '');
const formatter = new Intl.NumberFormat('zh-TW');
const query = new URLSearchParams(location.search);
const view = document.querySelector('[data-detail]');
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = value => `NT$ ${formatter.format(value)}`;
function error(message) { view.innerHTML = `<p class="error">${esc(message)}</p>`; }
async function loadProduct() {
  const id = query.get('id');
  if (!apiBase || !id) return error('此商品頁需連接正式服務後才能顯示。');
  const response = await fetch(`${apiBase}/api/v1/public/products/${encodeURIComponent(id)}`);
  if (!response.ok) return error('找不到商品，或商品已下架。');
  const { data } = await response.json();
  const preorder = data.kind === 'preorder';
  document.title = `${data.name} | 江南寶卡`;
  view.innerHTML = `<div class="product-detail"><div class="product-art">${data.imageUrl ? `<img src="${esc(data.imageUrl)}" alt="${esc(data.name)}">` : 'TCG'}</div><div class="buy-panel"><p class="eyebrow">${preorder ? 'PRE-ORDER' : 'IN STOCK'}</p><h1>${esc(data.name)}</h1><p class="price">${data.originalPriceCents ? `<del>${money(data.originalPriceCents)}</del> ` : ''}${money(data.priceCents)}</p><div class="meta"><div><span>${preorder ? '預購訂金' : '供應狀態'}</span><b>${preorder ? money(data.depositCents) : data.availableStock > 0 ? '現貨供應中' : '暫時缺貨'}</b></div><div><span>${preorder ? '預計到貨' : '商品編號'}</span><b>${esc(preorder ? data.releaseDate?.slice(0, 10) || '待公告' : data.sku)}</b></div></div><button class="button" ${!preorder && data.availableStock < 1 ? 'disabled' : ''}>${preorder ? '回首頁加入預購訂金' : '回首頁加入購物車'}</button></div></div>`;
  view.querySelector('.button')?.addEventListener('click', () => { location.href = './#new'; });
}
async function loadPost() {
  const slug = query.get('slug');
  if (!apiBase || !slug) return error('此公告頁需連接正式服務後才能顯示。');
  const response = await fetch(`${apiBase}/api/v1/public/content/${encodeURIComponent(slug)}`);
  if (!response.ok) return error('找不到公告，或公告已下架。');
  const { data } = await response.json();
  document.title = `${data.title} | 江南寶卡`;
  view.innerHTML = `<article class="article"><p class="eyebrow">${esc(data.kind.toUpperCase())}</p><h1>${esc(data.title)}</h1><p class="lead">${esc(data.summary)}</p><div class="article-body"></div></article>`;
  view.querySelector('.article-body').textContent = data.body;
}
(document.body.dataset.page === 'product' ? loadProduct : loadPost)().catch(() => error('資料暫時無法讀取，請稍後再試。'));
