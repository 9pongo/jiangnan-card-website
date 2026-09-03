const demoContent = [
  { id: 'demo-promotion-001', slug: 'september-member-day', title: '九月會員日：卡牌周邊 9 折', kind: 'promotion', summary: '九月限定優惠。', body: '門市限定活動。', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-30T15:59:59.000Z', status: 'published' },
  { id: 'demo-event-001', slug: 'pokemon-meetup', title: '寶可夢卡牌交流賽', kind: 'event', summary: '週六下午卡牌交流活動。', body: '請至門市報名。', startsAt: '2026-09-06T06:00:00.000Z', endsAt: null, status: 'published' }
];
let posts = demoContent;
let editingId = null;
const rows = document.querySelector('#rows');
const dialog = document.querySelector('#dialog');
const form = document.querySelector('#form');
const toast = document.querySelector('.toast');
const api = window.JiangnanAdminApi;
const state = document.querySelector('[data-connection-state]');
const names = { event: '活動', notice: '公告', promotion: '優惠' };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const date = value => value ? new Date(value).toLocaleDateString('zh-TW').replaceAll('/', '.') : '未排程';
const inputDateTime = value => value ? new Date(value).toISOString().slice(0, 16) : '';
const asIso = value => value ? new Date(value).toISOString() : null;
const filters = document.createElement('div');
filters.className = 'toolbar content-toolbar';
filters.innerHTML = '<label>搜尋標題或 slug<input id="content-search" type="search" placeholder="例如 october-preorder"></label><label>內容狀態<select id="content-status"><option value="all">全部狀態</option><option value="published">發布中</option><option value="draft">草稿</option><option value="archived">已封存</option></select></label>';
const filterSummary = document.createElement('p');
filterSummary.className = 'sub content-filter-summary';
filterSummary.setAttribute('aria-live', 'polite');
rows.closest('.table-wrap').before(filters, filterSummary);
const searchInput = filters.querySelector('#content-search');
const statusFilter = filters.querySelector('#content-status');

function render(data = posts) {
  rows.innerHTML = data.length ? data.map(post => `<tr><td><b>${esc(post.title)}</b><small>/${esc(post.slug)}</small></td><td>${names[post.kind] || post.kind}</td><td>${date(post.startsAt)}${post.endsAt ? ` - ${date(post.endsAt)}` : ''}</td><td><span class="status ${post.status === 'published' ? 'live' : ''}">${post.status === 'published' ? '發布中' : post.status === 'archived' ? '已封存' : '草稿'}</span></td><td><button class="ghost" data-edit="${post.id}">編輯</button></td></tr>`).join('') : '<tr><td colspan="5"><small>找不到符合條件的內容。</small></td></tr>';
}
function applyFilters() { const term = searchInput.value.trim().toLocaleLowerCase('zh-TW'); const status = statusFilter.value; const filtered = posts.filter(post => (status === 'all' || post.status === status) && (!term || `${post.title} ${post.slug} ${post.summary}`.toLocaleLowerCase('zh-TW').includes(term))); render(filtered); filterSummary.textContent = `顯示 ${filtered.length}／${posts.length} 筆內容`; }
function message(value) { toast.textContent = value; toast.classList.add('show'); clearTimeout(message.timeout); message.timeout = setTimeout(() => toast.classList.remove('show'), 2600); }
async function refresh() { posts = await api.listContent(); applyFilters(); }
function openNew() {
  editingId = null;
  form.reset();
  document.querySelector('#content-dialog-eyebrow').textContent = 'NEW CONTENT';
  document.querySelector('#content-dialog-title').textContent = '建立活動或公告';
  dialog.showModal();
}
function openEdit(id) {
  const post = posts.find(item => item.id === id);
  if (!post) return message('找不到內容資料，請重新整理後再試。');
  editingId = id;
  form.title.value = post.title;
  form.slug.value = post.slug;
  form.kind.value = post.kind;
  form.status.value = post.status;
  form.summary.value = post.summary;
  form.body.value = post.body;
  form.startsAt.value = inputDateTime(post.startsAt);
  form.endsAt.value = inputDateTime(post.endsAt);
  document.querySelector('#content-dialog-eyebrow').textContent = 'EDIT CONTENT';
  document.querySelector('#content-dialog-title').textContent = '編輯活動或公告';
  dialog.showModal();
}

searchInput.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);
applyFilters();
document.querySelector('#open').addEventListener('click', openNew);
rows.addEventListener('click', event => { const id = event.target.dataset.edit; if (id) openEdit(id); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const values = new FormData(form);
  const input = { slug: values.get('slug'), kind: values.get('kind'), title: values.get('title'), summary: values.get('summary'), body: values.get('body'), startsAt: asIso(values.get('startsAt')), endsAt: asIso(values.get('endsAt')), status: values.get('status') };
  try {
    if (api.enabled) {
      await (editingId ? api.updateContent(editingId, input) : api.createContent(input));
      await refresh();
      state.textContent = '已連線本機 API：內容已依權限儲存。';
      state.classList.add('connected');
      message(editingId ? '內容已更新。' : '內容已建立。');
    } else {
      if (editingId) posts = posts.map(post => post.id === editingId ? { ...post, ...input } : post);
      else posts.unshift({ id: `demo-${Date.now()}`, ...input });
      applyFilters();
      message(editingId ? '展示內容已更新。' : '展示內容已建立。');
    }
    dialog.close();
  } catch (error) { message(error.message || '內容儲存失敗。'); }
});
if (api.enabled) refresh().then(() => { state.textContent = '已連線本機 API：內容資料依權限讀取。'; state.classList.add('connected'); }).catch(error => { state.textContent = `無法連線本機 API：${error.message}`; state.classList.add('failed'); });
