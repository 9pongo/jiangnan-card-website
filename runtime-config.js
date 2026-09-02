// Production deployment replaces these values with HTTPS origins.
// GitHub Pages stays in preview mode; localhost connects only to the Docker demo API.
const jiangnanLocalPreview = ['localhost', '127.0.0.1'].includes(location.hostname);
window.JIANGNAN_API_BASE = jiangnanLocalPreview ? 'http://localhost:3000' : '';
window.JIANGNAN_ADMIN_API_BASE = jiangnanLocalPreview ? 'http://localhost:3000' : '';
window.JIANGNAN_DEMO_ROLE = jiangnanLocalPreview ? 'admin' : '';
