const demoProducts = [{ sku: 'PK-SV-BOX-001', name: '寶可夢 SV 系列擴充包 BOX', kind: 'preorder', priceCents: 1490, depositCents: 745, releaseDate: '2026-12-01', status: 'published' }, { sku: 'PK-RANDOM-001', name: '寶可夢隨機卡包組', kind: 'in_stock', priceCents: 680, availableStock: 24, status: 'published' }];
let products = demoProducts;
const table = document.querySelector('#product-table');
const dialog = document.querySelector('#product-dialog');
const toast = document.querySelector('.toast');
const api = window.JiangnanAdminApi;
const state = document.querySelector('[data-connection-state]');
const money = value => `NT$ ${Number(value).toLocaleString('zh-TW')}`;
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
function message(value) { toast.textContent = value; toast.classList.add('show'); clearTimeout(message.timeout); message.timeout = setTimeout(() => toast.classList.remove('show'), 2600); }
function render() { table.innerHTML = products.map(p => `<tr><td><b>${esc(p.name)}</b><small> ${esc(p.sku)}</small></td><td>${p.kind === 'preorder' ? '預購' : '現貨'}</td><td>${p.originalPriceCents ? `<small style="text-decoration:line-through">${money(p.originalPriceCents)}</small><br>` : ''}<b>${money(p.priceCents)}</b></td><td>${p.kind === 'preorder' ? `訂金 ${money(p.depositCents)} ・ ${esc(String(p.releaseDate).slice(0, 10))} 到貨` : `可售 ${p.availableStock} 件`}</td><td><span class="status ${p.status === 'published' ? 'live' : p.status === 'pending_review' ? 'review' : ''}">${p.status === 'published' ? '上架' : p.status === 'pending_review' ? '待審核' : p.status === 'archived' ? '已封存' : '草稿'}</span></td><td>${p.status === 'pending_review' && api.enabled ? `<button class="ghost" data-approve="${p.id}">核准</button>` : ''}</td></tr>`).join(''); }
async function refresh() { products = await api.listProducts(); render(); }
render();
document.querySelector('[name="price"]').closest('label').insertAdjacentHTML('afterend','<label>原價（NT$）<input name="originalPrice" type="number" min="0" placeholder="無折扣請留空"></label>');
document.querySelectorAll('#open-product,#open-product-2').forEach(button => button.addEventListener('click', () => dialog.showModal()));
document.querySelector('#product-kind').addEventListener('change', event => { const preorder = event.target.value === 'preorder'; document.querySelector('#deposit-field').hidden = !preorder; document.querySelector('#release-field').hidden = !preorder; document.querySelector('#stock-field').hidden = preorder; });
document.querySelector('#product-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = new FormData(event.currentTarget); const preorder = form.get('kind') === 'preorder';
  const input = { sku: form.get('sku'), name: form.get('name'), kind: form.get('kind'), priceCents: Number(form.get('price')), originalPriceCents: form.get('originalPrice') ? Number(form.get('originalPrice')) : null, depositCents: preorder ? Number(form.get('deposit')) : null, availableStock: preorder ? null : Number(form.get('stock')), releaseDate: preorder ? form.get('releaseDate') : null, imageUrl: null, status: form.get('status') };
  try {
    if (api.enabled) { await api.createProduct(input); await refresh(); state.textContent = '已連線正式 API：商品資料依 OIDC 權限讀取與寫入。'; state.classList.add('connected'); message('商品已由正式 API 儲存。'); }
    else { products.unshift(input); render(); message('展示資料已儲存。'); }
    dialog.close(); event.currentTarget.reset();
  } catch (error) { message(error.message || '商品儲存失敗。'); }
});
if (api.enabled) refresh().then(() => { state.textContent = '已連線正式 API：商品資料依 OIDC 權限讀取。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線正式 API：${error.message}`; state.classList.add('failed'); });
table.addEventListener('click', async event => { if (!event.target.dataset.approve) return; try { await api.approveProduct(event.target.dataset.approve); await refresh(); message('商品價格與上架狀態已核准。'); } catch (error) { message(error.message || '商品核准失敗。'); } });
