const demoOrders = [{ orderNumber: 'JC-20260902-AB12CD', customerEmail: 'd***@example.com', itemCount: 1, amountDueCents: 500, status: 'pending_payment' }, { orderNumber: 'JC-20260902-PK9001', customerEmail: 'm***@example.com', itemCount: 2, amountDueCents: 1490, status: 'pending_payment' }];
const api = window.JiangnanAdminApi;
const rows = document.querySelector('#rows');
const state = document.querySelector('[data-connection-state]');
const searchInput = document.querySelector('#order-search');
const statusFilter = document.querySelector('#order-status');
const filterSummary = document.querySelector('#order-filter-summary');
let orders = demoOrders;
const money = value => `NT$ ${Number(value).toLocaleString('zh-TW')}`;
const names = { pending_payment: '待付款', paid: '已付款', cancelled: '已取消', expired: '已逾時', fulfilled: '已履約' };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
function expiry(value) { return value ? new Date(value).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未設定'; }
function inventoryState(order, item) {
  if (!item.reservedStock) return '預購訂金項目';
  if (order.status === 'pending_payment') return '現貨庫存保留中';
  if (order.status === 'expired' || order.status === 'cancelled') return '現貨庫存已釋回';
  return '現貨庫存已扣除';
}
function render(data) { rows.innerHTML = data.length ? data.map(order => `<tr><td><b>${esc(order.orderNumber)}</b></td><td>${esc(order.customerEmail)}</td><td>${order.itemCount}</td><td><b>${money(order.amountDueCents)}</b></td><td>${order.status === 'pending_payment' ? expiry(order.expiresAt) : '-'}</td><td><span class="status ${order.status === 'pending_payment' ? 'review' : order.status === 'paid' ? 'live' : ''}">${names[order.status] || order.status}</span></td><td>${order.id ? `<button class="ghost" data-detail="${order.id}">明細</button>` : '<small>展示資料</small>'}</td></tr>`).join('') : '<tr><td colspan="7"><small>找不到符合條件的訂單。</small></td></tr>'; }
function filteredOrders() { const term = searchInput.value.trim().toLocaleLowerCase('zh-TW'); const status = statusFilter.value; return orders.filter(order => (status === 'all' || order.status === status) && (!term || `${order.orderNumber} ${order.customerEmail}`.toLocaleLowerCase('zh-TW').includes(term))); }
function applyFilters() { const filtered = filteredOrders(); render(filtered); filterSummary.textContent = `顯示 ${filtered.length}／${orders.length} 筆訂單`; }
function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function exportOrders() { const records = filteredOrders(); const csvRows = [['訂單編號', '顧客', '商品數', '應付金額', '保留至', '狀態'], ...records.map(order => [order.orderNumber, order.customerEmail, order.itemCount, order.amountDueCents, order.expiresAt || '', names[order.status] || order.status])]; const csv = `\uFEFF${csvRows.map(row => row.map(csvCell).join(',')).join('\r\n')}`; const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `jiangnan-orders-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); }
const header = rows.closest('table').querySelector('thead tr');
header.insertAdjacentHTML('beforeend', '<th>明細</th>');
const detailDialog = document.createElement('dialog');
detailDialog.innerHTML = '<form method="dialog"><header><div><p class="eyebrow">ORDER DETAIL</p><h2>訂單明細</h2></div><button class="close" type="button" aria-label="關閉">×</button></header><div class="history-list"></div><footer><button class="primary dark" type="button">關閉</button></footer></form>';
document.body.append(detailDialog);
detailDialog.querySelectorAll('button').forEach(button => button.addEventListener('click', () => detailDialog.close()));
async function showDetail(id) {
  try {
    const order = await api.orderDetail(id);
    const lines = order.items.map(item => `<article><b>${esc(item.productName)}</b><span>${item.quantity} 件 ・ 每件 ${money(item.duePerUnitCents)}</span><small>${inventoryState(order, item)} ・ 商品售價 ${money(item.unitPriceCents)}</small></article>`).join('');
    detailDialog.querySelector('.history-list').innerHTML = `<article><b>${esc(order.orderNumber)}</b><span>${names[order.status] || order.status} ・ ${money(order.amountDueCents)}</span><small>${esc(order.customerEmail)} ・ 建立於 ${expiry(order.createdAt)}</small></article>${lines || '<p class="empty-history">此訂單沒有品項資料。</p>'}`;
    detailDialog.showModal();
  } catch (error) { state.textContent = `讀取訂單明細失敗：${error.message}`; state.classList.add('failed'); }
}
rows.addEventListener('click', event => { const id = event.target.dataset.detail; if (id) showDetail(id); });
searchInput.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);
document.querySelector('#export-orders').addEventListener('click', exportOrders);
applyFilters();
if (api.enabled) api.listOrders().then(data => { orders = data; applyFilters(); state.textContent = '已連線正式 API：訂單僅供查看，付款結果由金流回呼寫入。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線正式 API：${error.message}`; state.classList.add('failed'); });
