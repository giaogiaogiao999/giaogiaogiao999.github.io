(function () {
  'use strict';

  const USERS_KEY = 'lumosy_auth_users_v1';
  const SESSION_KEY = 'lumosy_auth_session_v1';
  const QUOTE_KEY = 'lumosy_static_quote_v1';
  const INQUIRIES_KEY = 'lumosy_inquiries_v1';
  const FAVORITES_KEY = 'lumosy_favorites_v1';
  const PRODUCTS_KEY = 'lumosy_products_v1';
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
    confirmDelete: '确定删除这个自定义产品吗？', invalidQq: '请输入5至12位数字QQ号。'
  } : {
    loginFailed: 'Incorrect email address or password.', disabled: 'This account has been disabled.',
    exists: 'An account already exists for this email.', mismatch: 'The passwords do not match.',
    weak: 'Password must contain at least 8 characters.', registered: 'Registration complete. Opening your account…',
    saved: 'Profile saved.', adminAdded: 'Administrator account created.', noQuote: 'Your quote list is empty.',
    noInquiry: 'No inquiries yet.', noFavorite: 'No saved products yet.', user: 'User', admin: 'Administrator', active: 'Active', disabledLabel: 'Disabled',
    pending: 'Pending', processing: 'Processing', completed: 'Completed', enable: 'Enable', disable: 'Disable', edit: 'Edit', remove: 'Delete',
    productSaved: 'Product saved.', productRemoved: 'Product deleted.', favoriteRemoved: 'Favorite removed.', userUpdated: 'User status updated.', inquiryUpdated: 'Inquiry status updated.',
    confirmDelete: 'Delete this custom product?', invalidQq: 'Enter a valid QQ number containing 5 to 12 digits.'
  };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
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

  async function ensureProducts() {
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
    const password = String(data.get('password') || '');
    if (password.length < 8) return setNotice(copy.weak, 'error');
    if (password !== String(data.get('confirmPassword') || '')) return setNotice(copy.mismatch, 'error');
    const allUsers = users();
    if (allUsers.some((user) => user.email === email)) return setNotice(copy.exists, 'error');
    const user = {
      id: makeId('user'), name: String(data.get('name') || '').trim(), email,
      phone: String(data.get('phone') || '').trim(), company: String(data.get('company') || '').trim(),
      passwordHash: await hashPassword(password), registrationMethod: method, role: 'user', status: 'active', createdAt: new Date().toISOString()
    };
    allUsers.push(user);
    write(USERS_KEY, allUsers);
    saveSession(user);
    setNotice(copy.registered);
    setTimeout(() => { location.href = route('account'); }, 500);
  }

  function renderAccount(user) {
    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = user.name; });
    document.querySelectorAll('[data-user-email]').forEach((el) => { el.textContent = user.email; });
    const form = document.querySelector('[data-profile-form]');
    if (form) {
      form.elements.name.value = user.name || '';
      form.elements.email.value = user.email || '';
      form.elements.phone.value = user.phone || '';
      form.elements.company.value = user.company || '';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const allUsers = users();
        const saved = allUsers.find((item) => item.id === user.id);
        saved.name = form.elements.name.value.trim();
        saved.phone = form.elements.phone.value.trim();
        saved.company = form.elements.company.value.trim();
        write(USERS_KEY, allUsers);
        saveSession(saved);
        setNotice(copy.saved);
      });
    }
    const quote = read(QUOTE_KEY, []);
    const quoteList = document.querySelector('[data-quote-list]');
    if (quoteList) quoteList.innerHTML = quote.length ? quote.map((item) => `
      <li><img src="${escapeHtml(item.image || '/wp-content/uploads/2026/10/logo.png')}" alt=""><span>${escapeHtml(item.title)}</span><b>× ${Number(item.qty) || 1}</b></li>`).join('') : `<li class="is-empty">${copy.noQuote}</li>`;
    const inquiryList = document.querySelector('[data-inquiry-list]');
    const inquiries = read(INQUIRIES_KEY, []).filter((item) => item.userId === user.id);
    if (inquiryList) inquiryList.innerHTML = inquiries.length ? inquiries.map((item) => `
      <tr><td>${escapeHtml(item.id)}</td><td>${new Date(item.createdAt).toLocaleDateString()}</td><td>${Number(item.items?.length || 0)}</td><td><span class="status-badge status-${escapeHtml(item.status || 'pending')}">${escapeHtml(statusLabel(item.status))}</span></td></tr>`).join('') : `<tr><td colspan="4">${copy.noInquiry}</td></tr>`;
    const favoriteList = document.querySelector('[data-favorite-list]');
    const favorites = read(FAVORITES_KEY, []).filter((item) => item.userId === user.id);
    if (favoriteList) favoriteList.innerHTML = favorites.length ? favorites.map(({ product }) => `
      <li><img src="${escapeHtml(product.image || '/wp-content/uploads/2026/10/logo.png')}" alt=""><a href="${escapeHtml(product.url || '/products/')}">${escapeHtml(product.title)}</a><button type="button" data-remove-favorite="${escapeHtml(String(product.id))}" aria-label="Remove">×</button></li>`).join('') : `<li class="is-empty">${copy.noFavorite}</li>`;
    favoriteList?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-favorite]');
      if (!button) return;
      const next = read(FAVORITES_KEY, []).filter((item) => !(item.userId === user.id && String(item.product.id) === button.dataset.removeFavorite));
      write(FAVORITES_KEY, next);
      renderAccount(user);
      setNotice(copy.favoriteRemoved || copy.saved);
    }, { once: true });
  }

  function renderAdmin(admin) {
    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = admin.name; });
    const usersBody = document.querySelector('[data-users-table]');
    const productsBody = document.querySelector('[data-products-table]');
    const inquiriesBody = document.querySelector('[data-inquiries-table]');
    const productForm = document.querySelector('[data-product-form]');

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

    const redrawInquiries = () => {
      const inquiries = read(INQUIRIES_KEY, []);
      inquiriesBody.innerHTML = inquiries.length ? inquiries.map((item) => `
        <tr><td><strong>${escapeHtml(item.id)}</strong><small>${new Date(item.createdAt).toLocaleString()}</small></td><td>${escapeHtml(item.customer || 'Guest')}<small>${escapeHtml(item.email || '')}</small></td><td>${Number(item.items?.length || 0)}</td><td><select class="table-select" data-inquiry-status="${escapeHtml(item.id)}"><option value="pending" ${item.status === 'pending' ? 'selected' : ''}>${copy.pending}</option><option value="processing" ${item.status === 'processing' ? 'selected' : ''}>${copy.processing}</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>${copy.completed}</option></select></td></tr>`).join('') : `<tr><td colspan="4">${copy.noInquiry}</td></tr>`;
      updateStats();
    };

    redrawUsers();
    redrawProducts();
    redrawInquiries();

    usersBody.addEventListener('click', (event) => {
      const button = event.target.closest('[data-toggle-user]');
      if (!button) return;
      const list = users();
      const user = list.find((item) => item.id === button.dataset.toggleUser);
      if (!user) return;
      user.status = user.status === 'active' ? 'disabled' : 'active';
      write(USERS_KEY, list);
      redrawUsers();
      setNotice(copy.userUpdated);
    });

    productsBody.addEventListener('click', (event) => {
      const products = read(PRODUCTS_KEY, []);
      const edit = event.target.closest('[data-edit-product]');
      const toggle = event.target.closest('[data-toggle-product]');
      const remove = event.target.closest('[data-delete-product]');
      const id = edit?.dataset.editProduct || toggle?.dataset.toggleProduct || remove?.dataset.deleteProduct;
      const product = products.find((item) => item.id === id);
      if (!product) return;
      if (edit) {
        for (const field of ['id', 'title', 'titleZh', 'category', 'categoryZh', 'image', 'status']) {
          if (productForm.elements[field]) productForm.elements[field].value = product[field] || '';
        }
        productForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (toggle) {
        product.status = product.status === 'active' ? 'inactive' : 'active';
        write(PRODUCTS_KEY, products);
        redrawProducts();
      }
      if (remove && confirm(copy.confirmDelete)) {
        write(PRODUCTS_KEY, products.filter((item) => item.id !== product.id));
        redrawProducts();
        setNotice(copy.productRemoved);
      }
    });

    productForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(productForm);
      const products = read(PRODUCTS_KEY, []);
      const id = String(data.get('id') || '').trim();
      const product = id ? products.find((item) => item.id === id) : null;
      const title = String(data.get('title') || '').trim();
      const record = product || {
        id: makeId('product'), source: 'custom', url: `/products/#${Date.now()}`, createdAt: new Date().toISOString()
      };
      record.title = title;
      record.titleZh = String(data.get('titleZh') || '').trim();
      record.category = String(data.get('category') || '').trim();
      record.categoryZh = String(data.get('categoryZh') || '').trim();
      record.image = String(data.get('image') || '').trim() || '/wp-content/uploads/2026/10/logo.png';
      record.status = String(data.get('status') || 'active');
      record.updatedAt = new Date().toISOString();
      if (!product) products.unshift(record);
      write(PRODUCTS_KEY, products);
      productForm.reset();
      productForm.elements.id.value = '';
      redrawProducts();
      setNotice(copy.productSaved);
    });

    inquiriesBody.addEventListener('change', (event) => {
      const select = event.target.closest('[data-inquiry-status]');
      if (!select) return;
      const inquiries = read(INQUIRIES_KEY, []);
      const inquiry = inquiries.find((item) => item.id === select.dataset.inquiryStatus);
      if (!inquiry) return;
      inquiry.status = select.value;
      inquiry.updatedAt = new Date().toISOString();
      write(INQUIRIES_KEY, inquiries);
      setNotice(copy.inquiryUpdated);
    });

    document.querySelector('[data-admin-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const email = normalizeEmail(form.elements.email.value);
      const password = form.elements.password.value;
      const all = users();
      if (all.some((user) => user.email === email)) return setNotice(copy.exists, 'error');
      if (password.length < 8) return setNotice(copy.weak, 'error');
      all.push({
        id: makeId('admin'), name: form.elements.name.value.trim(), email, phone: '', company: 'LUMOSY',
        passwordHash: await hashPassword(password), role: 'admin', status: 'active', createdAt: new Date().toISOString()
      });
      write(USERS_KEY, all);
      form.reset();
      redrawUsers();
      setNotice(copy.adminAdded);
    });
  }

  async function start() {
    await ensureAdministrator();
    await ensureProducts();
    document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', logout));
    document.querySelector('[data-login-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      handleLogin(event.currentTarget);
    });
    const registerForm = document.querySelector('[data-register-form]');
    if (registerForm) {
      const emailInput = registerForm.querySelector('[data-register-email]');
      const emailLabel = registerForm.querySelector('[data-email-label]');
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
        emailInput.setAttribute('aria-describedby', isQq ? 'qq-email-help' : '');
        registerForm.classList.toggle('is-qq-registration', isQq);
        emailInput.focus();
      };
      registerForm.querySelectorAll('[data-register-method]').forEach((button) => button.addEventListener('click', () => setRegistrationMethod(button.dataset.registerMethod)));
      registerForm.querySelector('[data-qq-help]')?.setAttribute('id', 'qq-email-help');
      registerForm.addEventListener('submit', (event) => {
        event.preventDefault();
        handleRegistration(event.currentTarget);
      });
    }
    if (page === 'account') {
      const user = requireUser();
      if (user) renderAccount(user);
    }
    if (page === 'admin') {
      const admin = requireUser('admin');
      if (admin) renderAdmin(admin);
    }
  }

  start();
})();
