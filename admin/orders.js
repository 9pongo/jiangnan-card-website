const demoOrders = [{ orderNumber: 'JC-20260902-AB12CD', customerEmail: 'd***@example.com', itemCount: 1, amountDueCents: 500, status: 'pending_payment' }, { orderNumber: 'JC-20260902-PK9001', customerEmail: 'm***@example.com', itemCount: 2, amountDueCents: 1490, status: 'pending_payment' }];
const api = window.JiangnanAdminApi;
const rows = document.querySelector('#rows');
const state = document.querySelector('[data-connection-state]');
const money = value => `NT$ ${Number(value).toLocaleString('zh-TW')}`;
const names = { pending_payment: '待付款', paid: '已付款', cancelled: '已取消', expired: '已逾時', fulfilled: '已履約' };
function expiry(value) { return value ? new Date(value).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未設定'; }
function render(data) { rows.innerHTML = data.map(order => `<tr><td><b>${order.orderNumber}</b></td><td>${order.customerEmail}</td><td>${order.itemCount}</td><td><b>${money(order.amountDueCents)}</b></td><td>${order.status === 'pending_payment' ? expiry(order.expiresAt) : '-'}</td><td><span class="status ${order.status === 'pending_payment' ? 'review' : order.status === 'paid' ? 'live' : ''}">${names[order.status] || order.status}</span></td></tr>`).join(''); }
render(demoOrders);
if (api.enabled) api.listOrders().then(data => { render(data); state.textContent = '已連線正式 API：訂單僅供查看，付款結果由金流回呼寫入。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線正式 API：${error.message}`; state.classList.add('failed'); });
