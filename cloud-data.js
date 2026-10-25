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
    await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products, updatedAt: new Date().toISOString() }) });
    return true;
  }

  async function uploadImage(file) {
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = source;
    });
    const scale = Math.min(1, 420 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.58);
  }

  window.LumosyCloud = { enabled, getProducts, saveProducts, uploadImage };
})();

