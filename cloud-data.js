(function () {
  'use strict';
  const config = window.LUMOSY_CLOUD_CONFIG || {};
  const blobUrl = String(config.blobUrl || '');
  const enabled = /^https:\/\//.test(blobUrl);

  async function request(options = {}) {
    const response = await fetch(blobUrl, { ...options, cache: 'no-store' });
    if (!response.ok) throw new Error(`Cloud request failed: ${response.status}`);
    return response.json();
  }

  async function getProducts() {
    const data = await request();
    return Array.isArray(data?.products) ? data.products : [];
  }

  async function saveProducts(products) {
    await request({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products, updatedAt: new Date().toISOString() }) });
    return true;
  }

  async function uploadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  window.LumosyCloud = { enabled, getProducts, saveProducts, uploadImage };
})();
