(function () {
  'use strict';

  const USERS_KEY = 'lumosy_auth_users_v1';
  const SESSION_KEY = 'lumosy_auth_session_v1';
  const QUOTE_KEY = 'lumosy_static_quote_v1';
  const INQUIRIES_KEY = 'lumosy_inquiries_v1';
  const FAVORITES_KEY = 'lumosy_favorites_v1';
  const PRODUCTS_KEY = 'lumosy_products_v1';
  const CATEGORIES_KEY = 'lumosy_categories_v1';
  const AUDIT_LOGS_KEY = 'lumosy_audit_logs_v1';
  const DEFAULT_CATEGORIES = [
    ['Aluminum Carpet Transition Strip', '铝地毯过渡条', 'aluminum-carpet-transition-strip'],
    ['Aluminum Skirting Profile', '铝制踢脚线型材', 'aluminum-skirting-profile'],
    ['Aluminum Tile Edge Trim profile', '铝制瓷砖边缘装饰型材', 'aluminum-tile-edge-trim-profile'],
    ['Cabinet Aluminum Handle', '橱柜铝制手柄', 'cabinet-aluminum-handle'],
    ['LED Channel For Wall Panel', '墙面板LED通道', 'led-channel-for-wall-panel'],
    ['Wall Panel Edge Trim Profile', '墙板边缘装饰线条', 'wall-panel-edge-trim-profile'],
    ['Wall Panel Joint Profile', '墙板接缝剖面', 'wall-panel-joint-profile']
  ].map(([name, zh, slug]) => ({ id: `category-${slug}`, name, zh, slug, status: 'active', source: 'static' }));
  const isZh = location.pathname === '/zh' || location.pathname.startsWith('/zh/');
  const page = document.body.dataset.page;
  const route = (name) => `${isZh ? '/zh' : ''}/${name ? `${name}/` : ''}`;
  const copy = isZh ? {
    loginFailed: '邮箱或密码错误。', disabled: '该账号已被停用。',
    exists: '该邮箱已经注册。', mismatch: '两次输入的密码不一致。',
    weak: '密码至少需要 8 个字符。', registered: '注册成功，正在进入用户中心……',
    saved: '资料已保存。', adminAdded: '管理员账号已创建。', noQuote: '询价清单暂无产品。',
    noInquiry: '暂无询价记录。', noFavorite: '暂无收藏产品。', user: '普通用户', admin: '管理员', active: '正常', disabledLabel: '已停用',
    pending: '待处理', processing: '处理中', completed: '已完成', enable: '启用', disable: '停用', edit: '编辑', remove: '删除',
    productSaved: '产品已保存。', productRemoved: '产品已删除。', favoriteRemoved: '已取消收藏。', userUpdated: '用户状态已更新。', inquiryUpdated: '询价状态已更新。',
    confirmDelete: '确定删除这个自定义产品吗？', invalidQq: '请输入5至12位数字QQ号。',
    codeRequired: '请先获取并输入6位邮箱验证码。', codeFailed: '验证码错误或已过期，请重新获取。', codeSendFailed: '验证码发送失败，请稍后重试。', codeSent: '验证码已生成，10分钟内有效。', localCode: '本地测试验证码',
    imageUploading: '图片上传中……', imageUploaded: '图片上传成功', imageInvalid: '请选择 JPG、PNG、WEBP 或 GIF 图片（最大 8 MB）。', imageUploadFailed: '图片上传失败，请重试。',
    syncFailed: '云端同步失败，请检查网络后重试。数据尚未保存。'
  } : {
    loginFailed: 'Incorrect email address or password.', disabled: 'This account has been disabled.',
    exists: 'An account already exists for this email.', mismatch: 'The passwords do not match.',
    weak: 'Password must contain at least 8 characters.', registered: 'Registration complete. Opening your account…',
    saved: 'Profile saved.', adminAdded: 'Administrator account created.', noQuote: 'Your quote list is empty.',
    noInquiry: 'No inquiries yet.', noFavorite: 'No saved products yet.', user: 'User', admin: 'Administrator', active: 'Active', disabledLabel: 'Disabled',
    pending: 'Pending', processing: 'Processing', completed: 'Completed', enable: 'Enable', disable: 'Disable', edit: 'Edit', remove: 'Delete',
    productSaved: 'Product saved.', productRemoved: 'Product deleted.', favoriteRemoved: 'Favorite removed.', userUpdated: 'User status updated.', inquiryUpdated: 'Inquiry status updated.',
    confirmDelete: 'Delete this custom product?', invalidQq: 'Enter a valid QQ number containing 5 to 12 digits.',
    codeRequired: 'Request and enter the 6-digit email verification code.', codeFailed: 'The code is incorrect or expired. Request a new code.', codeSendFailed: 'Could not send the verification code. Try again.', codeSent: 'Verification code generated and valid for 10 minutes.', localCode: 'Local test code',
    imageUploading: 'Uploading image…', imageUploaded: 'Image uploaded', imageInvalid: 'Choose a JPG, PNG, WEBP or GIF image up to 8 MB.', imageUploadFailed: 'Image upload failed. Try again.',
    syncFailed: 'Cloud sync failed. Check your connection and try again. Nothing was saved.'
  };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const slugify = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  async function hashPassword(value) {
    const bytes = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function ensureAdministrator() {
    const users = read(USERS_KEY, []);
    if (users.some((user) => user.role === 'admin')) return;
    users.push({
      id: 'admin-lumosy', name: 'LUMOSY Administrator', email: 'admin@lumosy.com', phone: '', company: 'LUMOSY',
      passwordHash: await hashPassword('Admin123!'), role: 'admin', status: 'active', createdAt: new Date().toISOString()
    });
    write(USERS_KEY, users);
  }

  async function ensureUsers() {
    const localUsers = read(USERS_KEY, []);
    if (window.LumosyCloud?.enabled) {
      try {
        let cloudUsers = await window.LumosyCloud.getUsers();
        if (!cloudUsers.length) {
          cloudUsers = localUsers;
          await window.LumosyCloud.saveUsers(cloudUsers);
        } else {
          const missingLocalUsers = localUsers.filter((localUser) => !cloudUsers.some((cloudUser) => normalizeEmail(cloudUser.email) === normalizeEmail(localUser.email)));
          if (missingLocalUsers.length) {
            cloudUsers.push(...missingLocalUsers);
            await window.LumosyCloud.saveUsers(cloudUsers);
          }
        }
        write(USERS_KEY, cloudUsers);
        return cloudUsers;
      } catch (error) { console.warn('Cloud account loading failed; using local fallback.', error); }
    }
    return localUsers;
  }

  async function appendUser(user) {
    if (window.LumosyCloud?.enabled) {
      try {
        const next = await window.LumosyCloud.appendUser(user);
        write(USERS_KEY, next);
        return true;
      } catch (error) {
        if (error?.code === 'ACCOUNT_EXISTS' || error?.message === 'ACCOUNT_EXISTS') return 'exists';
        console.error('Cloud account save failed.', error);
        return false;
      }
    }
    const next = users();
    if (next.some((item) => item.email === user.email)) return 'exists';
    next.push(user);
    write(USERS_KEY, next);
    return true;
  }

  async function updateUser(user) {
    user.updatedAt = new Date().toISOString();
    if (window.LumosyCloud?.enabled) {
      try {
        const next = await window.LumosyCloud.updateUser(user);
        write(USERS_KEY, next);
        return true;
      } catch (error) { console.error('Cloud account update failed.', error); return false; }
    }
    const next = users();
    const index = next.findIndex((item) => item.id === user.id);
    if (index < 0) return false;
    next[index] = user;
    write(USERS_KEY, next);
    return true;
  }

  async function ensureProducts() {
    if (window.LumosyCloud?.enabled) {
      try {
        let products = await window.LumosyCloud.getProducts();
        if (!products.length) {
          const seedResponse = await fetch('/auth-products.json', { cache: 'no-store' });
          products = seedResponse.ok ? await seedResponse.json() : [];
          if (products.length) await window.LumosyCloud.saveProducts(products);
        }
        write(PRODUCTS_KEY, products);
        return products;
      } catch (error) { console.warn('Cloud product loading failed; using local fallback.', error); }
    }
    try {
      const response = await fetch('/api/products', { cache: 'no-store' });
      if (!response.ok) throw new Error('shared product API unavailable');
      const products = (await response.json()).products;
      write(PRODUCTS_KEY, products);
      return products;
    } catch {
      const saved = read(PRODUCTS_KEY, null);
      if (Array.isArray(saved) && saved.length) return saved;
      try {
        const response = await fetch('/auth-products.json', { cache: 'no-store' });
        if (!response.ok) return [];
        const products = await response.json();
        write(PRODUCTS_KEY, products);
        return products;
      } catch { return []; }
    }
  }

  async function syncManagedProducts(products) {
    if (window.LumosyCloud?.enabled) {
      try { return await window.LumosyCloud.saveProducts(products); }
      catch (error) { console.error('Cloud product save failed.', error); return false; }
    }
    try {
      const response = await fetch('/api/admin/products', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Lumosy-Admin': 'local-preview' }, body: JSON.stringify({ products }) });
      return response.ok;
    } catch { return false; }
  }

  async function ensureCategories() {
    if (window.LumosyCloud?.enabled) {
      try {
        let categories = await window.LumosyCloud.getCategories();
        if (!categories.length) { categories = DEFAULT_CATEGORIES; await window.LumosyCloud.saveCategories(categories); }
        write(CATEGORIES_KEY, categories);
        return categories;
      } catch (error) { console.warn('Cloud category loading failed.', error); }
    }
    const saved = read(CATEGORIES_KEY, null);
    const categories = Array.isArray(saved) && saved.length ? saved : DEFAULT_CATEGORIES;
    write(CATEGORIES_KEY, categories);
    return categories;
  }

  async function ensureInquiries() {
    if (window.LumosyCloud?.enabled) {
      try {
        const inquiries = await window.LumosyCloud.getInquiries();
        write(INQUIRIES_KEY, inquiries);
        return inquiries;
      } catch (error) { console.warn('Cloud inquiry loading failed.', error); }
    }
    return read(INQUIRIES_KEY, []);
  }

  async function syncInquiries(inquiries) {
    if (window.LumosyCloud?.enabled) {
      try { await window.LumosyCloud.saveInquiries(inquiries); write(INQUIRIES_KEY, inquiries); return true; }
      catch (error) { console.error('Cloud inquiry save failed.', error); return false; }
    }
    write(INQUIRIES_KEY, inquiries);
    return true;
  }

  async function syncManagedCategories(categories) {
    if (window.LumosyCloud?.enabled) {
      try { await window.LumosyCloud.saveCategories(categories); write(CATEGORIES_KEY, categories); return true; }
      catch (error) { console.error('Cloud category save failed.', error); return false; }
    }
    write(CATEGORIES_KEY, categories);
    return true;
  }

  async function ensureAuditLogs() {
    if (window.LumosyCloud?.enabled) {
      try {
        const logs = await window.LumosyCloud.getAuditLogs();
        write(AUDIT_LOGS_KEY, logs);
        return logs;
      } catch (error) { console.warn('Cloud audit log loading failed.', error); }
    }
    return read(AUDIT_LOGS_KEY, []);
  }

  async function audit(action, target, detail = '') {
    const entry = {
      id: makeId('audit'), action: String(action || ''), target: String(target || ''), detail: String(detail || ''),
      actor: currentSession()?.role === 'admin' ? 'Administrator' : 'User', createdAt: new Date().toISOString()
    };
    try {
      const logs = window.LumosyCloud?.enabled
        ? await window.LumosyCloud.appendAuditLog(entry)
        : [entry, ...read(AUDIT_LOGS_KEY, [])].slice(0, 500);
      write(AUDIT_LOGS_KEY, logs);
      return true;
    } catch (error) { console.warn('Audit log save failed.', error); return false; }
  }

  const statusLabel = (status) => copy[status] || status || copy.pending;

  function setNotice(message, type = 'success') {
    const notice = document.querySelector('[data-notice]');
    if (!notice) return;
    notice.textContent = message;
    notice.className = `auth-notice is-visible is-${type}`;
  }

  function currentSession() { return read(SESSION_KEY, null); }
  function users() { return read(USERS_KEY, []); }
  function currentUser() {
    const session = currentSession();
    return session ? users().find((user) => user.id === session.userId) || null : null;
  }
  function saveSession(user) {
    write(SESSION_KEY, { userId: user.id, name: user.name, email: user.email, role: user.role, signedInAt: new Date().toISOString() });
  }
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    location.href = route('login');
  }

  function requireUser(requiredRole) {
    const user = currentUser();
    if (!user || user.status !== 'active') {
      localStorage.removeItem(SESSION_KEY);
      location.replace(`${route('login')}?next=${encodeURIComponent(location.pathname)}`);
      return null;
    }
    if (requiredRole === 'admin' && user.role !== 'admin') {
      location.replace(route('account'));
      return null;
    }
    return user;
  }

  async function handleLogin(form) {
    await ensureUsers();
    const email = normalizeEmail(form.elements.email.value);
    const passwordHash = await hashPassword(form.elements.password.value);
    const user = users().find((item) => item.email === email && item.passwordHash === passwordHash);
    if (!user) return setNotice(copy.loginFailed, 'error');
    if (user.status !== 'active') return setNotice(copy.disabled, 'error');
    saveSession(user);
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    location.href = next && next.startsWith('/') ? next : route(user.role === 'admin' ? 'admin' : 'account');
  }

  async function handleRegistration(form) {
    const data = new FormData(form);
    const method = form.dataset.registerMethod || 'email';
    const rawEmail = normalizeEmail(data.get('email'));
    const qqNumber = rawEmail.replace(/@qq\.com$/, '');
    if (method === 'qq' && !/^[1-9]\d{4,11}$/.test(qqNumber)) return setNotice(copy.invalidQq, 'error');
    const email = method === 'qq' ? `${qqNumber}@qq.com` : rawEmail;
    if (method === 'qq') {
      const code = String(data.get('verificationCode') || '').trim();
      if (!/^\d{6}$/.test(code)) return setNotice(copy.codeRequired, 'error');
      if (window.LumosyCloud?.enabled) {
        const savedCode = sessionStorage.getItem(`lumosy_qq_code_${email}`);
        if (!savedCode || savedCode !== code) return setNotice(copy.codeFailed, 'error');
        sessionStorage.removeItem(`lumosy_qq_code_${email}`);
      } else {
        try {
          const response = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) });
          if (!response.ok || !(await response.json()).ok) return setNotice(copy.codeFailed, 'error');
        } catch { return setNotice(copy.codeSendFailed, 'error'); }
      }
    }
    const password = String(data.get('password') || '');
    if (password.length < 8) return setNotice(copy.weak, 'error');
    if (password !== String(data.get('confirmPassword') || '')) return setNotice(copy.mismatch, 'error');
    await ensureUsers();
    const allUsers = users();
    if (allUsers.some((user) => user.email === email)) return setNotice(copy.exists, 'error');
    const user = {
      id: makeId('user'), name: String(data.get('name') || '').trim(), email,
      phone: String(data.get('phone') || '').trim(), company: String(data.get('company') || '').trim(),
      passwordHash: await hashPassword(password), registrationMethod: method, role: 'user', status: 'active', createdAt: new Date().toISOString()
    };
    const saved = await appendUser(user);
    if (saved === 'exists') return setNotice(copy.exists, 'error');
    if (!saved) return setNotice(copy.syncFailed, 'error');
    saveSession(user);
    setNotice(copy.registered);
    setTimeout(() => { location.href = route('account'); }, 500);
  }

  function renderAccount(user) {
    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = user.name; });
    document.querySelectorAll('[data-user-email]').forEach((el) => { el.textContent = user.email; });
    const sections = Array.from(document.querySelectorAll('[data-account-section]'));
    const heading = document.querySelector('[data-account-heading]');
    const openView = (view, source) => {
      document.querySelectorAll('[data-account-view]').forEach((item) => item.classList.toggle('is-active', item === source || item.dataset.accountView === view));
      sections.forEach((section) => { section.hidden = section.dataset.accountSection !== view; });
      const menu = document.querySelector(`[data-account-view="${view}"]`);
      if (heading && menu) heading.textContent = menu.textContent.trim();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.querySelectorAll('[data-account-view]').forEach((button) => { button.onclick = () => openView(button.dataset.accountView, button); });
    document.querySelectorAll('[data-account-jump]').forEach((button) => { button.onclick = () => openView(button.dataset.accountJump); });
    const form = document.querySelector('[data-profile-form]');
    if (form) {
      form.elements.name.value = user.name || '';
      form.elements.email.value = user.email || '';
      form.elements.phone.value = user.phone || '';
      form.elements.company.value = user.company || '';
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const allUsers = users();
        const saved = allUsers.find((item) => item.id === user.id);
        saved.name = form.elements.name.value.trim();
        saved.phone = form.elements.phone.value.trim();
        saved.company = form.elements.company.value.trim();
        if (!await updateUser(saved)) return setNotice(copy.syncFailed, 'error');
        saveSession(saved);
        setNotice(copy.saved);
      });
    }
    const quoteList = document.querySelector('[data-quote-list]');
    const inquiryList = document.querySelector('[data-inquiry-list]');
    const favoriteList = document.querySelector('[data-favorite-list]');
    const renderAccountData = () => {
      const quote = read(QUOTE_KEY, []);
      const inquiries = read(INQUIRIES_KEY, []).filter((item) => item.userId === user.id || normalizeEmail(item.email) === normalizeEmail(user.email));
      const favorites = read(FAVORITES_KEY, []).filter((item) => item.userId === user.id);
      if (quoteList) quoteList.innerHTML = quote.length ? quote.map((item) => `
        <li><img src="${escapeHtml(item.image || '/wp-content/uploads/2026/10/logo.png')}" alt=""><span><strong>${escapeHtml(item.title)}</strong><small>${isZh ? '数量' : 'Quantity'}: ${Number(item.qty) || 1}</small></span><button type="button" data-remove-quote="${escapeHtml(String(item.id))}" aria-label="${copy.remove}">×</button></li>`).join('') : `<li class="is-empty">${copy.noQuote}</li>`;
      if (inquiryList) inquiryList.innerHTML = inquiries.length ? inquiries.map((item) => {
        const items = item.items || [];
        const summary = item.type === 'message' || !items.length ? (isZh ? '留言' : 'Message') : String(items.length);
        return `<tr><td><strong>${escapeHtml(item.id)}</strong></td><td>${new Date(item.createdAt).toLocaleDateString()}</td><td>${summary}<small>${escapeHtml(items.map((product) => product.title).join('、'))}</small></td><td><span class="status-badge status-${escapeHtml(item.status || 'pending')}">${escapeHtml(statusLabel(item.status))}</span></td></tr>`;
      }).join('') : `<tr><td colspan="4">${copy.noInquiry}</td></tr>`;
      if (favoriteList) favoriteList.innerHTML = favorites.length ? favorites.map(({ product }) => `
        <li><img src="${escapeHtml(product.image || '/wp-content/uploads/2026/10/logo.png')}" alt=""><a href="${escapeHtml(product.url || '/products/')}">${escapeHtml(product.title)}</a><button type="button" data-remove-favorite="${escapeHtml(String(product.id))}" aria-label="${copy.remove}">×</button></li>`).join('') : `<li class="is-empty">${copy.noFavorite}</li>`;
      const quoteStat = document.querySelector('[data-stat-quote]');
      const inquiryStat = document.querySelector('[data-stat-user-inquiries]');
      const favoriteStat = document.querySelector('[data-stat-favorites]');
      if (quoteStat) quoteStat.textContent = String(quote.length);
      if (inquiryStat) inquiryStat.textContent = String(inquiries.length);
      if (favoriteStat) favoriteStat.textContent = String(favorites.length);
      document.querySelector('.account-submit-quote')?.classList.toggle('is-disabled', quote.length === 0);
    };
    quoteList?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-quote]');
      if (!button) return;
      write(QUOTE_KEY, read(QUOTE_KEY, []).filter((item) => String(item.id) !== button.dataset.removeQuote));
      renderAccountData();
    });
    favoriteList?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-favorite]');
      if (!button) return;
      const next = read(FAVORITES_KEY, []).filter((item) => !(item.userId === user.id && String(item.product.id) === button.dataset.removeFavorite));
      write(FAVORITES_KEY, next);
      renderAccountData();
      setNotice(copy.favoriteRemoved || copy.saved);
    });
    renderAccountData();
    if (!document.body.dataset.accountRefreshStarted) {
      document.body.dataset.accountRefreshStarted = 'true';
      setInterval(async () => { await ensureInquiries(); renderAccountData(); }, 15000);
    }
  }

  function renderAdmin(admin) {
    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = admin.name; });
    const usersBody = document.querySelector('[data-users-table]');
    const productsBody = document.querySelector('[data-products-table]');
    const inquiriesBody = document.querySelector('[data-inquiries-table]');
    const productForm = document.querySelector('[data-product-form]');
    const categoriesBody = document.querySelector('[data-categories-table]');
    const categoryForm = document.querySelector('[data-category-form]');
    const inquirySearch = document.querySelector('[data-inquiry-search]');
    const inquiryType = document.querySelector('[data-inquiry-type]');
    const inquiryFilter = document.querySelector('[data-inquiry-filter]');
    const inquirySummary = document.querySelector('[data-inquiry-summary]');
    const auditBody = document.querySelector('[data-audit-table]');

    const adminSections = Array.from(document.querySelectorAll('[data-admin-section]'));
    const adminHeading = document.querySelector('[data-admin-heading]');
    document.querySelectorAll('[data-admin-view]').forEach((button) => button.addEventListener('click', () => {
      const view = button.dataset.adminView;
      document.querySelectorAll('[data-admin-view]').forEach((item) => item.classList.toggle('is-active', item === button));
      adminSections.forEach((section) => { section.hidden = section.dataset.adminSection !== view; });
      if (adminHeading) adminHeading.textContent = button.textContent.trim();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));

    const uploader = productForm?.querySelector('[data-image-uploader]');
    const fileInput = productForm?.querySelector('[data-image-file]');
    const imageInput = productForm?.elements.image;
    const preview = productForm?.querySelector('[data-upload-preview]');
    const uploadCopy = productForm?.querySelector('[data-upload-copy]');
    const uploadStatus = productForm?.querySelector('[data-upload-status]');
    const setProductImage = (url = '') => {
      if (!imageInput || !preview || !uploadCopy) return;
      imageInput.value = url;
      preview.src = url;
      preview.hidden = !url;
      uploadCopy.hidden = Boolean(url);
      if (!url) preview.removeAttribute('src');
    };
    if (productForm) productForm._setProductImage = setProductImage;
    const uploadImage = async (file) => {
      if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 8 * 1024 * 1024) return setNotice(copy.imageInvalid, 'error');
      uploader.classList.add('is-uploading');
      uploadStatus.textContent = copy.imageUploading;
      try {
        if (window.LumosyCloud?.enabled) {
          const url = await window.LumosyCloud.uploadImage(file);
          setProductImage(url);
          uploadStatus.textContent = copy.imageUploaded;
          return;
        }
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        const response = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lumosy-Admin': 'local-preview' }, body: JSON.stringify({ name: file.name, type: file.type, data }) });
        const result = await response.json();
        if (!response.ok || !result.url) throw new Error('upload failed');
        setProductImage(result.url);
        uploadStatus.textContent = copy.imageUploaded;
      } catch { uploadStatus.textContent = copy.imageUploadFailed; setNotice(copy.imageUploadFailed, 'error'); }
      finally { uploader.classList.remove('is-uploading'); if (fileInput) fileInput.value = ''; }
    };
    uploader?.addEventListener('click', () => fileInput.click());
    uploader?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } });
    fileInput?.addEventListener('change', () => uploadImage(fileInput.files?.[0]));
    for (const name of ['dragenter', 'dragover']) uploader?.addEventListener(name, (event) => { event.preventDefault(); uploader.classList.add('is-dragging'); });
    for (const name of ['dragleave', 'drop']) uploader?.addEventListener(name, (event) => { event.preventDefault(); uploader.classList.remove('is-dragging'); });
    uploader?.addEventListener('drop', (event) => uploadImage(Array.from(event.dataTransfer?.files || []).find((file) => file.type.startsWith('image/'))));
    document.addEventListener('paste', (event) => {
      const productsSection = document.querySelector('[data-admin-section="products"]');
      if (productsSection?.hidden) return;
      const image = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'))?.getAsFile();
      if (image) { event.preventDefault(); uploadImage(image); }
    });
    productForm?.querySelector('[data-remove-image]')?.addEventListener('click', () => { setProductImage(''); uploadStatus.textContent = ''; });

    const updateStats = () => {
      const list = users();
      const inquiries = read(INQUIRIES_KEY, []);
      const products = read(PRODUCTS_KEY, []);
      document.querySelector('[data-stat-users]').textContent = String(list.filter((user) => user.role === 'user').length);
      document.querySelector('[data-stat-admins]').textContent = String(list.filter((user) => user.role === 'admin').length);
      document.querySelector('[data-stat-inquiries]').textContent = String(inquiries.length);
      document.querySelector('[data-stat-products]').textContent = String(products.filter((product) => product.status !== 'inactive').length);
    };

    const redrawUsers = () => {
      const list = users();
      usersBody.innerHTML = list.map((user) => `
        <tr><td><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></td><td><span class="role-badge role-${user.role}">${user.role === 'admin' ? copy.admin : copy.user}</span></td><td>${escapeHtml(user.company || '—')}</td><td>${new Date(user.createdAt).toLocaleDateString()}</td><td><span class="status-badge status-${user.status}">${user.status === 'active' ? copy.active : copy.disabledLabel}</span></td><td>${user.id === admin.id ? '—' : `<button class="table-action" type="button" data-toggle-user="${escapeHtml(user.id)}">${user.status === 'active' ? copy.disable : copy.enable}</button>`}</td></tr>`).join('');
      updateStats();
    };

    const redrawProducts = () => {
      const products = read(PRODUCTS_KEY, []);
      productsBody.innerHTML = products.map((product) => `
        <tr><td><img class="table-product-image" src="${escapeHtml(product.image || '/wp-content/uploads/2026/10/logo.png')}" alt=""></td><td><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(product.url)}</small></td><td>${escapeHtml(product.category || '—')}</td><td><span class="status-badge status-${product.status}">${product.status === 'active' ? copy.active : copy.disabledLabel}</span></td><td class="table-actions"><button class="table-action" type="button" data-edit-product="${escapeHtml(product.id)}">${copy.edit}</button><button class="table-action" type="button" data-toggle-product="${escapeHtml(product.id)}">${product.status === 'active' ? copy.disable : copy.enable}</button>${product.source === 'custom' ? `<button class="table-action is-danger" type="button" data-delete-product="${escapeHtml(product.id)}">${copy.remove}</button>` : ''}</td></tr>`).join('');
      updateStats();
    };

    const refreshCategorySelect = (selected = '') => {
      if (!productForm?.elements.category) return;
      const categories = read(CATEGORIES_KEY, DEFAULT_CATEGORIES).filter((category) => category.status !== 'inactive');
      productForm.elements.category.innerHTML = categories.map((category) => `<option value="${escapeHtml(category.name)}" data-zh="${escapeHtml(category.zh || '')}" data-slug="${escapeHtml(category.slug)}">${escapeHtml(isZh && category.zh ? category.zh : category.name)}</option>`).join('');
      if (selected) productForm.elements.category.value = selected;
    };

    const redrawCategories = () => {
      if (!categoriesBody) return;
      const categories = read(CATEGORIES_KEY, DEFAULT_CATEGORIES);
      categoriesBody.innerHTML = categories.map((category) => `<tr><td><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(category.zh || '')}</small></td><td>${escapeHtml(category.slug)}</td><td><span class="status-badge status-${category.status || 'active'}">${category.status === 'inactive' ? copy.disabledLabel : copy.active}</span></td><td>${category.source === 'custom' ? `<button class="table-action is-danger" type="button" data-delete-category="${escapeHtml(category.id)}">${copy.remove}</button>` : '—'}</td></tr>`).join('');
      refreshCategorySelect();
    };

    const redrawInquiries = () => {
      const inquiries = read(INQUIRIES_KEY, []);
      const query = String(inquirySearch?.value || '').trim().toLowerCase();
      const type = inquiryType?.value || 'all';
      const status = inquiryFilter?.value || 'all';
      const visible = inquiries.filter((item) => {
        const itemType = item.type === 'message' || !(item.items || []).length ? 'message' : 'quote';
        const haystack = [item.id, item.customer, item.email, item.phone, item.company, item.message, ...(item.items || []).map((product) => product.title)].join(' ').toLowerCase();
        return (!query || haystack.includes(query)) && (type === 'all' || itemType === type) && (status === 'all' || item.status === status);
      });
      if (inquirySummary) inquirySummary.textContent = `${visible.length} / ${inquiries.length} ${isZh ? '条记录' : 'records'}`;
      inquiriesBody.innerHTML = visible.length ? visible.map((item) => {
        const fields = item.fields || {};
        const phone = item.phone || fields.phone || '';
        const country = item.country || fields.country || '';
        const message = item.message || fields.message || '';
        const products = (item.items || []).map((product) => `${product.title} × ${Number(product.qty) || 1}`).join('；');
        const isMessage = item.type === 'message' || !(item.items || []).length;
        return `<tr class="inquiry-row">
          <td><strong>${escapeHtml(item.id)}</strong><small>${new Date(item.createdAt).toLocaleString()}</small></td>
          <td><strong>${escapeHtml(item.customer || 'Guest')}</strong><small>${escapeHtml(item.email || '')}</small>${phone ? `<small>${escapeHtml(phone)}</small>` : ''}${country ? `<small>${escapeHtml(country)}</small>` : ''}</td>
          <td><strong>${isMessage ? (isZh ? '普通留言' : 'General message') : `${Number(item.items?.length || 0)} ${isZh ? '件产品' : 'products'}`}</strong><small>${escapeHtml(products)}</small>${message ? `<details class="inquiry-details"><summary>${isZh ? '查看需求说明' : 'View requirements'}</summary><p>${escapeHtml(message)}</p></details>` : ''}</td>
          <td><select class="table-select" data-inquiry-status="${escapeHtml(item.id)}"><option value="pending" ${item.status === 'pending' ? 'selected' : ''}>${copy.pending}</option><option value="processing" ${item.status === 'processing' ? 'selected' : ''}>${copy.processing}</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>${copy.completed}</option></select><textarea class="inquiry-note" data-inquiry-note="${escapeHtml(item.id)}" rows="2" placeholder="${isZh ? '管理员备注' : 'Internal note'}">${escapeHtml(item.note || '')}</textarea><button class="table-action is-danger inquiry-delete" type="button" data-delete-inquiry="${escapeHtml(item.id)}">${copy.remove}</button></td>
        </tr>`;
      }).join('') : `<tr><td colspan="4">${query || type !== 'all' || status !== 'all' ? (isZh ? '没有符合筛选条件的记录。' : 'No matching records.') : copy.noInquiry}</td></tr>`;
      updateStats();
    };

    const redrawAudit = () => {
      if (!auditBody) return;
      const logs = read(AUDIT_LOGS_KEY, []);
      auditBody.innerHTML = logs.length ? logs.map((entry) => `<tr><td>${new Date(entry.createdAt).toLocaleString()}</td><td><strong>${escapeHtml(entry.action)}</strong><small>${escapeHtml(entry.actor || 'Administrator')}</small></td><td>${escapeHtml(entry.target || '—')}</td><td>${escapeHtml(entry.detail || '—')}</td></tr>`).join('') : `<tr><td colspan="4">${isZh ? '暂无操作记录。' : 'No operation logs yet.'}</td></tr>`;
    };

    redrawUsers();
    redrawCategories();
    redrawProducts();
    redrawInquiries();
    redrawAudit();
    if (window.LumosyCloud?.enabled) setInterval(async () => {
      await Promise.all([ensureInquiries(), ensureAuditLogs(), ensureUsers()]);
      redrawInquiries();
      redrawAudit();
      redrawUsers();
    }, 15000);

    inquirySearch?.addEventListener('input', redrawInquiries);
    inquiryType?.addEventListener('change', redrawInquiries);
    inquiryFilter?.addEventListener('change', redrawInquiries);
    document.querySelector('[data-export-inquiries]')?.addEventListener('click', () => {
      const rows = read(INQUIRIES_KEY, []).map((item) => {
        const fields = item.fields || {};
        return [item.id, item.createdAt, item.type || ((item.items || []).length ? 'quote' : 'message'), item.status || 'pending', item.customer || '', item.email || '', item.phone || fields.phone || '', item.company || fields.company || '', (item.items || []).map((product) => `${product.title} x ${Number(product.qty) || 1}`).join(' | '), item.message || fields.message || '', item.note || ''];
      });
      const csv = [['Reference', 'Created', 'Type', 'Status', 'Customer', 'Email', 'Phone', 'Company', 'Products', 'Message', 'Internal note'], ...rows]
        .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      link.download = `lumosy-inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    });

    usersBody.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-toggle-user]');
      if (!button) return;
      const list = users();
      const user = list.find((item) => item.id === button.dataset.toggleUser);
      if (!user) return;
      const previousStatus = user.status;
      user.status = user.status === 'active' ? 'disabled' : 'active';
      if (!await updateUser(user)) {
        user.status = previousStatus;
        return setNotice(copy.syncFailed, 'error');
      }
      await audit('Account status updated', user.role === 'admin' ? 'Administrator account' : 'Customer account', user.status);
      redrawUsers();
      redrawAudit();
      setNotice(copy.userUpdated);
    });

    productsBody.addEventListener('click', async (event) => {
      const products = read(PRODUCTS_KEY, []);
      const edit = event.target.closest('[data-edit-product]');
      const toggle = event.target.closest('[data-toggle-product]');
      const remove = event.target.closest('[data-delete-product]');
      const id = edit?.dataset.editProduct || toggle?.dataset.toggleProduct || remove?.dataset.deleteProduct;
      const product = products.find((item) => item.id === id);
      if (!product) return;
      if (edit) {
        refreshCategorySelect(product.category);
        for (const field of ['id', 'title', 'titleZh', 'category', 'image', 'status', 'description', 'model', 'material', 'finish', 'dimensions']) {
          if (productForm.elements[field]) productForm.elements[field].value = product[field] || '';
        }
        if (productForm.elements.homepage) productForm.elements.homepage.checked = Boolean(product.homepage);
        setProductImage(product.image || '');
        productForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (toggle) {
        const previousStatus = product.status;
        product.status = product.status === 'active' ? 'inactive' : 'active';
        if (!await syncManagedProducts(products)) {
          product.status = previousStatus;
          return setNotice(copy.syncFailed, 'error');
        }
        write(PRODUCTS_KEY, products);
        await audit('Product status updated', product.title, product.status);
        redrawProducts();
        redrawAudit();
      }
      if (remove && confirm(copy.confirmDelete)) {
        const nextProducts = products.filter((item) => item.id !== product.id);
        if (!await syncManagedProducts(nextProducts)) return setNotice(copy.syncFailed, 'error');
        write(PRODUCTS_KEY, nextProducts);
        await audit('Product deleted', product.title, product.category || '');
        redrawProducts();
        redrawAudit();
        setNotice(copy.productRemoved);
      }
    });

    productForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(productForm);
      const products = read(PRODUCTS_KEY, []);
      const id = String(data.get('id') || '').trim();
      const product = id ? products.find((item) => item.id === id) : null;
      const title = String(data.get('title') || '').trim();
      const record = product || { id: makeId('product'), source: 'custom', createdAt: new Date().toISOString() };
      record.title = title;
      record.titleZh = String(data.get('titleZh') || '').trim();
      record.category = String(data.get('category') || '').trim();
      const categoryOption = productForm.elements.category.selectedOptions?.[0];
      record.categoryZh = categoryOption?.dataset.zh || '';
      record.categorySlug = categoryOption?.dataset.slug || '';
      record.url = `/product/custom/?id=${encodeURIComponent(record.id)}`;
      record.image = String(data.get('image') || '').trim() || '/wp-content/uploads/2026/10/logo.png';
      record.description = String(data.get('description') || '').trim();
      record.model = String(data.get('model') || '').trim();
      record.material = String(data.get('material') || '').trim();
      record.finish = String(data.get('finish') || '').trim();
      record.dimensions = String(data.get('dimensions') || '').trim();
      record.status = String(data.get('status') || 'active');
      record.homepage = data.get('homepage') === 'on';
      record.updatedAt = new Date().toISOString();
      if (!product) products.unshift(record);
      if (!await syncManagedProducts(products)) return setNotice(copy.syncFailed, 'error');
      write(PRODUCTS_KEY, products);
      await audit(product ? 'Product updated' : 'Product created', record.title, record.category || '');
      productForm.reset();
      productForm.elements.id.value = '';
      setProductImage('');
      redrawProducts();
      redrawAudit();
      setNotice(copy.productSaved);
    });

    inquiriesBody.addEventListener('change', async (event) => {
      const select = event.target.closest('[data-inquiry-status]');
      const note = event.target.closest('[data-inquiry-note]');
      if (!select && !note) return;
      const inquiries = read(INQUIRIES_KEY, []);
      const inquiryId = select?.dataset.inquiryStatus || note?.dataset.inquiryNote;
      const inquiry = inquiries.find((item) => item.id === inquiryId);
      if (!inquiry) return;
      const previousStatus = inquiry.status;
      const previousNote = inquiry.note || '';
      if (select) inquiry.status = select.value;
      if (note) inquiry.note = note.value.trim();
      inquiry.updatedAt = new Date().toISOString();
      if (!await syncInquiries(inquiries)) {
        await ensureInquiries();
        redrawInquiries();
        return setNotice(copy.syncFailed, 'error');
      }
      await audit(select ? 'Inquiry status updated' : 'Inquiry note updated', inquiry.id, select ? `${previousStatus || 'pending'} → ${inquiry.status}` : `${previousNote ? 'Updated' : 'Added'} internal note`);
      redrawAudit();
      setNotice(copy.inquiryUpdated);
    });

    inquiriesBody.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-delete-inquiry]');
      if (!button) return;
      if (!confirm(isZh ? '确定删除这条询价吗？' : 'Delete this inquiry?')) return;
      const inquiries = read(INQUIRIES_KEY, []).filter((item) => item.id !== button.dataset.deleteInquiry);
      if (!await syncInquiries(inquiries)) return setNotice(copy.syncFailed, 'error');
      await audit('Inquiry deleted', button.dataset.deleteInquiry);
      redrawInquiries();
      redrawAudit();
      setNotice(isZh ? '询价已删除。' : 'Inquiry deleted.');
    });

    categoryForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(categoryForm);
      const categories = read(CATEGORIES_KEY, DEFAULT_CATEGORIES);
      const name = String(data.get('name') || '').trim();
      const zh = String(data.get('zh') || '').trim();
      const slug = slugify(data.get('slug') || name);
      if (!name || !slug) return;
      if (categories.some((category) => category.slug === slug || category.name.toLowerCase() === name.toLowerCase())) return setNotice(isZh ? '该分类已经存在。' : 'This category already exists.', 'error');
      categories.push({ id: makeId('category'), name, zh, slug, status: 'active', source: 'custom', createdAt: new Date().toISOString() });
      if (!await syncManagedCategories(categories)) return setNotice(copy.syncFailed, 'error');
      categoryForm.reset();
      redrawCategories();
      await audit('Category created', name, slug);
      redrawAudit();
      setNotice(isZh ? '分类已保存。' : 'Category saved.');
    });

    categoriesBody?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-delete-category]');
      if (!button) return;
      const products = read(PRODUCTS_KEY, []);
      const categories = read(CATEGORIES_KEY, DEFAULT_CATEGORIES);
      const target = categories.find((category) => category.id === button.dataset.deleteCategory);
      if (!target || products.some((product) => product.categorySlug === target.slug)) return setNotice(isZh ? '该分类下仍有产品，不能删除。' : 'Move or delete products in this category first.', 'error');
      const next = categories.filter((category) => category.id !== target.id);
      if (!await syncManagedCategories(next)) return setNotice(copy.syncFailed, 'error');
      await audit('Category deleted', target.name, target.slug);
      redrawCategories();
      redrawAudit();
    });

    document.querySelector('[data-admin-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const email = normalizeEmail(form.elements.email.value);
      const password = form.elements.password.value;
      await ensureUsers();
      const all = users();
      if (all.some((user) => user.email === email)) return setNotice(copy.exists, 'error');
      if (password.length < 8) return setNotice(copy.weak, 'error');
      const newAdmin = {
        id: makeId('admin'), name: form.elements.name.value.trim(), email, phone: '', company: 'LUMOSY',
        passwordHash: await hashPassword(password), role: 'admin', status: 'active', createdAt: new Date().toISOString()
      };
      const saved = await appendUser(newAdmin);
      if (saved === 'exists') return setNotice(copy.exists, 'error');
      if (!saved) return setNotice(copy.syncFailed, 'error');
      await audit('Administrator created', 'Administrator account');
      form.reset();
      redrawUsers();
      redrawAudit();
      setNotice(copy.adminAdded);
    });
  }

  async function start() {
    await ensureAdministrator();
    await ensureUsers();
    document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', logout));
    document.querySelector('[data-login-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      handleLogin(event.currentTarget);
    });
    const registerForm = document.querySelector('[data-register-form]');
    if (registerForm) {
      const emailInput = registerForm.querySelector('[data-register-email]');
      const emailLabel = registerForm.querySelector('[data-email-label]');
      const codeInput = registerForm.elements.verificationCode;
      const codeStatus = registerForm.querySelector('[data-code-status]');
      const sendCodeButton = registerForm.querySelector('[data-send-qq-code]');
      const setRegistrationMethod = (method) => {
        const isQq = method === 'qq';
        registerForm.dataset.registerMethod = method;
        registerForm.querySelectorAll('[data-register-method]').forEach((button) => button.classList.toggle('is-active', button.dataset.registerMethod === method));
        emailLabel.textContent = isQq ? emailLabel.dataset.emailLabelQq : emailLabel.dataset.emailLabelDefault;
        emailInput.value = '';
        emailInput.type = isQq ? 'text' : 'email';
        emailInput.inputMode = isQq ? 'numeric' : 'email';
        emailInput.autocomplete = isQq ? 'off' : 'email';
        emailInput.placeholder = isQq ? emailInput.dataset.qqPlaceholder : emailInput.dataset.emailPlaceholder;
        emailInput.pattern = isQq ? '[1-9][0-9]{4,11}' : '';
        codeInput.required = isQq;
        codeInput.value = '';
        codeStatus.textContent = '';
        emailInput.setAttribute('aria-describedby', isQq ? 'qq-email-help' : '');
        registerForm.classList.toggle('is-qq-registration', isQq);
        emailInput.focus();
      };
      registerForm.querySelectorAll('[data-register-method]').forEach((button) => button.addEventListener('click', () => setRegistrationMethod(button.dataset.registerMethod)));
      registerForm.querySelector('[data-qq-help]')?.setAttribute('id', 'qq-email-help');
      sendCodeButton?.addEventListener('click', async () => {
        const qqNumber = normalizeEmail(emailInput.value).replace(/@qq\.com$/, '');
        if (!/^[1-9]\d{4,11}$/.test(qqNumber)) return setNotice(copy.invalidQq, 'error');
        sendCodeButton.disabled = true;
        try {
          let result;
          if (window.LumosyCloud?.enabled) {
            const devCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
            sessionStorage.setItem(`lumosy_qq_code_${qqNumber}@qq.com`, devCode);
            result = { ok: true, devCode };
          } else {
            const response = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${qqNumber}@qq.com` }) });
            result = await response.json();
            if (!response.ok || !result.ok) throw new Error('send failed');
          }
          codeStatus.textContent = `${copy.codeSent}${result.devCode ? ` ${copy.localCode}：${result.devCode}` : ''}`;
          let seconds = 60;
          const originalText = sendCodeButton.textContent;
          sendCodeButton.textContent = `${seconds}s`;
          const timer = setInterval(() => {
            seconds -= 1;
            sendCodeButton.textContent = seconds > 0 ? `${seconds}s` : originalText;
            if (seconds <= 0) { clearInterval(timer); sendCodeButton.disabled = false; }
          }, 1000);
        } catch { sendCodeButton.disabled = false; setNotice(copy.codeSendFailed, 'error'); }
      });
      registerForm.addEventListener('submit', (event) => {
        event.preventDefault();
        handleRegistration(event.currentTarget);
      });
    }
    await Promise.all([ensureProducts(), ensureCategories(), ensureInquiries(), ensureAuditLogs()]);
    if (page === 'account') {
      const user = requireUser();
      if (user) renderAccount(user);
    }
    if (page === 'admin') {
      const admin = requireUser('admin');
      if (admin) renderAdmin(admin);
    }
    document.documentElement.dataset.authReady = 'true';
  }

  start();
})();

