const demoContent = [{ title: '九月會員日：卡牌周邊 9 折', kind: 'promotion', startsAt: '2026-09-01', endsAt: '2026-09-30', status: 'published' }, { title: '寶可夢卡牌交流賽', kind: 'event', startsAt: '2026-09-06', endsAt: null, status: 'published' }];
let posts = demoContent;
const rows = document.querySelector('#rows');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('.toast');
const api = window.JiangnanAdminApi;
const state = document.querySelector('[data-connection-state]');
const names = { event: '活動', notice: '公告', promotion: '優惠' };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const date = value => value ? new Date(value).toLocaleDateString('zh-TW').replaceAll('/', '.') : '未排程';
function render() { rows.innerHTML = posts.map(post => `<tr><td><b>${esc(post.title)}</b></td><td>${names[post.kind] || post.kind}</td><td>${date(post.startsAt)}${post.endsAt ? ` - ${date(post.endsAt)}` : ''}</td><td><span class="status ${post.status === 'published' ? 'live' : ''}">${post.status === 'published' ? '發布中' : '草稿'}</span></td></tr>`).join(''); }
function message(value) { toast.textContent = value; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }
render();
document.querySelector('#open').onclick = () => dialog.showModal();
document.querySelector('#form').onsubmit = event => { event.preventDefault(); if (api.enabled) return message('正式內容建立需完整內文與 URL slug，請待 CMS 表單完成後使用。'); const form = new FormData(event.currentTarget); posts.unshift({ title: form.get('title'), kind: ({ 活動: 'event', 公告: 'notice', 優惠: 'promotion' })[form.get('kind')], startsAt: null, endsAt: null, status: 'draft' }); render(); dialog.close(); message('展示資料草稿已儲存。'); };
if (api.enabled) api.listContent().then(data => { posts = data; render(); state.textContent = '已連線正式 API：內容資料依 OIDC 權限讀取。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線正式 API：${error.message}`; state.classList.add('failed'); });
