const CART_KEY = 'vastra_cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function updateCartBadge() {
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(b => {
    b.textContent = total;
    b.style.display = total > 0 ? 'flex' : 'none';
  });
}

function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(i => i.id === product.id);
  if (existing) { existing.qty += product.qty || 1; }
  else { cart.push({ ...product, qty: product.qty || 1 }); }
  saveCart(cart);
  updateCartBadge();
  showToast(`<i class="fas fa-check-circle"></i> Added to cart!`);
}

function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  const overlay = document.querySelector('.mobile-overlay');
  if (!hamburger) return;
  function close() {
    hamburger.classList.remove('open');
    mobileNav.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.contains('open');
    if (isOpen) { close(); }
    else {
      hamburger.classList.add('open');
      mobileNav.classList.add('open');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  });
  overlay.addEventListener('click', close);
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
}

function initAddToCartButtons() {
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card = btn.closest('[data-product]');
      if (!card) return;
      addToCart(JSON.parse(card.dataset.product));
    });
  });
}

function initProductModal() {
  const modal = document.getElementById('productModal');
  if (!modal) return;
  const overlay = modal.querySelector('.modal-overlay') || modal;
  const closeBtn = modal.querySelector('.modal-close');
  const mainImg = modal.querySelector('.modal-main-img');
  const thumbs = modal.querySelectorAll('.modal-thumb');
  const addBtn = modal.querySelector('.modal-add-btn');

  document.querySelectorAll('.product-card[data-product]').forEach(card => {
    card.addEventListener('click', () => {
      const p = JSON.parse(card.dataset.product);
      modal.querySelector('.modal-title').textContent = p.name;
      modal.querySelector('.modal-price').textContent = '₹' + p.price.toLocaleString('en-IN');
      if (mainImg && p.img) mainImg.src = p.img;
      thumbs.forEach(t => { if (p.img) t.src = p.img; });
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (addBtn) {
        addBtn.onclick = () => {
          const qty = parseInt(modal.querySelector('.modal-qty').value) || 1;
          const size = modal.querySelector('.modal-select')?.value || 'M';
          addToCart({ ...p, qty, size });
          modal.classList.remove('open');
          document.body.style.overflow = '';
        };
      }
    });
  });

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      if (mainImg) mainImg.src = thumb.src;
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
}

function initCartPage() {
  const tableBody = document.getElementById('cartBody');
  if (!tableBody) return;
  renderCart();

  function renderCart() {
    const cart = getCart();
    tableBody.innerHTML = '';
    if (cart.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6"><div class="empty-cart"><i class="fas fa-shopping-bag"></i><p>Your cart is empty.</p><a href="shop.html" class="btn btn-primary">Start Shopping</a></div></td></tr>`;
      updateTotals(0);
      return;
    }
    cart.forEach((item, idx) => {
      const sub = item.price * item.qty;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><button class="remove-btn" data-idx="${idx}">✕</button></td>
        <td><img src="${item.img}" alt="${item.name}" class="cart-product-img" onerror="this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100'"/></td>
        <td><div class="cart-product-name">${item.name}</div><div class="cart-product-brand">${item.brand || ''}</div></td>
        <td>₹${item.price.toLocaleString('en-IN')}</td>
        <td><input type="number" class="qty-input" value="${item.qty}" min="1" data-idx="${idx}"/></td>
        <td>₹${sub.toLocaleString('en-IN')}</td>
      `;
      tableBody.appendChild(tr);
    });
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    updateTotals(subtotal);
    attachCartEvents();
  }

  function updateTotals(subtotal) {
    const shipping = subtotal > 0 && subtotal < 999 ? 99 : 0;
    const el = id => document.getElementById(id);
    if (el('cartSubtotal')) el('cartSubtotal').textContent = '₹' + subtotal.toLocaleString('en-IN');
    if (el('cartShipping')) el('cartShipping').textContent = shipping === 0 ? 'Free' : '₹' + shipping;
    if (el('cartTotal')) el('cartTotal').textContent = '₹' + (subtotal + shipping).toLocaleString('en-IN');
  }

  function attachCartEvents() {
    tableBody.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cart = getCart();
        cart.splice(parseInt(btn.dataset.idx), 1);
        saveCart(cart);
        updateCartBadge();
        renderCart();
      });
    });
    tableBody.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('change', () => {
        const cart = getCart();
        const idx = parseInt(input.dataset.idx);
        const val = Math.max(1, parseInt(input.value) || 1);
        cart[idx].qty = val;
        saveCart(cart);
        updateCartBadge();
        renderCart();
      });
    });
  }

  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      const cart = getCart();
      if (cart.length === 0) { showToast('<i class="fas fa-exclamation-circle"></i> Cart is empty!'); return; }
      showToast('<i class="fas fa-check-circle"></i> Order placed! Thank you.');
      saveCart([]);
      updateCartBadge();
      setTimeout(renderCart, 1500);
    });
  }
}

function initNewsletterForm() {
  document.querySelectorAll('.newsletter-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('input');
      if (input && input.value) {
        showToast('<i class="fas fa-envelope"></i> Subscribed successfully!');
        input.value = '';
      }
    });
  });
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    showToast('<i class="fas fa-check-circle"></i> Message sent! We\'ll respond soon.');
    form.reset();
  });
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar a, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === 'index.html' && href === 'index.html') || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  initMobileMenu();
  initAddToCartButtons();
  initProductModal();
  initCartPage();
  initNewsletterForm();
  initContactForm();
  setActiveNav();
});