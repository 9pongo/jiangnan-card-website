const api = window.JiangnanAdminApi;
const userRows = document.querySelector('#users'); const auditRows = document.querySelector('#audit'); const state = document.querySelector('[data-connection-state]');
const demoUsers = [{ displayName: '王店長', email: 'm***@example.com', role: 'admin' }, { displayName: '張商品', email: 'p***@example.com', role: 'product_editor' }];
const demoAudit = [{ createdAt: '2026-09-02T16:40:00+08:00', actor: '王店長', action: 'banner.approved', entityType: 'banner' }, { createdAt: '2026-09-02T15:22:00+08:00', actor: '張商品', action: 'product.created', entityType: 'product' }];
const roleName = { admin: '系統管理員', product_editor: '商品編輯', content_editor: '內容編輯', ad_operator: '廣告營運', consignment_staff: '寄售人員' };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
let audit = demoAudit;
const auditFilters = document.createElement('div');
auditFilters.className = 'toolbar audit-toolbar';
auditFilters.innerHTML = '<label>搜尋操作人或動作<input id="audit-search" type="search" placeholder="例如 product.approved"></label><label>資料類型<select id="audit-entity"><option value="all">全部類型</option><option value="banner">Banner</option><option value="banner_asset">Banner 素材</option><option value="product">商品</option><option value="product_change">商品調價</option><option value="content">內容</option><option value="consignment">寄售</option><option value="order">訂單</option></select></label><button class="ghost" type="button" id="export-audit">匯出 CSV</button>';
const auditSummary = document.createElement('p');
auditSummary.className = 'sub audit-filter-summary';
auditSummary.setAttribute('aria-live', 'polite');
auditRows.closest('.table-wrap').before(auditFilters, auditSummary);
const auditSearch = auditFilters.querySelector('#audit-search');
const auditEntity = auditFilters.querySelector('#audit-entity');
function renderUsers(data) { userRows.innerHTML = data.map(user => `<tr><td><b>${esc(user.displayName)}</b></td><td>${esc(user.email)}</td><td>${esc(roleName[user.role] || user.role)}</td></tr>`).join(''); }
function renderAudit(data) { auditRows.innerHTML = data.length ? data.map(log => `<tr><td>${new Date(log.createdAt).toLocaleString('zh-TW')}</td><td><b>${esc(log.actor)}</b></td><td>${esc(log.action)}</td><td>${esc(log.entityType)}</td></tr>`).join('') : '<tr><td colspan="4"><small>找不到符合條件的稽核紀錄。</small></td></tr>'; }
function filteredAudit() { const term = auditSearch.value.trim().toLocaleLowerCase('zh-TW'); const entity = auditEntity.value; return audit.filter(log => (entity === 'all' || log.entityType === entity) && (!term || `${log.actor} ${log.action} ${log.entityType}`.toLocaleLowerCase('zh-TW').includes(term))); }
function applyAuditFilters() { const filtered = filteredAudit(); renderAudit(filtered); auditSummary.textContent = `顯示 ${filtered.length}／${audit.length} 筆稽核紀錄`; }
function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function exportAudit() { const records = filteredAudit(); const rows = [['時間', '操作人', '動作', '資料類型'], ...records.map(log => [new Date(log.createdAt).toISOString(), log.actor, log.action, log.entityType])]; const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`; const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `jiangnan-audit-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); }
auditSearch.addEventListener('input', applyAuditFilters);
auditEntity.addEventListener('change', applyAuditFilters);
auditFilters.querySelector('#export-audit').addEventListener('click', exportAudit);
renderUsers(demoUsers); applyAuditFilters();
if (api.enabled) Promise.all([api.listUsers(), api.listAuditLog()]).then(([users, logs]) => { audit = logs; renderUsers(users); applyAuditFilters(); state.textContent = '已連線正式 API：成員與稽核僅限管理員角色讀取。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線正式 API：${error.message}`; state.classList.add('failed'); });
