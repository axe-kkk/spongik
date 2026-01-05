/**
 * Spongik Frontend
 * Минимальный JS для интерактивности
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initMobileMenu();
    initFavorites();
    initAddToCart();
    initToast();
    loadBestsellers();
    initProductCardClicks();
});

// === Header scroll effect ===
function initHeader() {
    const header = document.querySelector('.header');
    if (!header) return;
    
    const onScroll = () => {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

// === Mobile Menu ===
function initMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const navClose = document.getElementById('nav-close');
    const nav = document.getElementById('main-nav');
    const overlay = document.getElementById('nav-overlay');
    
    if (!menuToggle || !nav) return;
    
    const closeMenu = () => {
        nav.classList.remove('is-open');
        if (overlay) {
            overlay.classList.remove('is-open');
        }
        document.body.style.overflow = '';
    };
    
    const openMenu = () => {
        nav.classList.add('is-open');
        if (overlay) {
            overlay.classList.add('is-open');
        }
        document.body.style.overflow = 'hidden';
    };
    
    const toggleMenu = () => {
        if (nav.classList.contains('is-open')) {
            closeMenu();
        } else {
            openMenu();
        }
    };
    
    menuToggle.addEventListener('click', openMenu);
    
    if (navClose) {
        navClose.addEventListener('click', closeMenu);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeMenu);
    }
    
    // Close menu when clicking on nav links
    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) {
            closeMenu();
        }
    });
}

// === Favorites ===
function initFavorites() {
    // Load from localStorage for guests
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    
    document.querySelectorAll('.product-card__favorite').forEach(btn => {
        const card = btn.closest('.product-card');
        const productId = card?.dataset.productId;
        
        // Set initial state
        if (productId && favorites.includes(productId)) {
            btn.classList.add('is-active');
        }
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.classList.toggle('is-active');
            
            if (productId) {
                const idx = favorites.indexOf(productId);
                if (idx > -1) {
                    favorites.splice(idx, 1);
                } else {
                    favorites.push(productId);
                }
                localStorage.setItem('favorites', JSON.stringify(favorites));
            }
            
            // Micro animation
            btn.style.transform = 'scale(1.2)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 150);
        });
    });
}

// === Add to Cart ===
const CART_KEY = 'spongik_cart';

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function initAddToCart() {
    const cartCountEl = document.getElementById('cart-count');
    
    // Update count display
    const updateCartCount = () => {
        const cart = getCart();
        const count = cart.reduce((sum, item) => sum + item.qty, 0);
        if (cartCountEl) {
            cartCountEl.textContent = count;
            cartCountEl.style.display = count > 0 ? 'flex' : 'none';
        }
    };
    
    updateCartCount();
    
    // Support both old .btn-add and new data-action="add-to-cart"
    document.querySelectorAll('.btn-add, [data-action="add-to-cart"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            if (!card) return;
            
            const productId = card.dataset.productId;
            if (!productId) return;
            
            // Try to get product data from data attributes first (new way)
            let product = null;
            if (card.dataset.productPrice) {
                product = {
                    id: parseInt(card.dataset.productId),
                    slug: card.dataset.productSlug || '',
                    name: card.querySelector('.product-card__name')?.textContent || card.querySelector('.product-name')?.textContent || '',
                    price: parseFloat(card.dataset.productFinalPrice || card.dataset.productPrice || 0),
                    final_price: parseFloat(card.dataset.productFinalPrice || card.dataset.productPrice || 0),
                    old_price: card.dataset.productOldPrice ? parseFloat(card.dataset.productOldPrice) : null,
                    discount_percent: card.dataset.productDiscountPercent ? parseInt(card.dataset.productDiscountPercent) : null,
                    is_featured: card.dataset.productIsFeatured === 'true',
                    primary_image: card.querySelector('.product-card__img')?.src || null,
                };
            } else {
                // Fallback to old way
                const name = card.querySelector('.product-name a')?.textContent || card.querySelector('.product-name')?.textContent || '';
                const slug = card.querySelector('.product-name a')?.getAttribute('href')?.split('slug=')[1] || '';
                const priceEl = card.querySelector('.price-current') || card.querySelector('.product-price') || card.querySelector('.product-card__price-current');
                const price = parseFloat(priceEl?.textContent?.replace(/[^\d.,]/g, '').replace(',', '.') || 0);
                const image = card.querySelector('.product-card__img')?.src || null;
                
                product = {
                    id: parseInt(productId),
                    name: name,
                    slug: slug,
                    price: price,
                    final_price: price,
                    primary_image: image,
                };
            }
            
            // Use cart module if available, otherwise fallback to old way
            if (window.cart && typeof window.cart.add === 'function') {
                window.cart.add(product);
            } else {
                // Old way - direct localStorage manipulation
                const cart = getCart();
                const existing = cart.find(item => item.id == product.id);
                
                if (existing) {
                    existing.qty++;
                } else {
                    cart.push({
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        price: product.final_price || product.price,
                        old_price: product.old_price || null,
                        discount_percent: product.discount_percent || null,
                        is_featured: product.is_featured || false,
                        image: product.primary_image,
                        qty: 1
                    });
                }
                
                saveCart(cart);
            }
            
            updateCartCount();
            
            // Button feedback
            const originalText = btn.textContent;
            btn.textContent = 'Додано ✓';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1500);
            
            // Show toast
            if (window.showToast) {
                window.showToast('Товар додано до кошика', 'success');
            } else {
                showToast('Товар додано до кошика');
            }
            
            // Cart icon pulse
            const cartBtn = document.querySelector('.cart-btn');
            if (cartBtn) {
                cartBtn.style.transform = 'scale(1.15)';
                setTimeout(() => {
                    cartBtn.style.transform = '';
                }, 200);
            }
        });
    });
}

// === Toast Notifications ===
let toastTimeout;

function initToast() {
    // Toast is already in HTML
}

function showToast(message, type = 'default') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    // Clear existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // Update message and type
    toast.textContent = message;
    toast.className = 'toast';
    if (type !== 'default') {
        toast.classList.add(`toast--${type}`);
    }
    
    // Show
    toast.classList.add('is-visible');
    
    // Hide after delay
    toastTimeout = setTimeout(() => {
        toast.classList.remove('is-visible');
    }, 3000);
}

// Export for global use
window.showToast = showToast;

// === Load Bestsellers ===
async function loadBestsellers() {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;
    
    // Show skeletons
    grid.innerHTML = Array(4).fill(0).map(() => `
        <article class="product-card">
            <div class="product-image skeleton skeleton--img"></div>
            <div class="product-info">
                <div class="skeleton skeleton--text" style="width:60%"></div>
                <div class="skeleton skeleton--text" style="width:90%"></div>
                <div class="skeleton skeleton--text" style="width:40%"></div>
            </div>
        </article>
    `).join('');
    
    try {
        const res = await fetch('/api/products?page_size=4&sort=newest');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        
        if (data.items && data.items.length > 0) {
            grid.innerHTML = data.items.map(p => renderProductCard(p)).join('');
            // initProductCardHandlers is called by renderProductsGrid in ui.js
            // But if we're using script.js directly, we need to handle it
            // For now, just use the old initAddToCart for compatibility
            initAddToCart();
            initProductCardClicks();
        } else {
            // Empty placeholders
            grid.innerHTML = Array(4).fill(0).map(() => `
                <article class="product-card product-card--empty">
                    <div class="product-image">
                        <div class="image-placeholder"></div>
                    </div>
                    <div class="product-info">
                        <span class="product-category">Каталог</span>
                        <h3 class="product-name">Новинки незабаром</h3>
                        <span class="product-stock product-stock--out">Очікується</span>
                        <div class="product-price"><span class="price-current">—</span></div>
                    </div>
                    <div class="product-card__actions">
                        <button class="btn btn-add" disabled>Скоро</button>
                    </div>
                </article>
            `).join('');
        }
    } catch (e) {
        // Empty placeholders on error
        grid.innerHTML = Array(4).fill(0).map(() => `
            <article class="product-card product-card--empty">
                <div class="product-image">
                    <div class="image-placeholder"></div>
                </div>
                <div class="product-info">
                    <span class="product-category">Каталог</span>
                    <h3 class="product-name">Новинки незабаром</h3>
                    <span class="product-stock product-stock--out">Очікується</span>
                    <div class="product-price"><span class="price-current">—</span></div>
                </div>
                <div class="product-card__actions">
                    <button class="btn btn-add" disabled>Скоро</button>
                </div>
            </article>
        `).join('');
    }
}

function renderProductCard(p) {
    const isFavorite = window.favorites?.has?.(p.id) || false;
    
    // Определяем цены
    const basePrice = parseFloat(p.price);
    const finalPrice = parseFloat(p.final_price || p.price);
    
    // Проверяем old_price - может быть null, undefined, строкой или числом
    let oldPrice = null;
    if (p.old_price !== null && p.old_price !== undefined && p.old_price !== '') {
        const parsed = parseFloat(p.old_price);
        if (!isNaN(parsed) && parsed > 0) {
            oldPrice = parsed;
        }
    }
    
    // Определяем, есть ли скидка и какие цены показывать
    // Вариант 1: есть old_price (прямая скидка на товаре)
    const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
    // Вариант 2: есть промоакция (final_price < price)
    const hasPromoDiscount = finalPrice < basePrice && p.discount_percent;
    
    const hasDiscount = hasDirectDiscount || hasPromoDiscount;
    
    // Определяем старую и новую цены для отображения
    let displayOldPrice = null;
    let displayNewPrice = finalPrice;
    
    if (hasDirectDiscount) {
        // Если есть old_price, показываем old_price (старая) и price (новая)
        displayOldPrice = oldPrice;
        displayNewPrice = basePrice;
    } else if (hasPromoDiscount) {
        // Если есть промоакция, показываем price (старая) и final_price (новая)
        displayOldPrice = basePrice;
        displayNewPrice = finalPrice;
    }
    
    const discountPercent = p.discount_percent || 
        (hasDirectDiscount && oldPrice ? Math.round((1 - basePrice / oldPrice) * 100) : null);
    
    const badges = [];
    if (discountPercent) {
        badges.push(`<span class="badge badge--sale">-${discountPercent}%</span>`);
    }
    if (p.is_featured) {
        badges.push(`<span class="badge badge--new">New</span>`);
    }
    
    const stockStatus = p.in_stock 
        ? '<span class="product-stock product-stock--in">✓ В наявності</span>'
        : '<span class="product-stock product-stock--out">Немає в наявності</span>';
    
    return `
        <article class="product-card" data-product-id="${p.id}" data-product-slug="${p.slug || ''}">
            <a href="/pages/product?slug=${p.slug || p.id}" class="product-card__image">
                ${badges.length ? `<div class="product-card__badges">${badges.join('')}</div>` : ''}
                
                <button class="product-card__favorite ${isFavorite ? 'is-active' : ''}" 
                        aria-label="В обране" 
                        data-action="toggle-favorite"
                        onclick="event.preventDefault(); event.stopPropagation();">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                </button>
                
                ${p.primary_image 
                    ? `<img src="${p.primary_image}" alt="${p.name}" class="product-card__img" loading="lazy">` 
                    : `<div class="product-card__placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="M21 15l-5-5L5 21"/>
                        </svg>
                    </div>`
                }
                
                <div class="product-card__quick-buy">
                    <button class="btn btn--primary" 
                            data-action="add-to-cart" 
                            ${!p.in_stock ? 'disabled' : ''}
                            onclick="event.preventDefault(); event.stopPropagation();">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; margin-right: 6px;">
                            <path d="M9 2L7 6m0 0L3 7l4 1m0 0l2 10 6-2-2-10M7 7h14l-1 7H8"/>
                        </svg>
                        ${p.in_stock ? 'До кошика' : 'Немає в наявності'}
                    </button>
                </div>
            </a>
            <div class="product-card__body">
                ${p.brand || p.category_name ? `<span class="product-card__brand">${p.brand || p.category_name}</span>` : ''}
                <h3 class="product-card__name">
                    <a href="/pages/product?slug=${p.slug || p.id}">${p.name}</a>
                </h3>
                <div style="margin: 8px 0 4px;">${stockStatus}</div>
                <div class="product-card__price">
                    ${hasDiscount && displayOldPrice !== null
                        ? `<span class="product-card__price-old">${formatPrice(displayOldPrice)}</span>
                           <span class="product-card__price-current product-card__price-sale">${formatPrice(displayNewPrice)}</span>`
                        : `<span class="product-card__price-current">${formatPrice(displayNewPrice)}</span>`
                    }
                </div>
            </div>
        </article>
    `;
}

function formatPrice(price, currency = '₴') {
    const num = parseFloat(price);
    if (isNaN(num)) return `0 ${currency}`;
    
    // Убираем копейки если целое число
    const formatted = num % 1 === 0 
        ? num.toLocaleString('uk-UA')
        : num.toLocaleString('uk-UA', { minimumFractionDigits: 2 });
    
    return `${formatted} ${currency}`;
}

// === Product card click handlers ===
function initProductCardClicks() {
    // Use event delegation on the grid container for better performance
    const grid = document.querySelector('.products-grid');
    if (!grid) return;
    
    // Remove existing listener if any (by using a flag or removing and re-adding)
    // For simplicity, just add the listener - it will work with event delegation
    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        
        // Don't navigate if clicking on buttons
        if (e.target.closest('button')) {
            return;
        }
        
        // If clicking on a link, let it work normally (it already has correct href)
        if (e.target.closest('a')) {
            return;
        }
        
        // For any other click on the card, navigate to product page
        const slug = card.dataset.productSlug;
        if (slug) {
            window.location.href = `/pages/product?slug=${slug}`;
        }
    });
    
    // Set cursor pointer on all cards
    grid.querySelectorAll('.product-card').forEach(card => {
        card.style.cursor = 'pointer';
    });
}

// === Smooth scroll for anchor links ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#') return;
        
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});
