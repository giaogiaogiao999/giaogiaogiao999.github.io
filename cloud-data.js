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
  async function getUsers() { return getList('users'); }
  async function saveUsers(users) { return saveList('users', users); }
  async function appendUser(user) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const current = await getUsers();
        if (current.some((item) => String(item.email).toLowerCase() === String(user.email).toLowerCase())) {
          const error = new Error('ACCOUNT_EXISTS');
          error.code = 'ACCOUNT_EXISTS';
          throw error;
        }
        const merged = [...current, user];
        await saveUsers(merged);
        const verified = await getUsers();
        if (verified.some((item) => item.id === user.id)) return verified;
        throw new Error('Account was not present after saving.');
      } catch (error) {
        if (error?.code === 'ACCOUNT_EXISTS') throw error;
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError || new Error('Account could not be saved.');
  }
  async function updateUser(user) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const current = await getUsers();
        const index = current.findIndex((item) => item.id === user.id);
        if (index < 0) throw new Error('Account not found.');
        current[index] = user;
        await saveUsers(current);
        const verified = await getUsers();
        const saved = verified.find((item) => item.id === user.id);
        if (saved && saved.updatedAt === user.updatedAt) return verified;
        throw new Error('Account update was not verified.');
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError || new Error('Account could not be updated.');
  }
  async function getAuditLogs() { return getList('auditLogs'); }
  async function saveAuditLogs(auditLogs) { return saveList('auditLogs', auditLogs); }
  async function appendAuditLog(entry) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const current = await getAuditLogs();
        const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 500);
        await saveAuditLogs(next);
        const verified = await getAuditLogs();
        if (verified.some((item) => item.id === entry.id)) return verified;
        throw new Error('Operation log was not present after saving.');
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError || new Error('Operation log could not be saved.');
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

  window.LumosyCloud = {
    enabled, getProducts, saveProducts, getInquiries, saveInquiries, appendInquiry,
    getCategories, saveCategories, getUsers, saveUsers, appendUser, updateUser, getAuditLogs, saveAuditLogs,
    appendAuditLog, uploadImage
  };
})();
