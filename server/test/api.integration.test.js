import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.API_TEST_BASE?.replace(/\/$/, '');
const integration = baseUrl ? test : test.skip;

async function request(path, { role, customerToken, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(role ? { 'x-demo-role': role } : {}), ...(customerToken ? { authorization: `Bearer ${customerToken}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

function uniqueSku() {
  return `TEST-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
}

async function createVerifiedCustomer() {
  const email = `member-${crypto.randomUUID()}@example.test`;
  const rejected = await request('/api/v1/customer/register', { method: 'POST', body: { email, password: 'TestPassword123!', fullName: '整合測試會員', postalCode: '114', addressCity: '臺北市', addressDistrict: '內湖區', addressLine: '江南街105號', termsAccepted: false, privacyAccepted: true } });
  assert.equal(rejected.status, 400);
  const registration = await request('/api/v1/customer/register', { method: 'POST', body: { email, password: 'TestPassword123!', fullName: '整合測試會員', postalCode: '114', addressCity: '臺北市', addressDistrict: '內湖區', addressLine: '江南街105號', termsAccepted: true, privacyAccepted: true } });
  assert.equal(registration.status, 201);
  const verified = await request('/api/v1/customer/email-verifications', { method: 'POST', body: { email, code: registration.body.data.verificationCode } });
  assert.equal(verified.status, 200);
  return { token: verified.body.data.token };
}

integration('健康檢查可用', async () => {
  const result = await request('/health');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: 'ok' });
});

integration('管理 API 會依角色拒絕未授權讀取', async () => {
  const forbidden = await request('/api/v1/admin/users', { role: 'product_editor' });
  assert.equal(forbidden.status, 403);

  const allowed = await request('/api/v1/admin/users', { role: 'admin' });
  assert.equal(allowed.status, 200);
  assert.ok(Array.isArray(allowed.body.data));
});

integration('管理 API 拒絕非 UUID 資源識別碼', async () => {
  const result = await request('/api/v1/admin/products/not-a-uuid/change-history', { role: 'product_editor' });
  assert.equal(result.status, 400);
});

integration('商品上架需雙人核准，且拒絕不合法活動價與圖片網址', async () => {
  const invalidPrice = await request('/api/v1/admin/products', {
    role: 'product_editor', method: 'POST', body: {
      sku: uniqueSku(), name: '測試活動價商品', kind: 'in_stock', category: 'booster', priceCents: 1000, originalPriceCents: 900,
      depositCents: null, availableStock: 3, releaseDate: null, imageUrl: null, status: 'draft'
    }
  });
  assert.equal(invalidPrice.status, 400);

  const invalidImage = await request('/api/v1/admin/products', {
    role: 'product_editor', method: 'POST', body: {
      sku: uniqueSku(), name: '測試圖片網址商品', kind: 'in_stock', category: 'booster', priceCents: 1000, originalPriceCents: null,
      depositCents: null, availableStock: 3, releaseDate: null, imageUrl: 'javascript:alert(1)', status: 'draft'
    }
  });
  assert.equal(invalidImage.status, 400);

  const created = await request('/api/v1/admin/products', {
    role: 'product_editor', method: 'POST', body: {
      sku: uniqueSku(), name: '測試雙人核准商品', kind: 'in_stock', category: 'toy_model', priceCents: 1000, originalPriceCents: 1200,
      depositCents: null, availableStock: 3, releaseDate: null, imageUrl: 'https://example.com/product.webp', status: 'published'
    }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'pending_review');

  const selfApproval = await request(`/api/v1/admin/products/${created.body.data.id}/approve`, { role: 'product_editor', method: 'POST' });
  assert.equal(selfApproval.status, 403);

  const approval = await request(`/api/v1/admin/products/${created.body.data.id}/approve`, { role: 'admin', method: 'POST' });
  assert.equal(approval.status, 200);
  assert.equal(approval.body.data.status, 'published');
});

integration('結帳意圖使用冪等鍵且現貨只保留一次', async () => {
  const products = await request('/api/v1/public/products');
  const product = products.body.data.find(item => item.kind === 'in_stock' && item.availableStock >= 2);
  assert.ok(product, '需要一個至少有兩件庫存的現貨商品');
  const member = await createVerifiedCustomer();
  const unverified = await request('/api/v1/checkout/intents', { method: 'POST', customerToken: member.token, body: { idempotencyKey: crypto.randomUUID(), items: [{ productId: product.id, quantity: 1 }] } });
  assert.equal(unverified.status, 403);
  const phone = await request('/api/v1/customer/phone-verifications', { method: 'POST', customerToken: member.token, body: { phone: '0912345678' } });
  assert.equal(phone.status, 202);
  const phoneVerified = await request('/api/v1/customer/phone-verifications/confirm', { method: 'POST', customerToken: member.token, body: { code: phone.body.data.verificationCode } });
  assert.equal(phoneVerified.status, 200);
  const key = crypto.randomUUID();
  const payload = { idempotencyKey: key, items: [{ productId: product.id, quantity: 1 }] };

  const first = await request('/api/v1/checkout/intents', { method: 'POST', customerToken: member.token, body: payload });
  const second = await request('/api/v1/checkout/intents', { method: 'POST', customerToken: member.token, body: payload });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(first.body.data.id, second.body.data.id);
  assert.equal(first.body.data.amountDueCents, product.priceCents);

  const after = await request('/api/v1/public/products');
  const updated = after.body.data.find(item => item.id === product.id);
  assert.equal(updated.availableStock, product.availableStock - 1);
});

integration('寄售案件只允許既定狀態轉換', async () => {
  const created = await request('/api/v1/admin/consignments', {
    role: 'consignment_staff', method: 'POST', body: {
      sellerName: '整合測試寄售人', sellerContact: 'integration@example.test',
      items: [{ cardName: '測試卡牌', cardNumber: null, cardCondition: 'NM', suggestedPriceCents: 500 }]
    }
  });
  assert.equal(created.status, 201);

  const invalid = await request(`/api/v1/admin/consignments/${created.body.data.id}/status`, { role: 'consignment_staff', method: 'POST', body: { status: 'listed' } });
  assert.equal(invalid.status, 409);

  const received = await request(`/api/v1/admin/consignments/${created.body.data.id}/status`, { role: 'consignment_staff', method: 'POST', body: { status: 'received' } });
  assert.equal(received.status, 200);
  assert.equal(received.body.data.status, 'received');
});
