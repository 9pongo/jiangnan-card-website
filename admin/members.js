const api = window.JiangnanAdminApi;
const userRows = document.querySelector('#users'); const auditRows = document.querySelector('#audit'); const state = document.querySelector('[data-connection-state]');
const demoUsers = [{ displayName: '王店長', email: 'm***@example.com', role: 'admin' }, { displayName: '張商品', email: 'p***@example.com', role: 'product_editor' }];
const demoAudit = [{ createdAt: '2026-09-02T16:40:00+08:00', actor: '王店長', action: 'banner.approved', entityType: 'banner' }, { createdAt: '2026-09-02T15:22:00+08:00', actor: '張商品', action: 'product.created', entityType: 'product' }];
const roleName = { admin: '系統管理員', product_editor: '商品編輯', content_editor: '內容編輯', ad_operator: '廣告營運', consignment_staff: '寄售人員' };
function renderUsers(data) { userRows.innerHTML = data.map(user => `<tr><td><b>${user.displayName}</b></td><td>${user.email}</td><td>${roleName[user.role] || user.role}</td></tr>`).join(''); }
function renderAudit(data) { auditRows.innerHTML = data.map(log => `<tr><td>${new Date(log.createdAt).toLocaleString('zh-TW')}</td><td><b>${log.actor}</b></td><td>${log.action}</td><td>${log.entityType}</td></tr>`).join(''); }
renderUsers(demoUsers); renderAudit(demoAudit);
if (api.enabled) Promise.all([api.listUsers(), api.listAuditLog()]).then(([users, audit]) => { renderUsers(users); renderAudit(audit); state.textContent = '已連線正式 API：成員與稽核僅限管理員角色讀取。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線正式 API：${error.message}`; state.classList.add('failed'); });
