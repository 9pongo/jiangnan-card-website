(function () {
  const base = String(window.JIANGNAN_ADMIN_API_BASE || '').replace(/\/$/, '');
  const getToken = window.JIANGNAN_GET_ACCESS_TOKEN;
  const demoRole = window.JIANGNAN_DEMO_ROLE;

  async function request(path, options) {
    if (!base) throw new Error('後台尚未設定正式 API。');
    if (!demoRole && typeof getToken !== 'function') throw new Error('尚未登入公司 SSO。');
    const token = demoRole ? null : await getToken();
    if (!demoRole && !token) throw new Error('尚未登入公司 SSO。');
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(demoRole ? { 'x-demo-role': demoRole } : {}), 'content-type': 'application/json', ...(options?.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || '後台服務暫時無法使用。');
    return body.data;
  }

  const nav = document.querySelector('.sidebar nav');
  if (nav) {
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    const links = [
      ['index.html', '總覽'],
      ['index.html#banners', 'Banner 與廣告'],
      ['products.html', '商品管理'],
      ['content.html', '活動與公告'],
      ['consignment.html', '卡牌寄售'],
      ['orders.html', '訂單'],
      ['members.html', '成員與權限']
    ];
    nav.replaceChildren(...links.map(([href, label]) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      const isBannerView = currentPage === 'index.html' && location.hash === '#banners';
      if (href.includes('#') ? isBannerView : !isBannerView && href === currentPage) link.className = 'active';
      return link;
    }));
  }

  document.querySelectorAll('dialog button.close, dialog button[value="cancel"]').forEach(button => {
    button.type = 'button';
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  window.JiangnanAdminApi = {
    enabled: Boolean(base && (demoRole || typeof getToken === 'function')), request,
    listBanners: () => request('/api/v1/admin/banners'),
    createBanner: input => request('/api/v1/admin/banners', { method: 'POST', body: JSON.stringify(input) }),
    submitBanner: id => request(`/api/v1/admin/banners/${id}/submit`, { method: 'POST' }),
    approveBanner: id => request(`/api/v1/admin/banners/${id}/approve`, { method: 'POST' }),
    disableBanner: id => request(`/api/v1/admin/banners/${id}/disable`, { method: 'POST' }),
    createBannerUploadIntent: input => request('/api/v1/admin/banner-assets/upload-intents', { method: 'POST', body: JSON.stringify(input) }),
    completeBannerUpload: id => request(`/api/v1/admin/banner-assets/${id}/complete`, { method: 'POST' }),
    listProducts: () => request('/api/v1/admin/products'),
    createProduct: input => request('/api/v1/admin/products', { method: 'POST', body: JSON.stringify(input) }),
    updateProduct: (id, input) => request(`/api/v1/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    approveProduct: id => request(`/api/v1/admin/products/${id}/approve`, { method: 'POST' }),
    rejectProduct: (id, reviewNote) => request(`/api/v1/admin/products/${id}/reject`, { method: 'POST', body: JSON.stringify({ reviewNote }) }),
    cancelProductChange: id => request(`/api/v1/admin/products/${id}/cancel-change`, { method: 'POST' }),
    productChangeHistory: id => request(`/api/v1/admin/products/${id}/change-history`),
    session: () => request('/api/v1/admin/session'),
    listContent: () => request('/api/v1/admin/content'),
    createContent: input => request('/api/v1/admin/content', { method: 'POST', body: JSON.stringify(input) }),
    updateContent: (id, input) => request(`/api/v1/admin/content/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    listOrders: () => request('/api/v1/admin/orders'),
    orderDetail: id => request(`/api/v1/admin/orders/${id}`),
    listConsignments: () => request('/api/v1/admin/consignments'),
    createConsignment: input => request('/api/v1/admin/consignments', { method: 'POST', body: JSON.stringify(input) }),
    updateConsignmentStatus: (id, status) => request(`/api/v1/admin/consignments/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
    listUsers: () => request('/api/v1/admin/users'),
    listAuditLog: () => request('/api/v1/admin/audit-log')
  };
})();
