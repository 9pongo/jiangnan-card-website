const customerApiBase = String(window.JIANGNAN_API_BASE || '').replace(/\/$/, '');
const tokenKey = 'jiangnan-customer-token';
let customer = null;
let verificationEmail = '';
let resetEmail = '';
const memberDialog = document.querySelector('#member-dialog');
const phoneDialog = document.querySelector('#phone-dialog');
const memberMessage = memberDialog?.querySelector('.member-message');
const phoneMessage = phoneDialog?.querySelector('.member-message');
function token() { return sessionStorage.getItem(tokenKey); }
function say(host, text) { if (host) host.textContent = text; }
async function customerRequest(path, options = {}) {
  if (!customerApiBase) throw new Error('此展示站尚未連接會員服務。');
  const response = await fetch(`${customerApiBase}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(token() ? { authorization: `Bearer ${token()}` } : {}), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '會員服務暫時無法使用。');
  return body.data;
}
function showMemberView(name) { memberDialog?.querySelectorAll('[data-member-view]').forEach(view => { view.hidden = view.dataset.memberView !== name; }); say(memberMessage, ''); }
function hydrateProfile() { const form = document.querySelector('#member-profile-form'); if (!form || !customer) return; for (const key of ['fullName', 'postalCode', 'addressCity', 'addressDistrict', 'addressLine', 'phone']) form.elements[key].value = customer[key] || ''; document.querySelector('[data-member-email]').textContent = `${customer.email}（帳號不可修改）`; }
function openMember() { if (!memberDialog) return; showMemberView(customer ? 'profile' : 'login'); hydrateProfile(); memberDialog.showModal(); }
function renderTrigger() { const trigger = document.querySelector('.member-trigger'); if (!trigger) return; trigger.setAttribute('aria-label', customer ? '開啟會員中心' : '登入或註冊會員'); }
async function restoreCustomer() { if (!token()) return; try { customer = await customerRequest('/api/v1/customer/profile'); renderTrigger(); } catch { sessionStorage.removeItem(tokenKey); } }
function demoCode(data, label) { return data?.verificationCode ? `本機驗收碼：${data.verificationCode}。正式環境會改由${label}發送。` : `驗證碼已送出。`; }
document.querySelector('.member-trigger')?.addEventListener('click', openMember);
memberDialog?.querySelectorAll('[data-member-mode]').forEach(button => button.addEventListener('click', () => showMemberView(button.dataset.memberMode)));
document.querySelector('#member-register-form')?.addEventListener('submit', async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { const data = await customerRequest('/api/v1/customer/register', { method: 'POST', body: JSON.stringify(values) }); verificationEmail = values.email.trim().toLowerCase(); showMemberView('verify'); say(memberMessage, demoCode(data, '電子郵件')); } catch (error) { say(memberMessage, error.message); } });
document.querySelector('#member-verify-form')?.addEventListener('submit', async event => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); const data = await customerRequest('/api/v1/customer/email-verifications', { method: 'POST', body: JSON.stringify({ email: verificationEmail, code: values.code }) }); customer = data.customer; sessionStorage.setItem(tokenKey, data.token); renderTrigger(); memberDialog.close(); } catch (error) { say(memberMessage, error.message); } });
document.querySelector('#member-login-form')?.addEventListener('submit', async event => { event.preventDefault(); try { const data = await customerRequest('/api/v1/customer/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); customer = data.customer; sessionStorage.setItem(tokenKey, data.token); renderTrigger(); memberDialog.close(); } catch (error) { say(memberMessage, error.message); } });
document.querySelector('#member-reset-request-form')?.addEventListener('submit', async event => { event.preventDefault(); try { resetEmail = new FormData(event.currentTarget).get('email').trim().toLowerCase(); const data = await customerRequest('/api/v1/customer/password-resets', { method: 'POST', body: JSON.stringify({ email: resetEmail }) }); document.querySelector('#member-reset-confirm-form').hidden = false; say(memberMessage, demoCode(data, '電子郵件')); } catch (error) { say(memberMessage, error.message); } });
document.querySelector('#member-reset-confirm-form')?.addEventListener('submit', async event => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); await customerRequest('/api/v1/customer/password-resets/confirm', { method: 'POST', body: JSON.stringify({ ...values, email: resetEmail }) }); showMemberView('login'); say(memberMessage, '密碼已更新，請使用新密碼登入。'); } catch (error) { say(memberMessage, error.message); } });
document.querySelector('#member-profile-form')?.addEventListener('submit', async event => { event.preventDefault(); try { customer = await customerRequest('/api/v1/customer/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); hydrateProfile(); say(memberMessage, '配送資料已儲存。手機號碼變更後需重新驗證。'); } catch (error) { say(memberMessage, error.message); } });
memberDialog?.querySelector('[data-member-logout]')?.addEventListener('click', async () => { try { await customerRequest('/api/v1/customer/session', { method: 'DELETE' }); } catch {} sessionStorage.removeItem(tokenKey); customer = null; renderTrigger(); showMemberView('login'); });
document.querySelector('#phone-request-form')?.addEventListener('submit', async event => { event.preventDefault(); try { const data = await customerRequest('/api/v1/customer/phone-verifications', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); document.querySelector('#phone-confirm-form').hidden = false; say(phoneMessage, demoCode(data, '簡訊')); } catch (error) { say(phoneMessage, error.message); } });
document.querySelector('#phone-confirm-form')?.addEventListener('submit', async event => { event.preventDefault(); try { customer = await customerRequest('/api/v1/customer/phone-verifications/confirm', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); phoneDialog.close(); document.dispatchEvent(new CustomEvent('jiangnan:phone-verified')); } catch (error) { say(phoneMessage, error.message); } });
window.JiangnanCustomer = { get customer() { return customer; }, openMember, async requirePhone() { if (!customer) { openMember(); return false; } if (customer.phoneVerifiedAt) return true; document.querySelector('#phone-request-form').reset(); document.querySelector('#phone-confirm-form').hidden = true; say(phoneMessage, ''); phoneDialog.showModal(); return false; }, request: customerRequest };
restoreCustomer();
