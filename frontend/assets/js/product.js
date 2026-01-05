/**
 * Product Page Module
 * Premium product experience
 */

import api from './api.js';
import { cart, favorites, on } from './state.js';
import { formatPrice, showToast, updateCartCount, animatePulse, animateCartIcon, renderProductCard, initProductCardHandlers } from './ui.js';

// === State ===
let product = null;
let quantity = 1;
let currentSlide = 0;
let touchStartX = 0;
let touchEndX = 0;

// === DOM Elements ===
const elements = {
    galleryTrack: document.getElementById('gallery-track'),
    galleryDots: document.getElementById('gallery-dots'),
    galleryThumbs: document.getElementById('gallery-thumbs'),
    favoriteBtn: document.getElementById('favorite-btn'),
    qtyValue: document.getElementById('qty-value'),
    qtySelector: document.getElementById('qty-selector'),
    addToCartBtn: document.getElementById('add-to-cart-btn'),
    checkoutBtn: document.getElementById('checkout-btn'),
    stickyAddBtn: document.getElementById('sticky-add-btn'),
    stickyCheckoutBtn: document.getElementById('sticky-checkout-btn'),
    stickyCta: document.getElementById('sticky-cta'),
    relatedProducts: document.getElementById('related-products'),
    imageModal: document.getElementById('image-modal'),
    imageModalImg: document.getElementById('image-modal-img'),
    imageModalClose: document.getElementById('image-modal-close'),
    imageModalPrev: document.getElementById('image-modal-prev'),
    imageModalNext: document.getElementById('image-modal-next'),
    imageModalCounter: document.getElementById('image-modal-counter'),
};

// === Init ===
async function init() {
    // Get product slug from URL
    const slug = getSlugFromURL();
    
    if (slug) {
        await loadProduct(slug);
    }
    
    initUI();
    initGallery();
    initQuantity();
    initAddToCart();
    initFavorite();
    initStickyBar();
    initImageModal();
    
    updateCartCount();
    on('cart:updated', updateCartCount);
}

function getSlugFromURL() {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Try to get slug from query parameter first
    const slugFromQuery = searchParams.get('slug');
    if (slugFromQuery) return slugFromQuery;
    
    // Try to get from path /pages/product/{slug}
    let match = path.match(/\/pages\/product\/([^\/]+)/);
    if (match) return match[1];
    
    // Try to get from path /product/{slug}
    match = path.match(/\/product\/([^\/]+)/);
    if (match) return match[1];
    
    return null;
}

function initUI() {
    // Header scroll effect
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 10);
        }, { passive: true });
    }
    
    // Mobile menu
    const menuToggle = document.getElementById('menu-toggle');
    const navClose = document.getElementById('nav-close');
    const nav = document.getElementById('main-nav');
    const overlay = document.getElementById('nav-overlay');
    
    if (menuToggle && nav) {
        const closeMenu = () => {
            nav.classList.remove('is-open');
            if (overlay) overlay.classList.remove('is-open');
            document.body.style.overflow = '';
        };
        
        const openMenu = () => {
            nav.classList.add('is-open');
            if (overlay) overlay.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        };
        
        menuToggle.addEventListener('click', openMenu);
        if (navClose) navClose.addEventListener('click', closeMenu);
        if (overlay) overlay.addEventListener('click', closeMenu);
    }
}

// === Load Product ===
async function loadProduct(slug) {
    try {
        product = await api.getProduct(slug);
        renderProduct();
        await loadRelatedProducts();
    } catch (e) {
        console.error('Failed to load product:', e);
        showToast('Не вдалося завантажити товар', 'error');
    }
}

function renderProduct() {
    if (!product) return;
    
    // Debug: log full product object
    
    // Update page title
    document.title = `${product.name} — Spongik`;
    
    // Update gallery images
    if (product.images && product.images.length > 0) {
        renderGallery(product.images);
    } else if (product.primary_image) {
        // Fallback to primary image if no images array
        renderGallery([{ url: product.primary_image, alt: product.name }]);
    }
    
    // Update product info
    const brandEl = document.querySelector('.product-info__brand');
    if (brandEl && product.brand) {
        brandEl.textContent = product.brand;
    } else if (brandEl && product.category_name) {
        brandEl.textContent = product.category_name;
    } else if (brandEl) {
        brandEl.style.display = 'none';
    }
    
    const nameEl = document.querySelector('.product-info__name');
    if (nameEl) nameEl.textContent = product.name;
    
    // Update price
    const priceOldEl = document.querySelector('.product-info__price-old');
    const priceCurrentEl = document.querySelector('.product-info__price-current');
    const stickyPriceOldEl = document.querySelector('.sticky-cta__price-old');
    const stickyPriceCurrentEl = document.querySelector('.sticky-cta__price-current');
    
    
    // Same logic as in catalog.js
    const basePrice = parseFloat(product.price) || 0;
    const finalPrice = parseFloat(product.final_price || product.price) || 0;
    
    // Check old_price - может быть null, undefined, строкой или числом
    let oldPrice = null;
    if (product.old_price !== null && product.old_price !== undefined && product.old_price !== '') {
        const parsed = parseFloat(product.old_price);
        if (!isNaN(parsed) && parsed > 0) {
            oldPrice = parsed;
        }
    }
    
    // Вариант 1: есть old_price (прямая скидка на товаре)
    const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
    // Вариант 2: есть промоакция (final_price < price)
    const hasPromoDiscount = finalPrice < basePrice && product.discount_percent;
    
    const hasDiscount = hasDirectDiscount || hasPromoDiscount;
    
    // Determine what prices to display
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
    
    // Update current price
    if (priceCurrentEl) {
        priceCurrentEl.textContent = formatPrice(displayNewPrice);
    }
    if (stickyPriceCurrentEl) {
        stickyPriceCurrentEl.textContent = formatPrice(displayNewPrice);
    }
    
    // Update old price
    if (displayOldPrice !== null && displayOldPrice > 0) {
        if (priceOldEl) {
            priceOldEl.textContent = formatPrice(displayOldPrice);
            priceOldEl.style.display = 'inline';
        }
        if (stickyPriceOldEl) {
            stickyPriceOldEl.textContent = formatPrice(displayOldPrice);
            stickyPriceOldEl.style.display = 'block';
        }
    } else {
        if (priceOldEl) {
            priceOldEl.style.display = 'none';
        }
        if (stickyPriceOldEl) {
            stickyPriceOldEl.style.display = 'none';
        }
    }
    
    // Calculate discount percent for badges
    let discountPercent = product.discount_percent;
    if (hasDirectDiscount && oldPrice && (!discountPercent || discountPercent === 0)) {
        discountPercent = Math.round((1 - basePrice / oldPrice) * 100);
    } else if (hasPromoDiscount && (!discountPercent || discountPercent === 0)) {
        discountPercent = Math.round((1 - finalPrice / basePrice) * 100);
    }
    
    // Update badges
    const badgesEl = document.querySelector('.product-gallery__badges');
    if (badgesEl) {
        badgesEl.innerHTML = '';
        let hasAnyBadge = false;
        
        // Show discount badge if there's a discount
        if (hasDiscount && discountPercent && discountPercent > 0) {
            badgesEl.innerHTML = `<span class="badge badge--sale">-${discountPercent}%</span>`;
            hasAnyBadge = true;
        }
        
        // Show featured badge
        if (product.is_featured) {
            badgesEl.innerHTML += `<span class="badge badge--new">New</span>`;
            hasAnyBadge = true;
        }
        
        // Show/hide badges container
        if (hasAnyBadge) {
            badgesEl.style.display = 'flex';
        } else {
            badgesEl.style.display = 'none';
        }
    }
    
    // Update description with proper formatting
    const descEl = document.querySelector('.product-info__desc');
    if (descEl) {
        if (product.description) {
            // Format description with line breaks
            descEl.textContent = product.description;
            // Preserve line breaks from \n
            descEl.style.whiteSpace = 'pre-line';
        } else {
            descEl.style.display = 'none';
        }
    }
    
    // Hide rating section
    const ratingEl = document.querySelector('.product-info__rating');
    if (ratingEl) {
        ratingEl.style.display = 'none';
    }
    
    // Update stock status
    const stockEl = document.querySelector('.product-info__stock');
    if (stockEl) {
        if (product.in_stock) {
            stockEl.classList.add('in-stock');
            stockEl.classList.remove('out-of-stock');
            stockEl.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
                <span>В наявності</span>
            `;
        } else {
            stockEl.classList.add('out-of-stock');
            stockEl.classList.remove('in-stock');
            stockEl.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
                <span>Немає в наявності</span>
            `;
        }
    }
    
    // Update SKU if available
    const volumeEl = document.querySelector('.product-info__volume');
    if (volumeEl && product.sku) {
        volumeEl.innerHTML = `<span>Артикул: ${product.sku}</span>`;
    } else if (volumeEl) {
        volumeEl.style.display = 'none';
    }
    
    // Update favorite state
    if (elements.favoriteBtn) {
        elements.favoriteBtn.classList.toggle('is-active', favorites.has(product.id));
    }
    
    // Store product data for cart
    window.currentProduct = product;
}

let productImages = [];

function renderGallery(images) {
    if (!elements.galleryTrack || !images || images.length === 0) return;
    
    productImages = images;
    
    // Render slides
    elements.galleryTrack.innerHTML = images.map((img, i) => `
        <div class="product-gallery__slide" data-image-index="${i}">
            <img src="${img.url || img}" alt="${img.alt || product.name || 'Product image'}" class="product-gallery__img" loading="${i === 0 ? 'eager' : 'lazy'}">
        </div>
    `).join('');
    
    // Reset slide position
    currentSlide = 0;
    if (elements.galleryTrack) {
        elements.galleryTrack.style.transform = 'translateX(0)';
    }
    
    // Add click handlers to slides for modal
    elements.galleryTrack.querySelectorAll('.product-gallery__slide').forEach(slide => {
        slide.addEventListener('click', () => {
            const index = parseInt(slide.dataset.imageIndex);
            openImageModal(index);
        });
    });
    
    // Render dots (only if more than 1 image)
    if (elements.galleryDots) {
        if (images.length > 1) {
            elements.galleryDots.innerHTML = images.map((_, i) => `
                <button class="product-gallery__dot ${i === 0 ? 'is-active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>
            `).join('');
            
            // Dot click handlers
            elements.galleryDots.querySelectorAll('.product-gallery__dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    goToSlide(parseInt(dot.dataset.index));
                });
            });
        } else {
            elements.galleryDots.innerHTML = '';
        }
    }
    
    // Render thumbnails (only if more than 1 image)
    if (elements.galleryThumbs) {
        if (images.length > 1) {
            elements.galleryThumbs.innerHTML = images.map((img, i) => `
                <button class="product-gallery__thumb ${i === 0 ? 'is-active' : ''}" data-index="${i}" aria-label="View image ${i + 1}">
                    <img src="${img.url || img}" alt="Thumbnail ${i + 1}" loading="lazy">
                </button>
            `).join('');
            
            // Thumb click handlers
            elements.galleryThumbs.querySelectorAll('.product-gallery__thumb').forEach(thumb => {
                thumb.addEventListener('click', () => {
                    goToSlide(parseInt(thumb.dataset.index));
                });
            });
        } else {
            elements.galleryThumbs.innerHTML = '';
        }
    }
}

// === Gallery Swipe ===
function initGallery() {
    if (!elements.galleryTrack) return;
    
    const gallery = elements.galleryTrack.parentElement;
    
    // Touch events
    gallery.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    gallery.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const diff = touchStartX - touchEndX;
    const threshold = 50;
    
    const slides = elements.galleryTrack.querySelectorAll('.product-gallery__slide');
    const maxSlide = slides.length - 1;
    
    if (diff > threshold && currentSlide < maxSlide) {
        goToSlide(currentSlide + 1);
    } else if (diff < -threshold && currentSlide > 0) {
        goToSlide(currentSlide - 1);
    }
}

function goToSlide(index) {
    currentSlide = index;
    
    // Move track
    if (elements.galleryTrack) {
        elements.galleryTrack.style.transform = `translateX(-${index * 100}%)`;
    }
    
    // Update dots
    if (elements.galleryDots) {
        elements.galleryDots.querySelectorAll('.product-gallery__dot').forEach((dot, i) => {
            dot.classList.toggle('is-active', i === index);
        });
    }
    
    // Update thumbs
    if (elements.galleryThumbs) {
        elements.galleryThumbs.querySelectorAll('.product-gallery__thumb').forEach((thumb, i) => {
            thumb.classList.toggle('is-active', i === index);
        });
    }
}

// === Quantity ===
function initQuantity() {
    if (!elements.qtySelector) return;
    
    elements.qtySelector.querySelectorAll('.qty-selector__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            
            if (action === 'increase') {
                quantity++;
            } else if (action === 'decrease' && quantity > 1) {
                quantity--;
            }
            
            updateQuantityDisplay();
        });
    });
}

function updateQuantityDisplay() {
    if (elements.qtyValue) {
        elements.qtyValue.textContent = quantity;
    }
    
    // Disable decrease at 1
    const decreaseBtn = elements.qtySelector?.querySelector('[data-action="decrease"]');
    if (decreaseBtn) {
        decreaseBtn.disabled = quantity <= 1;
    }
}

function showCheckoutButton() {
    // Show main checkout wrapper
    const checkoutWrapper = document.getElementById('checkout-wrapper');
    if (checkoutWrapper) {
        checkoutWrapper.style.display = 'block';
        // Add animation
        checkoutWrapper.style.opacity = '0';
        checkoutWrapper.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            checkoutWrapper.style.transition = 'all 0.3s ease';
            checkoutWrapper.style.opacity = '1';
            checkoutWrapper.style.transform = 'translateY(0)';
        }, 10);
    }
    
    // Show sticky checkout wrapper if exists
    const stickyCheckoutWrapper = document.getElementById('sticky-checkout-wrapper');
    if (stickyCheckoutWrapper) {
        stickyCheckoutWrapper.style.display = 'flex';
        stickyCheckoutWrapper.classList.add('is-visible');
    }
}

// === Add to Cart ===
function initAddToCart() {
    const handleAddToCart = () => {
        if (!product) {
            showToast('Помилка: товар не завантажено', 'error');
            return;
        }
        
        // Check if product is in stock
        if (!product.in_stock) {
            showToast('Товар недоступний', 'error');
            return;
        }
        
        const productData = {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.final_price || product.price,
            old_price: product.old_price,
            final_price: product.final_price || product.price,
            primary_image: product.primary_image || (product.images && product.images[0]?.url) || null,
            category_name: product.category_name,
            sku: product.sku,
        };
        
        cart.add(productData, quantity);
        
        showToast(`Додано в кошик: ${quantity} шт.`, 'success');
        animateCartIcon();
        updateCartCount();
        
        // Show checkout button
        showCheckoutButton();
        
        // Button feedback
        const btn = elements.addToCartBtn || elements.stickyAddBtn;
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Додано ✓';
            btn.disabled = true;
            btn.classList.add('btn--success');
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.classList.remove('btn--success');
            }, 2000);
        }
    };
    
    elements.addToCartBtn?.addEventListener('click', handleAddToCart);
    elements.stickyAddBtn?.addEventListener('click', handleAddToCart);
}

// === Favorite ===
function initFavorite() {
    if (!elements.favoriteBtn) return;
    
    elements.favoriteBtn.addEventListener('click', () => {
        if (!product) return;
        
        const productData = {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.final_price || product.price,
            primary_image: product.primary_image || (product.images && product.images[0]?.url) || null,
        };
        
        const isNowFavorite = favorites.toggle(productData);
        elements.favoriteBtn.classList.toggle('is-active', isNowFavorite);
        
        animatePulse(elements.favoriteBtn);
        showToast(isNowFavorite ? 'Додано в обране' : 'Видалено з обраного');
    });
}

// === Sticky Bar ===
function initStickyBar() {
    if (!elements.stickyCta) return;
    
    const productInfo = document.querySelector('.product-info__actions');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Show sticky when actions are not visible
            elements.stickyCta.classList.toggle('is-visible', !entry.isIntersecting);
        });
    }, {
        threshold: 0,
        rootMargin: '-100px 0px 0px 0px'
    });
    
    if (productInfo) {
        observer.observe(productInfo);
    } else {
        // No desktop actions, show sticky after scroll
        window.addEventListener('scroll', () => {
            elements.stickyCta.classList.toggle('is-visible', window.scrollY > 400);
        }, { passive: true });
    }
}

// === Related Products ===
async function loadRelatedProducts() {
    if (!elements.relatedProducts || !product) return;
    
    try {
        let related = [];
        
        // Алгоритм для "Вам також може сподобатися":
        // 1. Сначала пытаемся загрузить товары из той же категории
        if (product.category_name) {
            const categoryData = await api.getProducts({ 
                category: product.category_name, 
                page_size: 12 
            });
            related = categoryData.items.filter(p => p.id !== product.id);
        }
        
        // 2. Если недостаточно товаров из категории, добавляем featured товары
        if (related.length < 6) {
            const allData = await api.getProducts({ 
                page_size: 20,
                sort: 'newest'
            });
            
            // Фильтруем: убираем текущий товар и уже добавленные
            const available = allData.items.filter(
                p => p.id !== product.id && !related.find(r => r.id === p.id)
            );
            
            // Приоритет: featured товары, затем остальные
            const featured = available.filter(p => p.is_featured);
            const others = available.filter(p => !p.is_featured);
            
            // Добавляем featured, затем остальные
            related = [...related, ...featured, ...others];
        }
        
        // Берем первые 6 товаров и немного перемешиваем для разнообразия
        related = related.slice(0, 8);
        // Легкое перемешивание (не полное, чтобы сохранить приоритет)
        for (let i = related.length - 1; i > 0; i--) {
            if (Math.random() > 0.7) { // Только 30% шанс поменять местами
                const j = Math.floor(Math.random() * (i + 1));
                [related[i], related[j]] = [related[j], related[i]];
            }
        }
        related = related.slice(0, 6);
        
        if (related.length > 0) {
            renderRelatedProducts(related);
        } else {
            // Скрываем секцию если нет похожих товаров
            const section = elements.relatedProducts.closest('.product-section');
            if (section) section.style.display = 'none';
        }
    } catch (e) {
        console.error('Failed to load related products:', e);
        // Скрываем секцию при ошибке
        const section = elements.relatedProducts?.closest('.product-section');
        if (section) section.style.display = 'none';
    }
}

function renderRelatedProducts(products) {
    const grid = elements.relatedProducts.querySelector('.products-grid');
    if (!grid || products.length === 0) return;
    
    // Use EXACT same rendering logic as in catalog.js
    grid.innerHTML = products.map(product => {
        const isFavorite = favorites.has(product.id);
        // Определяем цены
        const basePrice = parseFloat(product.price);
        const finalPrice = parseFloat(product.final_price || product.price);
        
        // Проверяем old_price - может быть null, undefined, строкой или числом
        let oldPrice = null;
        if (product.old_price !== null && product.old_price !== undefined && product.old_price !== '') {
            const parsed = parseFloat(product.old_price);
            if (!isNaN(parsed) && parsed > 0) {
                oldPrice = parsed;
            }
        }
        
        // Определяем, есть ли скидка и какие цены показывать
        // Вариант 1: есть old_price (прямая скидка на товаре)
        const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
        // Вариант 2: есть промоакция (final_price < price)
        const hasPromoDiscount = finalPrice < basePrice && product.discount_percent;
        
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
        
        const discountPercent = product.discount_percent || 
            (hasDirectDiscount && oldPrice ? Math.round((1 - basePrice / oldPrice) * 100) : null);
        
        const badges = [];
        if (discountPercent) {
            badges.push(`<span class="badge badge--sale">-${discountPercent}%</span>`);
        }
        if (product.is_featured) {
            badges.push(`<span class="badge badge--new">New</span>`);
        }
        
        const stockStatus = product.in_stock 
            ? '<span class="product-stock product-stock--in">✓ В наявності</span>'
            : '<span class="product-stock product-stock--out">Немає в наявності</span>';
        
        return `
            <article class="product-card" data-product-id="${product.id}" data-product-slug="${product.slug}">
                <a href="/pages/product?slug=${product.slug}" class="product-card__image">
                    ${badges.length ? `<div class="product-card__badges">${badges.join('')}</div>` : ''}
                    
                    <button class="product-card__favorite ${isFavorite ? 'is-active' : ''}" 
                            aria-label="В обране"
                            data-action="toggle-favorite"
                            onclick="event.preventDefault(); event.stopPropagation();">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                    </button>
                    
                    ${product.primary_image 
                        ? `<img class="product-card__img" src="${product.primary_image}" alt="${product.name}" loading="lazy">`
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
                                ${!product.in_stock ? 'disabled' : ''}
                                onclick="event.preventDefault(); event.stopPropagation();">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; margin-right: 6px;">
                                <path d="M9 2L7 6m0 0L3 7l4 1m0 0l2 10 6-2-2-10M7 7h14l-1 7H8"/>
                            </svg>
                            ${product.in_stock ? 'До кошика' : 'Немає в наявності'}
                        </button>
                    </div>
                </a>
                
                <div class="product-card__body">
                    ${product.brand ? `<span class="product-card__brand">${product.brand}</span>` : ''}
                    <h3 class="product-card__name">
                        <a href="/pages/product?slug=${product.slug}">${product.name}</a>
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
    }).join('');
    
    // Use the same handlers as in catalog
    initCardHandlersForGrid(grid);
}

function initCardHandlersForGrid(grid) {
    // Favorite toggle
    grid.querySelectorAll('[data-action="toggle-favorite"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            const productId = parseInt(card?.dataset.productId);
            const productSlug = card?.dataset.productSlug;
            if (!productId) return;
            
            const isNowFavorite = favorites.toggle({
                id: productId,
                slug: productSlug,
                name: card.querySelector('.product-card__name')?.textContent || '',
                price: parseFloat(card.querySelector('.product-card__price-current')?.textContent?.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
                primary_image: card.querySelector('.product-card__img')?.src || null,
            });
            
            btn.classList.toggle('is-active', isNowFavorite);
            animatePulse(btn);
            showToast(isNowFavorite ? 'Додано в обране' : 'Видалено з обраного', 'default', 2000);
        });
    });
    
    // Add to cart
    grid.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            const productId = parseInt(card?.dataset.productId);
            const productSlug = card?.dataset.productSlug;
            if (!productId) return;
            
            const product = {
                id: productId,
                slug: productSlug,
                name: card.querySelector('.product-card__name')?.textContent || '',
                price: parseFloat(card.querySelector('.product-card__price-current')?.textContent?.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
                primary_image: card.querySelector('.product-card__img')?.src || null,
            };
            
            cart.add(product);
            
            // Feedback
            const originalText = btn.textContent;
            btn.textContent = 'Додано ✓';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1500);
            
            showToast('Товар додано в кошик', 'success');
            animateCartIcon();
        });
    });
    
    // Card click -> product page
    grid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            
            const slug = card.dataset.productSlug;
            if (slug) {
                window.location.href = `/pages/product?slug=${slug}`;
            }
        });
        
        card.style.cursor = 'pointer';
    });
}

// === Image Modal ===
let modalCurrentImage = 0;

function initImageModal() {
    if (!elements.imageModal) return;
    
    // Close modal
    elements.imageModalClose?.addEventListener('click', closeImageModal);
    elements.imageModal?.addEventListener('click', (e) => {
        if (e.target === elements.imageModal) {
            closeImageModal();
        }
    });
    
    // Navigation
    elements.imageModalPrev?.addEventListener('click', () => {
        if (productImages.length > 0) {
            modalCurrentImage = (modalCurrentImage - 1 + productImages.length) % productImages.length;
            updateModalImage();
        }
    });
    
    elements.imageModalNext?.addEventListener('click', () => {
        if (productImages.length > 0) {
            modalCurrentImage = (modalCurrentImage + 1) % productImages.length;
            updateModalImage();
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!elements.imageModal?.classList.contains('is-open')) return;
        
        if (e.key === 'Escape') {
            closeImageModal();
        } else if (e.key === 'ArrowLeft') {
            elements.imageModalPrev?.click();
        } else if (e.key === 'ArrowRight') {
            elements.imageModalNext?.click();
        }
    });
}

function openImageModal(index) {
    if (!elements.imageModal || !productImages || productImages.length === 0) return;
    
    modalCurrentImage = index;
    updateModalImage();
    elements.imageModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeImageModal() {
    if (!elements.imageModal) return;
    
    elements.imageModal.classList.remove('is-open');
    document.body.style.overflow = '';
}

function updateModalImage() {
    if (!elements.imageModalImg || !productImages || productImages.length === 0) return;
    
    const image = productImages[modalCurrentImage];
    if (image) {
        elements.imageModalImg.src = image.url || image;
        elements.imageModalImg.alt = image.alt || product.name || 'Product image';
    }
    
    // Update counter
    if (elements.imageModalCounter && productImages.length > 1) {
        elements.imageModalCounter.textContent = `${modalCurrentImage + 1} / ${productImages.length}`;
        elements.imageModalCounter.style.display = 'block';
    } else if (elements.imageModalCounter) {
        elements.imageModalCounter.style.display = 'none';
    }
    
    // Show/hide navigation buttons
    if (elements.imageModalPrev && elements.imageModalNext) {
        if (productImages.length > 1) {
            elements.imageModalPrev.style.display = 'flex';
            elements.imageModalNext.style.display = 'flex';
        } else {
            elements.imageModalPrev.style.display = 'none';
            elements.imageModalNext.style.display = 'none';
        }
    }
}

// === Start ===
document.addEventListener('DOMContentLoaded', init);

