(function () {
  'use strict';

  document.documentElement.classList.add('static-animations');

  const isZh = location.pathname === '/zh' || location.pathname.startsWith('/zh/');
  const copy = isZh ? {
    added: '已加入询价清单', removed: '已移除', empty: '询价清单为空',
    sent: '即将打开邮件应用，请发送邮件完成询价。', searchEmpty: '没有找到匹配的产品。',
    emailSubject: '网站产品询价', requiredEmail: '请输入有效的邮箱地址。',
    favoriteAdded: '已收藏产品', favoriteRemoved: '已取消收藏', loginFavorite: '登录后可以收藏产品',
    addQuote: '加入询价', rating: '暂无评分'
  } : {
    added: 'Added to quote list', removed: 'Removed', empty: 'Your quote basket is empty.',
    sent: 'Your email app will open. Send the prepared message to complete the inquiry.', searchEmpty: 'No matching products found.',
    emailSubject: 'Website product inquiry', requiredEmail: 'Please enter a valid email address.',
    favoriteAdded: 'Product saved to favorites', favoriteRemoved: 'Removed from favorites', loginFavorite: 'Sign in to save favorites',
    addQuote: 'Add to Quote', rating: 'Rated 0 out of 5'
  };

  const QUOTE_KEY = 'lumosy_static_quote_v1';
  const SESSION_KEY = 'lumosy_auth_session_v1';
  const FAVORITES_KEY = 'lumosy_favorites_v1';
  const INQUIRIES_KEY = 'lumosy_inquiries_v1';
  const PRODUCTS_KEY = 'lumosy_products_v1';
  const CATEGORIES_KEY = 'lumosy_categories_v1';
  const categorySlugByName = {
    'Aluminum Carpet Transition Strip': 'aluminum-carpet-transition-strip',
    'Aluminum Skirting Profile': 'aluminum-skirting-profile',
    'Aluminum Tile Edge Trim profile': 'aluminum-tile-edge-trim-profile',
    'Cabinet Aluminum Handle': 'cabinet-aluminum-handle',
    'LED Channel For Wall Panel': 'led-channel-for-wall-panel',
    'Wall Panel Edge Trim Profile': 'wall-panel-edge-trim-profile',
    'Wall Panel Joint Profile': 'wall-panel-joint-profile'
  };
  const zhText = new Map(Object.entries({
    'HOME': '首页', 'PRODUCTS': '产品', 'ABOUT': '关于我们', 'BLOG': '博客', 'FAQ': '常见问题', 'CONTACT US': '联系我们',
    'Home': '首页', 'Products': '产品', 'About': '关于我们', 'Blog': '博客', 'Contact Us': '联系我们', 'Request a Quote': '获取报价',
    'Professional aluminum profile manufacturer': '专业铝型材制造商',
    'Aluminum wall decorative profiles': '铝合金墙面装饰型材', 'Aluminum skirting boards': '铝合金踢脚线',
    'Tile trims': '瓷砖收边条', 'Cabinet frames and handles': '橱柜框架与拉手', 'Floor transition strips': '地面过渡条',
    'FIND MORE': '查看更多', 'Flexible': '灵活定制', 'Responsive': '快速响应', 'Efficient': '高效交付', 'Precise': '精准品质',
    'Drawings → Prototype in 72h': '图纸确认后 72 小时完成样品', 'Reply in 2h, Solution in 8h': '2 小时内回复，8 小时内提供方案',
    'On-time delivery': '准时交付', '11-step QC, guaranteed quality': '11 道质量检查，品质有保障',
    'MAIN CATALOGUE': '主要产品目录', 'All styles can be customized': '所有款式均支持定制',
    'HOT SALE PRODUCTS': '热销产品', 'All sizes and colors can be customized': '所有尺寸和颜色均可定制',
    'WHY CHOOSE US': '为什么选择我们', 'About Us': '关于我们', 'MORE INFO': '了解更多',
    'High Quality': '高品质', 'Customizable': '支持定制', 'Fast Delivery': '快速交付',
    'Versatile Applications': '应用广泛', 'Easy Installation': '安装便捷',
    'Aluminum Decorate Trim Manufacturer': '铝合金装饰线条制造商', 'Manufacturer': '制造商',
    'Leave us a message': '给我们留言', 'Leave a message': '在线留言', 'Send': '发送', 'Submit': '提交',
    'Name': '姓名', 'Email': '邮箱', 'Email Address': '邮箱地址', 'Telephone': '电话', 'Company': '公司',
    'Company Name': '公司名称', 'Phone/WhatsApp': '电话 / WhatsApp', 'Country/Region': '国家 / 地区',
    'Message': '留言', 'Message/Requirements': '留言 / 需求', 'Search products...': '搜索产品…', 'Search': '搜索',
    'Categories': '产品分类', 'Our Best Sellers': '畅销产品', 'Default sorting': '默认排序',
    'Sort by latest': '按最新排序', 'Sort by name': '按名称排序', 'Sort products': '商品排序', 'Showing 1–12 of 23 results': '显示 23 个结果中的 1–12 个',
    'Store': '产品中心', 'Add to Quote': '加入询价', 'Added': '已加入', 'Rated 0 out of 5': '暂无评分',
    'QUOTE REQUEST': '询价单', 'Please review your selected products and fill in your contact information': '请确认所选产品并填写联系信息',
    'Your quote basket is empty.': '您的询价清单为空。', 'Browse Products': '浏览产品', 'Picture': '图片',
    'Product Name': '产品名称', 'Quantity': '数量', 'Del': '删除', 'SUBMIT INQUIRY': '提交询价', 'Continue Shopping': '继续选购',
    'Our Service': '我们的服务', 'Quick Navigation': '快速导航', 'contact information': '联系信息',
    'Wall Panel Joint Profile': '墙板连接型材', 'Wall Panel Edge Trim Profile': '墙板收边型材',
    'LED Channel For Wall Panel': '墙板灯带槽', 'Cabinet Aluminum Handle': '橱柜铝合金拉手',
    'Aluminum Tile Edge Trim profile': '铝合金瓷砖收边型材', 'Aluminum Skirting Profile': '铝合金踢脚线型材',
    'Aluminum Carpet Transition Strip': '铝合金地毯过渡条', 'Aluminum Skirting Board': '铝合金踢脚线',
    'Aluminum Transition Flooring Strip': '铝合金地板过渡条', 'Clip-On Skirting Board': '卡扣式踢脚线',
    'Aluminum L-shaped Straight Tile Trim For Wall Floor': '墙地面 L 型铝合金瓷砖收边条',
    'L-Shaped Cap Aluminum Wall Panel Edge Trim': 'L 型铝合金墙板封边条',
    'Aluminium Square Edge Tile Trim': '铝合金方边瓷砖收边条',
    'Aluminum G Handle Profile For Kitchen Cabinet And Wardrobe': '厨柜衣柜铝合金 G 型拉手',
    'Aluminum Inside Corner Profile for wall panel': '墙板铝合金阴角型材',
    'Wall Panel Trim H Joint Clip2': '墙板 H 型连接条 2', 'Wall Panel Trim H Joint Clip': '墙板 H 型连接条',
    'Wall Panel Outside Corner': '墙板阳角条', 'U-channel aluminum edge trim': 'U 型铝合金收边条',
    'LED Lighting Skirting Board': 'LED 灯光踢脚线', 'Kitchen Hidden Handle Profile': '厨房隐藏式拉手型材',
    'Cupboard Door Handle Profile': '橱柜门拉手型材', 'Aluminum Wall Panel Trim End Cap': '铝合金墙板封边条',
    'Aluminum Flat Bar': '铝合金扁条', 'Uncategorized': '其他产品',
    'Product Features – Aluminum Skirting Board': '产品特点——铝合金踢脚线',
    'Strong Material': '坚固材质', 'Product Features': '产品特点', 'Description': '产品描述', 'Product description': '产品说明',
    'Categories:': '产品分类：', 'Model No.': '型号', 'Material：': '材质：', 'Color：': '颜色：',
    'Length：': '长度：', 'Height：': '高度：', 'Width：': '宽度：', 'Thickness ：': '厚度：',
    'Surface Treatment：': '表面处理：', 'Inquire Now': '立即询价', 'Add to Quote': '加入询价',
    'Share': '分享', 'For Him': '联系我们',
    'years of experience': '年行业经验', 'Factory area': '工厂面积', 'Company Establishment': '公司成立',
    'English': 'English', '简体中文': '简体中文'
  }));

  function translateChinese() {
    if (!isZh) return;
    document.documentElement.lang = 'zh-CN';
    for (const [english, chinese] of zhText) {
      if (document.title === english || document.title.startsWith(`${english} |`)) {
        document.title = document.title.replace(english, chinese);
        break;
      }
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(node.parentElement?.tagName || '')
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      const raw = node.nodeValue;
      const value = raw.trim();
      if (!value) continue;
      let translated = zhText.get(value);
      if (!translated && value.startsWith('Product Features – ')) {
        const productName = value.slice('Product Features – '.length);
        translated = `产品特点——${zhText.get(productName) || productName}`;
      }
      if (translated) node.nodeValue = raw.replace(value, translated);
    }
    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach((field) => {
      const value = field.getAttribute('placeholder');
      if (zhText.has(value)) field.setAttribute('placeholder', zhText.get(value));
    });
    document.querySelectorAll('[aria-label]').forEach((element) => {
      const value = element.getAttribute('aria-label');
      if (zhText.has(value)) element.setAttribute('aria-label', zhText.get(value));
    });
  }
  const readQuote = () => {
    try { return JSON.parse(localStorage.getItem(QUOTE_KEY) || '[]'); } catch { return []; }
  };
  const saveQuote = (items) => {
    localStorage.setItem(QUOTE_KEY, JSON.stringify(items));
    updateQuoteBadges();
  };
  const toast = (message) => {
    let el = document.getElementById('static-site-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'static-site-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  };
  const updateQuoteBadges = () => {
    const count = readQuote().reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    document.querySelectorAll('.cxb-b2b-quote-basket-toggle-count,.nbb2b-qs-count').forEach((el) => {
      el.textContent = String(count);
      el.style.display = count ? '' : 'none';
    });
  };

  function languagePath(lang) {
    let path = location.pathname || '/';
    if (lang === 'zh_CN') return isZh ? path : '/zh' + (path === '/' ? '/' : path);
    path = path.replace(/^\/zh(?=\/|$)/, '') || '/';
    return path;
  }

  document.querySelectorAll('[data-fhwp-lang]').forEach((link) => {
    const lang = link.getAttribute('data-fhwp-lang');
    link.href = languagePath(lang);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      location.href = languagePath(lang);
    });
  });

  document.querySelectorAll('a[href]').forEach((link) => {
    try {
      const url = new URL(link.href, location.origin);
      if (url.origin !== location.origin) return;
      if (url.pathname === '/product/' || url.pathname === '/zh/product/') {
        link.href = isZh ? '/zh/products/' : '/products/';
      }
    } catch {}
  });

  document.querySelectorAll('video:not([src])').forEach((video) => {
    if (!video.querySelector('source[src]')) {
      const poster = video.getAttribute('poster');
      if (poster) {
        const image = document.createElement('img');
        image.src = poster;
        image.alt = isZh ? '铝型材生产车间' : 'Aluminum profile production workshop';
        image.className = 'static-video-poster';
        image.loading = 'lazy';
        video.replaceWith(image);
      } else {
        video.removeAttribute('controls');
        video.setAttribute('aria-label', isZh ? '工厂展示图片' : 'Factory showcase image');
      }
    }
  });

  function repairEmptyCategoryImage() {
    document.querySelectorAll('.reference-category-card--empty .reference-category-card__image').forEach((link) => {
      if (link.querySelector('img')) return;
      const image = document.createElement('img');
      image.src = '/wp-content/uploads/2026/10/13-scaled-1-995x1024.jpg';
      image.alt = isZh ? '铝合金装饰型材' : 'Aluminum decorative profiles';
      image.width = 995;
      image.height = 1024;
      image.loading = 'lazy';
      image.decoding = 'async';
      link.appendChild(image);
    });
  }

  function setupRevealAnimations() {
    const groups = [
      '.reference-feature',
      '.reference-section-title',
      '.reference-category-card',
      '.reference-about__media',
      '.reference-about__copy',
      '.reference-stats > div',
      '.reference-product-card',
      '.reference-why__image',
      '.reference-why__copy',
      '.reference-manufacturer__inner',
      '.reference-message__inner',
      '.reference-values article',
      '.reference-about-gallery img'
    ];
    const elements = Array.from(document.querySelectorAll(groups.join(',')));
    elements.forEach((element) => {
      element.classList.add('static-reveal');
      const siblings = Array.from(element.parentElement?.children || []).filter((child) => elements.includes(child));
      const index = Math.max(0, siblings.indexOf(element));
      element.style.setProperty('--reveal-delay', `${Math.min(index * 90, 360)}ms`);
    });
    document.querySelectorAll('.reference-about__media,.reference-why__image').forEach((el) => el.classList.add('static-reveal--left'));
    document.querySelectorAll('.reference-about__copy,.reference-why__copy').forEach((el) => el.classList.add('static-reveal--right'));

    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        instance.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -7% 0px' });
    elements.forEach((element) => observer.observe(element));
  }

  function setupSectionAnchors() {
    const anchors = [
      ['.reference-catalogue', 'main-catalogue'],
      ['.reference-about', 'about-us'],
      ['.reference-stats', 'company-statistics'],
      ['.reference-hot-products', 'hot-products'],
      ['.reference-why', 'why-choose-us']
    ];
    anchors.forEach(([selector, id]) => {
      const section = document.querySelector(selector);
      if (section && !section.id) section.id = id;
    });
    const target = location.hash ? document.querySelector(location.hash) : null;
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
  }

  function setupStatCounters() {
    const stats = document.querySelector('.reference-stats');
    if (!stats) return;
    const counters = Array.from(stats.querySelectorAll('strong')).map((element) => {
      const textNode = Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
      if (!textNode) return null;
      const raw = textNode.nodeValue.trim();
      const target = Number(raw.replace(/[^0-9]/g, ''));
      if (!target) return null;
      return { element, textNode, target, plus: raw.includes('+'), grouped: raw.includes(',') };
    }).filter(Boolean);
    if (!counters.length) return;

    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      const duration = 1500;
      const start = performance.now();
      const frame = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        counters.forEach(({ textNode, target, plus, grouped }) => {
          const current = Math.round(target * eased);
          const value = grouped ? current.toLocaleString('en-US') : String(current);
          textNode.nodeValue = `${value}${plus ? '+' : ''} `;
        });
        if (progress < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      play();
      return;
    }
    const observer = new IntersectionObserver((entries, instance) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      play();
      instance.disconnect();
    }, { threshold: .35 });
    observer.observe(stats);
  }

  document.querySelectorAll('.alloy-socials a').forEach((link) => {
    const label = (link.getAttribute('aria-label') || '').toLowerCase();
    if (label === 'whatsapp') {
      link.href = 'https://wa.me/8613148937772';
      link.target = '_blank';
      link.rel = 'noopener';
    } else {
      link.href = isZh ? '/zh/contact-us/' : '/contact-us/';
    }
  });

  function setupAccountEntry() {
    let session = null;
    try { session = JSON.parse(localStorage.getItem('lumosy_auth_session_v1') || 'null'); } catch {}
    const destination = session?.role === 'admin'
      ? (isZh ? '/zh/admin/' : '/admin/')
      : session
        ? (isZh ? '/zh/account/' : '/account/')
        : (isZh ? '/zh/login/' : '/login/');
    const label = session?.role === 'admin'
      ? (isZh ? '管理后台' : 'ADMIN')
      : session
        ? (isZh ? '用户中心' : 'ACCOUNT')
        : (isZh ? '登录 / 注册' : 'LOGIN / REGISTER');
    document.querySelectorAll('#menu-primary-menu,#menu-primary-menu-1').forEach((menu) => {
      if (menu.querySelector('.static-account-menu')) return;
      const item = document.createElement('li');
      item.className = 'menu-item static-account-menu';
      item.innerHTML = `<a href="${destination}">${label}</a>`;
      menu.insertBefore(item, menu.lastElementChild);
    });
  }

  function productFromControl(control) {
    const card = control.closest('.reference-store-card,.cxb-b2b-product-card,article');
    const title = (card?.querySelector('h2,h3,h6')?.textContent || document.querySelector('h1')?.textContent || document.title).trim();
    const image = card?.querySelector('img')?.getAttribute('src') || document.querySelector('.cxb-b2b-gallery-main img')?.getAttribute('src') || '';
    const productLink = card?.querySelector('h2 a,h3 a,h6 a,.reference-store-card__image')?.getAttribute('href') || location.pathname;
    const id = control.dataset.productId || productLink;
    return { id, title, image, url: productLink, qty: 1 };
  }

  function addToQuote(control) {
    const product = productFromControl(control);
    const items = readQuote();
    const existing = items.find((item) => String(item.id) === String(product.id));
    if (existing) existing.qty = (Number(existing.qty) || 1) + 1;
    else items.push(product);
    saveQuote(items);
    control.classList.add('is-added');
    if (control.matches('a,button') && control.textContent.trim()) control.dataset.originalText ||= control.textContent.trim();
    toast(copy.added);
  }

  function renderQuotePage() {
    const table = document.querySelector('.cxb-b2b-quote-request-table');
    if (!table) return;
    const items = readQuote();
    const empty = document.querySelector('.cxb-b2b-quote-request-empty');
    const content = document.querySelector('.cxb-b2b-quote-request-content');
    table.querySelectorAll('.static-quote-row').forEach((row) => row.remove());
    if (!items.length) {
      if (empty) empty.style.display = '';
      if (content) content.style.display = 'none';
      return;
    }
    if (empty) empty.style.display = 'none';
    if (content) content.style.display = '';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'cxb-b2b-quote-request-table-row static-quote-row';
      row.innerHTML = `<div class="cxb-b2b-quote-request-table-cell product-picture">${item.image ? `<img src="${item.image}" alt="">` : ''}</div><div class="cxb-b2b-quote-request-table-cell product-name"><a href="${item.url || '#'}">${item.title}</a></div><div class="cxb-b2b-quote-request-table-cell product-quantity"><input type="number" min="1" value="${Number(item.qty) || 1}" aria-label="Quantity"></div><div class="cxb-b2b-quote-request-table-cell product-actions"><button type="button" class="static-quote-remove" aria-label="Remove">×</button></div>`;
      row.querySelector('input').addEventListener('change', (event) => {
        item.qty = Math.max(1, Number(event.target.value) || 1);
        saveQuote(items);
      });
      row.querySelector('.static-quote-remove').addEventListener('click', () => {
        saveQuote(items.filter((saved) => String(saved.id) !== String(item.id)));
        renderQuotePage();
        toast(copy.removed);
      });
      table.appendChild(row);
    }
  }

  async function formMailto(form) {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const lines = [];
    for (const [key, value] of data.entries()) {
      if (value instanceof File || !String(value).trim() || key.includes('nonce') || key.startsWith('_')) continue;
      lines.push(`${key.replaceAll('_', ' ')}: ${String(value).trim()}`);
    }
    const items = readQuote();
    if (items.length) {
      lines.push('', isZh ? '询价产品：' : 'Products:');
      for (const item of items) lines.push(`- ${item.title} × ${Number(item.qty) || 1}`);
    }
    const session = readStore(SESSION_KEY, null);
    const fields = {};
    for (const [key, value] of data.entries()) {
      if (!(value instanceof File) && String(value).trim() && !key.includes('nonce') && !key.startsWith('_')) fields[key] = String(value).trim();
    }
    let inquiries = readStore(INQUIRIES_KEY, []);
    if (window.LumosyCloud?.enabled) {
      try { inquiries = await window.LumosyCloud.getInquiries(); } catch (error) { console.warn('Could not refresh inquiries before submit.', error); }
    }
    inquiries.unshift({
      id: `INQ-${Date.now().toString().slice(-8)}`,
      userId: session?.userId || null,
      customer: session?.name || fields.name || fields.your_name || fields.full_name || 'Guest',
      email: session?.email || fields.email || fields.your_email || '',
      fields,
      items: items.map((item) => ({ ...item })),
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    saveStore(INQUIRIES_KEY, inquiries);
    try {
      if (window.LumosyCloud?.enabled) await window.LumosyCloud.saveInquiries(inquiries);
      saveQuote([]);
      renderQuotePage();
      form.reset();
      toast(isZh ? '询价已提交，管理员后台已收到。' : 'Inquiry submitted. The administrator has received it.');
    } catch (error) {
      console.error('Inquiry sync failed.', error);
      toast(isZh ? '询价提交失败，请稍后重试。' : 'Inquiry submission failed. Please try again.');
    }
  }

  async function searchProducts(form) {
    const input = form.querySelector('input[type="search"],input[name="s"]');
    const query = (input?.value || '').trim().toLowerCase();
    const grid = document.querySelector('.reference-store-grid');
    if (!grid) return;
    const documents = [document];
    try {
      const response = await fetch(isZh ? '/zh/products/page/2/' : '/products/page/2/');
      if (response.ok) documents.push(new DOMParser().parseFromString(await response.text(), 'text/html'));
    } catch {}
    const allCards = documents.flatMap((doc) => Array.from(doc.querySelectorAll('.reference-store-card')));
    const seenProducts = new Set();
    const cards = allCards.filter((card) => {
      const link = card.querySelector('h2 a,h3 a,.reference-store-card__image')?.getAttribute('href');
      const key = link || card.querySelector('h2,h3')?.textContent.trim().toLowerCase();
      if (!key || seenProducts.has(key)) return false;
      seenProducts.add(key);
      return true;
    });
    const matches = cards.filter((card) => !query || card.textContent.toLowerCase().includes(query));
    grid.innerHTML = '';
    matches.forEach((card) => grid.appendChild(document.importNode(card, true)));
    if (isZh) translateChinese();
    let empty = document.querySelector('.static-search-empty');
    if (!empty) {
      empty = document.createElement('p');
      empty.className = 'static-search-empty';
      grid.after(empty);
    }
    empty.textContent = matches.length ? '' : copy.searchEmpty;
    document.querySelector('.reference-store-pagination')?.toggleAttribute('hidden', true);
    await applyManagedProducts();
    setupFavorites();
  }

  const readStore = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const saveStore = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  async function ensureManagedProducts() {
    if (window.LumosyCloud?.enabled) {
      try {
        const products = await window.LumosyCloud.getProducts();
        if (Array.isArray(products) && products.length) {
          saveStore(PRODUCTS_KEY, products);
          return products;
        }
      } catch (error) { console.warn('Cloud product loading failed; using local fallback.', error); }
    }
    try {
      const response = await fetch('/api/products', { cache: 'no-store' });
      if (!response.ok) throw new Error('shared product API unavailable');
      const products = (await response.json()).products;
      saveStore(PRODUCTS_KEY, products);
      return products;
    } catch {
      const existing = readStore(PRODUCTS_KEY, null);
      if (Array.isArray(existing) && existing.length) return existing;
      try {
        const response = await fetch('/auth-products.json', { cache: 'no-store' });
        if (!response.ok) return [];
        const products = await response.json();
        saveStore(PRODUCTS_KEY, products);
        return products;
      } catch { return []; }
    }
  }

  async function ensureManagedCategories() {
    if (window.LumosyCloud?.enabled) {
      try {
        const categories = await window.LumosyCloud.getCategories();
        if (Array.isArray(categories) && categories.length) {
          saveStore(CATEGORIES_KEY, categories);
          return categories;
        }
      } catch (error) { console.warn('Cloud category loading failed.', error); }
    }
    const existing = readStore(CATEGORIES_KEY, []);
    return Array.isArray(existing) ? existing : [];
  }

  async function applyManagedProducts() {
    const grid = document.querySelector('.reference-store-grid,.cxb-b2b-products-grid') || document.createElement('div');
    const [products, categories] = await Promise.all([ensureManagedProducts(), ensureManagedCategories()]);
    const categoryMatch = location.pathname.match(/\/product-category\/([^/]+)/);
    const currentCategorySlug = categoryMatch?.[1] || new URLSearchParams(location.search).get('category') || '';
    const productCategorySlug = (product) => product.categorySlug || categorySlugByName[product.category] || '';
    const belongsToCurrentCategory = (product) => !currentCategorySlug || productCategorySlug(product) === currentCategorySlug;
    const known = new Set();
    grid.querySelectorAll('.reference-store-card,.cxb-b2b-product-card').forEach((card) => {
      const link = card.querySelector('h2 a,h3 a,h6 a,.reference-store-card__image');
      const pathname = link ? new URL(link.getAttribute('href'), location.origin).pathname : (card.dataset.productLink || '');
      const product = products.find((item) => item.url === pathname || item.url === pathname.replace(/^\/zh/, ''));
      if (!product) return;
      known.add(product.id);
      card.hidden = product.status === 'inactive' || !belongsToCurrentCategory(product);
      card.dataset.managedProductId = product.id;
      card.querySelectorAll('h2 a,h3 a,h6 a').forEach((el) => { el.textContent = isZh && product.titleZh ? product.titleZh : product.title; });
      const category = card.querySelector('h2 + p,h3 + p,.cxb-b2b-product-category a');
      if (category) category.textContent = isZh && product.categoryZh ? product.categoryZh : product.category;
      const image = card.querySelector('img');
      if (image && product.image) { image.src = product.image; image.removeAttribute('srcset'); }
    });
    products.filter((product) => product.source === 'custom' && product.status !== 'inactive' && belongsToCurrentCategory(product) && !known.has(product.id)).forEach((product) => {
      const title = isZh && product.titleZh ? product.titleZh : product.title;
      const category = isZh && product.categoryZh ? product.categoryZh : product.category;
      const isCategoryGrid = grid.classList.contains('cxb-b2b-products-grid');
      const card = document.createElement(isCategoryGrid ? 'div' : 'article');
      card.className = isCategoryGrid ? 'cxb-b2b-product-card content-product-card cxb-b2b-product-card-top-image' : 'reference-store-card';
      card.dataset.managedProductId = product.id;
      card.dataset.productLink = product.url;
      card.innerHTML = isCategoryGrid
        ? `<div class="cxb-b2b-product-thumbnail"><a href="${product.url}"><div class="cxb-b2b-product-image-wrapper"><img loading="lazy" src="${product.image || '/wp-content/uploads/2026/10/logo.png'}" alt="${title.replaceAll('"', '&quot;')}"></div></a></div><div class="cxb-b2b-product-info"><h6 class="cxb-b2b-product-title"><a href="${product.url}">${title}</a></h6><div class="cxb-b2b-product-excerpt"><p>${title} — ${category}</p></div><div class="cxb-b2b-product-meta"><span class="cxb-b2b-product-category"><strong>${isZh ? '类别：' : 'Categories:'}</strong> <a href="${isZh ? '/zh' : ''}/product-category/${productCategorySlug(product)}/">${category}</a></span></div><div class="cxb-b2b-product-actions"><button type="button" class="cxb-b2b-add-to-quote-button" data-product-id="${product.id}"><span class="cxb-b2b-btn-label cxb-b2b-btn-label-default">${copy.addQuote}</span></button></div></div>`
        : `<a class="reference-store-card__image" href="${product.url}"><img loading="lazy" src="${product.image || '/wp-content/uploads/2026/10/logo.png'}" alt="${title.replaceAll('"', '&quot;')}"></a><h2><a href="${product.url}">${title}</a></h2><p>${category}</p><span>${copy.rating}</span><a class="reference-store-card__button" href="${product.url}#inquiry">${copy.addQuote}</a>`;
      grid.appendChild(card);
    });
    const activeProducts = products.filter((product) => product.status !== 'inactive');
    document.querySelectorAll('.cxb-b2b-sidebar-category-link').forEach((link) => {
      const slug = new URL(link.getAttribute('href'), location.origin).pathname.match(/\/product-category\/([^/]+)/)?.[1];
      const count = activeProducts.filter((product) => productCategorySlug(product) === slug).length;
      const countElement = link.querySelector('.category-count');
      if (countElement) countElement.textContent = String(count);
    });
    const currentCount = activeProducts.filter(belongsToCurrentCategory).length;
    const toolbarCount = document.querySelector('.cxb-b2b-archive-toolbar-count');
    if (toolbarCount) toolbarCount.innerHTML = `<strong>${currentCount}</strong> ${isZh ? '产品' : currentCount === 1 ? 'product' : 'products'}`;

    const sidebarList = document.querySelector('.cxb-b2b-sidebar-category-list,.cxb-b2b-sidebar-categories');
    if (sidebarList) categories.filter((category) => category.status !== 'inactive').forEach((category) => {
      if (sidebarList.querySelector(`[data-cloud-category="${CSS.escape(category.slug)}"]`)) return;
      const item = document.createElement('li');
      item.className = 'cxb-b2b-sidebar-category-item amazon level-0';
      const link = document.createElement('a');
      link.className = 'cxb-b2b-sidebar-category-link';
      link.dataset.cloudCategory = category.slug;
      link.href = `${isZh ? '/zh' : ''}/products/?category=${encodeURIComponent(category.slug)}`;
      const count = activeProducts.filter((product) => productCategorySlug(product) === category.slug).length;
      link.innerHTML = `<span>${isZh && category.zh ? category.zh : category.name}</span><span class="category-count">${count}</span>`;
      item.appendChild(link);
      sidebarList.appendChild(item);
    });

    const categoryGrid = document.querySelector('.reference-category-grid');
    if (categoryGrid) categories.filter((category) => category.status !== 'inactive' && category.source === 'custom').forEach((category) => {
      if (categoryGrid.querySelector(`[data-cloud-category="${CSS.escape(category.slug)}"]`)) return;
      const first = activeProducts.find((product) => productCategorySlug(product) === category.slug);
      const card = document.createElement('article');
      card.className = 'reference-category-card';
      card.dataset.cloudCategory = category.slug;
      const href = `${isZh ? '/zh' : ''}/products/?category=${encodeURIComponent(category.slug)}`;
      card.innerHTML = `<a class="reference-category-card__image" href="${href}"><img loading="lazy" src="${first?.image || '/wp-content/uploads/2026/10/logo.png'}" alt=""></a><h3><a href="${href}">${isZh && category.zh ? category.zh : category.name}</a></h3><span>${activeProducts.filter((product) => productCategorySlug(product) === category.slug).length} ${isZh ? '个产品' : 'Products'}</span>`;
      categoryGrid.appendChild(card);
    });

    const homeGrid = document.querySelector('.reference-product-grid');
    if (homeGrid) products.filter((product) => product.source === 'custom' && product.status !== 'inactive' && product.homepage).forEach((product) => {
      if (homeGrid.querySelector(`[data-managed-product-id="${CSS.escape(product.id)}"]`)) return;
      const title = isZh && product.titleZh ? product.titleZh : product.title;
      const card = document.createElement('article');
      card.className = 'reference-product-card';
      card.dataset.managedProductId = product.id;
      card.innerHTML = `<a class="reference-product-card__image" href="${product.url}"><img loading="lazy" src="${product.image || '/wp-content/uploads/2026/10/logo.png'}" alt="${title.replaceAll('"', '&quot;')}"></a><h3><a href="${product.url}">${title}</a></h3><a class="reference-button" href="${product.url}">${isZh ? '了解更多' : 'More Info'}</a>`;
      homeGrid.appendChild(card);
    });
  }

  function setupFavorites() {
    document.querySelectorAll('.reference-store-card,.reference-product-card,.cxb-b2b-product-card').forEach((card) => {
      if (card.querySelector('.static-favorite-button')) return;
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'static-favorite-button';
      control.setAttribute('aria-label', isZh ? '收藏产品' : 'Save product');
      control.textContent = '♡';
      const product = productFromControl(card.querySelector('.reference-store-card__button,.cxb-b2b-add-to-quote-button') || card);
      control.dataset.favoriteId = String(product.id);
      const session = readStore(SESSION_KEY, null);
      const saved = readStore(FAVORITES_KEY, []).some((item) => item.userId === session?.userId && String(item.product.id) === String(product.id));
      control.classList.toggle('is-saved', saved);
      control.textContent = saved ? '♥' : '♡';
      (card.querySelector('.reference-store-card__image,.reference-product-card__image,.cxb-b2b-product-thumbnail') || card).appendChild(control);
    });
  }

  const searchForm = document.querySelector('.reference-store-search');
  if (searchForm) searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    searchProducts(searchForm);
  }, true);

  const sorter = document.querySelector('.reference-store-toolbar select');
  if (sorter) sorter.addEventListener('change', async () => {
    const grid = document.querySelector('.reference-store-grid');
    if (!grid) return;
    if (!grid.dataset.staticAllLoaded && searchForm) {
      await searchProducts(searchForm);
      grid.dataset.staticAllLoaded = 'true';
    }
    const cards = Array.from(grid.children);
    if (sorter.selectedIndex === 2) cards.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));
    if (sorter.selectedIndex === 1) cards.reverse();
    cards.forEach((card) => grid.appendChild(card));
  });

  document.addEventListener('click', (event) => {
    const favorite = event.target.closest('.static-favorite-button');
    if (favorite) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const session = readStore(SESSION_KEY, null);
      if (!session) {
        toast(copy.loginFavorite);
        setTimeout(() => { location.href = `${isZh ? '/zh' : ''}/login/?next=${encodeURIComponent(location.pathname)}`; }, 450);
        return;
      }
      const card = favorite.closest('.reference-store-card,.reference-product-card,article');
      const product = productFromControl(card.querySelector('.reference-store-card__button,.cxb-b2b-add-to-quote-button') || card);
      const favorites = readStore(FAVORITES_KEY, []);
      const index = favorites.findIndex((item) => item.userId === session.userId && String(item.product.id) === String(product.id));
      if (index >= 0) {
        favorites.splice(index, 1);
        favorite.classList.remove('is-saved');
        favorite.textContent = '♡';
        toast(copy.favoriteRemoved);
      } else {
        favorites.push({ userId: session.userId, product, createdAt: new Date().toISOString() });
        favorite.classList.add('is-saved');
        favorite.textContent = '♥';
        toast(copy.favoriteAdded);
      }
      saveStore(FAVORITES_KEY, favorites);
      return;
    }
    const add = event.target.closest('.reference-store-card__button,.cxb-b2b-add-to-quote-button,.cxb-b2b-mh-quote-icon');
    if (add) {
      event.preventDefault();
      event.stopImmediatePropagation();
      addToQuote(add);
      return;
    }
    const basket = event.target.closest('.cxb-b2b-quote-basket-toggle,[data-action="list"]');
    if (basket) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = isZh ? '/zh/request-a-quote/' : '/request-a-quote/';
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'products') { event.preventDefault(); location.href = isZh ? '/zh/products/' : '/products/'; }
    if (action === 'contact') { event.preventDefault(); location.href = 'tel:+8613148937772'; }
    if (action === 'backtop') { event.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); }
    if (action === 'message') {
      event.preventDefault();
      document.getElementById('nbb2b-lm-panel')?.style.setProperty('display', 'block');
    }
  }, true);

  const messageBar = document.getElementById('nbb2b-lm-bar');
  const messagePanel = document.getElementById('nbb2b-lm-panel');
  const messageClose = document.getElementById('nbb2b-lm-close');
  messageBar?.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    messagePanel.style.display = messagePanel.style.display === 'none' ? 'block' : 'none';
  }, true);
  messageClose?.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    messagePanel.style.display = 'none';
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.classList.contains('reference-store-search')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    formMailto(form);
  }, true);

  updateQuoteBadges();
  renderQuotePage();
  setupAccountEntry();
  applyManagedProducts().then(setupFavorites);
  translateChinese();
  repairEmptyCategoryImage();
  setupSectionAnchors();
  setupRevealAnimations();
  setupStatCounters();
  if (isZh) setTimeout(translateChinese, 250);
})();
