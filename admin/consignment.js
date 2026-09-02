const demoCases = [{ caseNumber: 'JC-20260902-A1B2C3', sellerName: '陳小姐', itemCount: 2, status: 'submitted' }, { caseNumber: 'JC-20260901-C8D2E1', sellerName: '林先生', itemCount: 4, status: 'received' }];
let cases = demoCases;
const api = window.JiangnanAdminApi;
const rows = document.querySelector('#rows'); const dialog = document.querySelector('#dialog'); const toast = document.querySelector('.toast'); const state = document.querySelector('[data-connection-state]');
const names = { submitted: '送件', received: '收件', listed: '上架', returned: '退還', cancelled: '取消' };
const transitions = { submitted: [{ status: 'received', label: '確認收件' }, { status: 'cancelled', label: '取消案件' }], received: [{ status: 'listed', label: '標記上架' }, { status: 'returned', label: '退還寄售人' }], listed: [{ status: 'returned', label: '退還寄售人' }] };
const form = document.querySelector('#form');
const formGrid = form.querySelector('.form-grid');
const cardFields = ['card', 'condition', 'price'].map(name => form.querySelector(`[name="${name}"]`).closest('label'));
const itemsHost = document.createElement('div');
itemsHost.className = 'consignment-items full';
itemsHost.innerHTML = '<div class="consignment-items-head"><b>卡片明細</b><button class="ghost" type="button" data-add-card>＋ 新增卡片</button></div><div class="consignment-item-list"></div>';
formGrid.insertBefore(itemsHost, cardFields[0]);
cardFields.forEach(field => field.remove());
const itemList = itemsHost.querySelector('.consignment-item-list');
const maxItems = 100;
function addCardItem() {
  if (itemList.children.length >= maxItems) return message(`單一案件最多 ${maxItems} 張卡片。`);
  const item = document.createElement('fieldset');
  item.className = 'consignment-item';
  item.innerHTML = '<legend>卡片</legend><label>卡片名稱<input required name="cardName"></label><label>卡號（選填）<input name="cardNumber" maxlength="80"></label><label>品相<select name="cardCondition"><option>NM</option><option>EX</option><option>LP</option></select></label><label>建議售價（NT$）<input required type="number" name="suggestedPrice" min="0"></label><button class="ghost" type="button" data-remove-card>移除</button>';
  itemList.append(item);
}
function resetCardItems() { itemList.replaceChildren(); addCardItem(); }
itemsHost.querySelector('[data-add-card]').addEventListener('click', addCardItem);
itemList.addEventListener('click', event => { if (event.target.matches('[data-remove-card]')) { if (itemList.children.length === 1) return message('案件至少需要一張卡片。'); event.target.closest('.consignment-item').remove(); } });
const itemStyle = document.createElement('style');
itemStyle.textContent = '.consignment-items{grid-column:1/-1;border-top:1px solid var(--line);padding-top:16px}.consignment-items-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.consignment-item-list{display:grid;gap:10px}.consignment-item{display:grid;grid-template-columns:1.5fr 1fr .8fr 1fr auto;gap:10px;align-items:end;border:1px solid var(--line);padding:12px;margin:0}.consignment-item legend{font-size:12px;font-weight:700;padding:0 4px}.consignment-item .ghost{align-self:end}@media(max-width:700px){.consignment-item{grid-template-columns:1fr 1fr}.consignment-item .ghost{grid-column:1/-1}}';
document.head.append(itemStyle);
resetCardItems();
function render() { rows.innerHTML = cases.map(item => { const actions = (transitions[item.status] || []).map(action => `<button class="ghost" data-id="${item.id || item.caseNumber}" data-next="${action.status}">${action.label}</button>`).join(''); return `<tr><td><b>${item.caseNumber}</b></td><td>${item.sellerName}</td><td>${item.itemCount}</td><td><span class="status ${item.status === 'listed' ? 'live' : item.status === 'received' ? 'scheduled' : ''}">${names[item.status] || item.status}</span></td><td class="case-actions">${actions || '<small>無可執行操作</small>'}</td></tr>`; }).join(''); }
function message(value) { toast.textContent = value; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
async function refresh() { cases = await api.listConsignments(); render(); }
render(); document.querySelector('#open').onclick = () => { form.reset(); resetCardItems(); dialog.showModal(); };
form.onsubmit = async event => { event.preventDefault(); const values = new FormData(event.currentTarget); const input = { sellerName: values.get('name'), sellerContact: values.get('contact'), items: [...itemList.children].map(item => ({ cardName: item.querySelector('[name="cardName"]').value, cardNumber: item.querySelector('[name="cardNumber"]').value || null, cardCondition: item.querySelector('[name="cardCondition"]').value, suggestedPriceCents: Number(item.querySelector('[name="suggestedPrice"]').value) })) }; try { if (api.enabled) { await api.createConsignment(input); await refresh(); state.textContent = '已連線正式 API：案件建立與狀態均受伺服器流程限制。'; state.classList.add('connected'); message('寄售案件已建立。'); } else { cases.unshift({ caseNumber: 'JC-展示資料', sellerName: input.sellerName, itemCount: input.items.length, status: 'submitted' }); render(); message('展示資料案件已建立。'); } dialog.close(); event.currentTarget.reset(); resetCardItems(); } catch (error) { message(error.message || '案件建立失敗。'); } };
if (api.enabled) refresh().then(() => { state.textContent = '已連線正式 API：寄售案件依 OIDC 權限讀取。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線正式 API：${error.message}`; state.classList.add('failed'); });
rows.addEventListener('click', async event => { const id = event.target.dataset.id; const next = event.target.dataset.next; if (!id || !next) return; try { if (api.enabled) { await api.updateConsignmentStatus(id, next); await refresh(); state.textContent = '已連線正式 API：狀態變更已由伺服器流程驗證。'; state.classList.add('connected'); } else { cases = cases.map(item => (item.id || item.caseNumber) === id ? { ...item, status: next } : item); render(); } message(`案件已更新為「${names[next]}」。`); } catch (error) { message(error.message || '案件狀態更新失敗。'); } });
