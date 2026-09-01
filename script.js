const cart = [];
const panel = document.querySelector('.cart-panel');
const scrim = document.querySelector('.scrim');
const items = document.querySelector('.cart-items');
const count = document.querySelector('.cart-count');
const total = document.querySelector('.cart-total');
const checkout = document.querySelector('.checkout');
const formatter = new Intl.NumberFormat('zh-TW');

function renderIcons() { lucide.createIcons(); }
function renderCart() {
  items.innerHTML = cart.length ? cart.map((item, index) => `<article class="cart-item"><div><b>${item.name}</b><small>${item.type}</small></div><div><b>NT$ ${formatter.format(item.price)}</b><button data-remove="${index}">移除</button></div></article>`).join('') : '<p class="empty">尚未加入商品</p>';
  const amount = cart.reduce((sum, item) => sum + item.price, 0);
  total.textContent = `NT$ ${formatter.format(amount)}`;
  count.textContent = cart.length;
  count.classList.toggle('has-items', cart.length > 0);
  checkout.disabled = cart.length === 0;
}
function setCart(open) { panel.classList.toggle('open', open); scrim.classList.toggle('open', open); panel.setAttribute('aria-hidden', String(!open)); }
document.querySelectorAll('.add').forEach(button => button.addEventListener('click', () => { cart.push({ name: button.dataset.name, price: Number(button.dataset.price), type: button.dataset.type }); renderCart(); setCart(true); }));
document.querySelectorAll('.cart-trigger').forEach(button => button.addEventListener('click', () => setCart(true)));
document.querySelector('.cart-close').addEventListener('click', () => setCart(false));
scrim.addEventListener('click', () => setCart(false));
items.addEventListener('click', event => { const index = event.target.dataset.remove; if (index !== undefined) { cart.splice(Number(index), 1); renderCart(); } });
document.querySelector('.menu-button').addEventListener('click', event => { const nav = document.querySelector('.main-nav'); nav.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(nav.classList.contains('open'))); });
document.querySelectorAll('.filter button').forEach(button => button.addEventListener('click', () => { document.querySelector('.filter .selected').classList.remove('selected'); button.classList.add('selected'); }));
const dialog = document.querySelector('.consign-dialog');
document.querySelector('#consign-button').addEventListener('click', () => dialog.showModal());
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
const toast = document.querySelector('.toast');
document.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => { toast.textContent = button.dataset.toast; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }));
dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); dialog.close(); toast.textContent = '已收到寄售預約，正式版將寄出確認通知。'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); });
checkout.addEventListener('click', () => { toast.textContent = '示範原型：正式版將進入結帳與付款流程。'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); });
renderCart(); renderIcons();
