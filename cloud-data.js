(function () {
  'use strict';
  const config = window.LUMOSY_CLOUD_CONFIG || {};
  const enabled = /^https:\/\/.+\.supabase\.co$/.test(config.url || '') && Boolean(config.anonKey);
  const headers = (extra = {}) => ({ apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, ...extra });
  async function request(path, options = {}) {
    const response = await fetch(`${config.url}${path}`, { ...options, headers: headers(options.headers), cache: 'no-store' });
    if (!response.ok) throw new Error(await response.text());
    return response.status === 204 ? null : response.json();
  }
  async function getProducts() {
    const rows = await request('/rest/v1/site_state?key=eq.products&select=value');
    return Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
  }
  async function saveProducts(products) {
    await request('/rest/v1/rpc/set_site_state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_key: 'products', p_value: products }) });
    return true;
  }
  async function uploadImage(file) {
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[file.type];
    if (!extension) throw new Error('Invalid image');
    const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    await request(`/storage/v1/object/product-images/${filename}`, { method: 'POST', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
    return `${config.url}/storage/v1/object/public/product-images/${filename}`;
  }
  window.LumosyCloud = { enabled, getProducts, saveProducts, uploadImage };
})();
