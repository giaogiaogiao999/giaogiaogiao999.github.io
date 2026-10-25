(function () {
  'use strict';
  const config = window.LUMOSY_CLOUD_CONFIG || {};
  const productsUrl = String(config.blobUrl || '');
  const enabled = /^https:\/\//.test(productsUrl);
  const endpoint = (name) => productsUrl.replace(/\/products(?:\?.*)?$/, `/${name}`);

  async function request(name, options = {}) {
    const response = await fetch(endpoint(name), { ...options, cache: 'no-store' });
    if (response.status === 404) return {};
    if (!response.ok) throw new Error(`Cloud request failed: ${response.status}`);
    return response.json();
  }

  async function getList(name) {
    const data = await request(name);
    return Array.isArray(data?.[name]) ? data[name] : [];
  }

  async function saveList(name, items) {
    await request(name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [name]: items, updatedAt: new Date().toISOString() }) });
    return true;
  }

  async function getProducts() { return getList('products'); }
  async function saveProducts(products) { return saveList('products', products); }
  async function getInquiries() { return getList('inquiries'); }
  async function saveInquiries(inquiries) { return saveList('inquiries', inquiries); }
  async function appendInquiry(inquiry) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const current = await getInquiries();
        const merged = [inquiry, ...current.filter((item) => item.id !== inquiry.id)];
        await saveInquiries(merged);
        const verified = await getInquiries();
        if (verified.some((item) => item.id === inquiry.id)) return verified;
        throw new Error('Inquiry was not present after saving.');
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError || new Error('Inquiry could not be saved.');
  }
  async function getCategories() { return getList('categories'); }
  async function saveCategories(categories) { return saveList('categories', categories); }

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
    let maxSide = 320;
    let quality = 0.58;
    let result = source;
    while (maxSide >= 160) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL('image/jpeg', quality);
      if (result.length < 18000) break;
      maxSide -= 40;
      quality = Math.max(0.38, quality - 0.05);
    }
    return result;
  }

  window.LumosyCloud = { enabled, getProducts, saveProducts, getInquiries, saveInquiries, appendInquiry, getCategories, saveCategories, uploadImage };
})();
