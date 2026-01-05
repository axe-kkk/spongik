/**
 * UI Module
 * Рендеринг, анимации, форматирование
 */

import { cart, favorites, user, on } from './state.js';
import api from './api.js';

// === Price Formatting ===
function formatPrice(price, currency = '₴') {
    const num = parseFloat(price);
    if (isNaN(num)) return `0 ${currency}`;
    
    // Убираем копейки если целое число
    const formatted = num % 1 === 0 
        ? num.toLocaleString('uk-UA')
        : num.toLocaleString('uk-UA', { minimumFractionDigits: 2 });
    
    return `${formatted} ${currency}`;
}

// === Toast Notifications ===
let toastContainer = null;
let toastQueue = [];
let activeToast = null;

function ensureToastContainer() {
    if (toastContainer) return toastContainer;
    
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.innerHTML = `
        <div class="toast" id="toast">
            <span class="toast__message"></span>
        </div>
    `;
    document.body.appendChild(toastContainer);
    
    return toastContainer;
}

function showToast(message, type = 'default', duration = 3000) {
    ensureToastContainer();
    const toast = toastContainer.querySelector('.toast');
    const messageEl = toast.querySelector('.toast__message');
    
    // Если уже показан — добавляем в очередь
    if (activeToast) {
        toastQueue.push({ message, type, duration });
        return;
    }
    
    activeToast = true;
    messageEl.textContent = message;
    toast.className = 'toast';
    if (type !== 'default') {
        toast.classList.add(`toast--${type}`);
    }
    
    // Показываем
    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });
    
    // Скрываем
    setTimeout(() => {
        toast.classList.remove('is-visible');
        
        setTimeout(() => {
            activeToast = null;
            
            // Показываем следующий из очереди
            if (toastQueue.length > 0) {
                const next = toastQueue.shift();
                showToast(next.message, next.type, next.duration);
            }
        }, 300);
    }, duration);
}

// === Skeleton Loaders ===
export function createProductSkeleton() {
    return `
        <article class="product-card product-card--skeleton">
            <div class="product-card__image">
                <div class="skeleton skeleton--image"></div>
            </div>
            <div class="product-card__body">
                <div class="skeleton skeleton--text" style="width: 40%;"></div>
                <div class="skeleton skeleton--text"></div>
                <div class="skeleton skeleton--text" style="width: 70%;"></div>
                <div class="skeleton skeleton--text" style="width: 50%; margin-top: 8px;"></div>
                <div class="skeleton skeleton--btn" style="margin-top: 12px;"></div>
            </div>
        </article>
    `;
}

function showProductsLoading(container, count = 4) {
    container.innerHTML = Array(count).fill(createProductSkeleton()).join('');
}

// === Product Card Render ===
function renderProductCard(product) {
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
    
    return `
        <article class="product-card" 
                 data-product-id="${product.id}" 
                 data-product-slug="${product.slug}"
                 data-product-price="${basePrice}"
                 data-product-final-price="${finalPrice}"
                 data-product-old-price="${oldPrice || ''}"
                 data-product-discount-percent="${discountPercent || ''}"
                 data-product-is-featured="${product.is_featured ? 'true' : 'false'}">
            <div class="product-card__image">
                ${badges.length ? `<div class="product-card__badges">${badges.join('')}</div>` : ''}
                <button class="product-card__favorite ${isFavorite ? 'is-active' : ''}" 
                        aria-label="${isFavorite ? 'Убрать из избранного' : 'В избранное'}"
                        data-action="toggle-favorite">
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
            </div>
            <div class="product-card__body">
                ${product.brand ? `<span class="product-card__brand">${product.brand}</span>` : ''}
                <h3 class="product-card__name">${product.name}</h3>
                <div class="product-card__price">
                    ${hasDiscount && displayOldPrice !== null
                        ? `<span class="product-card__price-old">${formatPrice(displayOldPrice)}</span>
                           <span class="product-card__price-current product-card__price-sale">${formatPrice(displayNewPrice)}</span>`
                        : `<span class="product-card__price-current">${formatPrice(displayNewPrice)}</span>`
                    }
                </div>
                <div class="product-card__actions">
                    <button class="btn btn--secondary btn--full btn--sm" 
                            data-action="add-to-cart"
                            ${product.stock_qty <= 0 ? 'disabled' : ''}>
                        ${product.stock_qty <= 0 ? 'Нет в наличии' : 'В корзину'}
                    </button>
                </div>
            </div>
        </article>
    `;
}

function renderProductsGrid(products, container) {
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                    </svg>
                </div>
                <h3 class="empty-state__title">Товары не найдены</h3>
                <p class="empty-state__text">Попробуйте изменить параметры поиска</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(renderProductCard).join('');
    initProductCardHandlers(container);
}

// === Product Card Handlers ===
function initProductCardHandlers(container) {
    // Favorite toggle
    container.querySelectorAll('[data-action="toggle-favorite"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            const product = getProductFromCard(card);
            
            // Оптимистичное обновление
            const isNowFavorite = favorites.toggle(product);
            btn.classList.toggle('is-active', isNowFavorite);
            
            // Микроанимация
            animatePulse(btn);
            
            // Синхронизация с сервером для авторизованных пользователей
            if (user.isAuthenticated) {
                try {
                    if (isNowFavorite) {
                        await api.addFavorite(product.id);
                    } else {
                        await api.removeFavorite(product.id);
                    }
                } catch (error) {
                    // Откатываем изменение при ошибке
                    favorites.toggle(product);
                    btn.classList.toggle('is-active', !isNowFavorite);
                    console.error('Failed to sync favorite:', error);
                    showToast('Помилка синхронізації з сервером', 'error', 2000);
                    return;
                }
            }
            
            showToast(
                isNowFavorite ? 'Додано в обране' : 'Видалено з обраного',
                'default',
                2000
            );
        });
    });
    
    // Add to cart
    container.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            const product = getProductFromCard(card);
            
            // Оптимистичное обновление
            cart.add(product);
            
            // UI feedback
            const originalText = btn.textContent;
            btn.textContent = 'Добавлено ✓';
            btn.disabled = true;
            btn.classList.add('btn--success');
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.classList.remove('btn--success');
            }, 1500);
            
            showToast('Товар добавлен в корзину', 'success', 2500);
            
            // Анимация иконки корзины
            animateCartIcon();
        });
    });
    
    // Card click -> product page
    container.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Не переходить если клик по кнопке
            if (e.target.closest('button')) return;
            
            const slug = card.dataset.productSlug;
            if (slug) {
                window.location.href = `/pages/product?slug=${slug}`;
            }
        });
        
        card.style.cursor = 'pointer';
    });
}

function getProductFromCard(card) {
    // Читаем old_price - может быть пустой строкой
    let oldPrice = null;
    if (card.dataset.productOldPrice && card.dataset.productOldPrice !== '') {
        const parsed = parseFloat(card.dataset.productOldPrice);
        if (!isNaN(parsed) && parsed > 0) {
            oldPrice = parsed;
        }
    }
    
    // Читаем discount_percent - может быть пустой строкой
    let discountPercent = null;
    if (card.dataset.productDiscountPercent && card.dataset.productDiscountPercent !== '') {
        const parsed = parseInt(card.dataset.productDiscountPercent);
        if (!isNaN(parsed) && parsed > 0) {
            discountPercent = parsed;
        }
    }
    
    const isFeatured = card.dataset.productIsFeatured === 'true';
    const basePrice = parseFloat(card.dataset.productPrice || 0);
    const finalPrice = parseFloat(card.dataset.productFinalPrice || card.dataset.productPrice || 0);
    
    const product = {
        id: parseInt(card.dataset.productId),
        slug: card.dataset.productSlug,
        name: card.querySelector('.product-card__name')?.textContent || '',
        price: basePrice, // Базовая цена (product.price)
        final_price: finalPrice, // Финальная цена после скидок
        old_price: oldPrice,
        discount_percent: discountPercent,
        is_featured: isFeatured,
        primary_image: card.querySelector('.product-card__img')?.src || null,
    };
    
    // DEBUG: логируем данные, полученные из карточки
    console.log('Product from card:', product);
    
    return product;
}

// === Animations ===
function animatePulse(element) {
    element.style.transform = 'scale(1.2)';
    element.style.transition = 'transform 150ms ease-out';
    
    setTimeout(() => {
        element.style.transform = '';
    }, 150);
}

function animateCartIcon() {
    const cartBtn = document.querySelector('.cart-btn');
    if (!cartBtn) return;
    
    cartBtn.style.transform = 'scale(1.15)';
    cartBtn.style.transition = 'transform 200ms ease-out';
    
    setTimeout(() => {
        cartBtn.style.transform = '';
    }, 200);
}

export function animateShake(element) {
    element.style.animation = 'shake 400ms ease-out';
    element.addEventListener('animationend', () => {
        element.style.animation = '';
    }, { once: true });
}

// === Cart Count Update ===
function updateCartCount() {
    const countEl = document.getElementById('cart-count');
    if (!countEl) return;
    
    const count = cart.getCount();
    countEl.textContent = count;
    countEl.style.display = count > 0 ? 'flex' : 'none';
    
    if (count > 0) {
        animatePulse(countEl);
    }
}

// === Error Display ===
function showError(container, message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
        </svg>
        <span>${message}</span>
    `;
    
    // Удаляем предыдущую ошибку
    container.querySelector('.error-message')?.remove();
    container.prepend(errorEl);
    
    // Автоскрытие
    setTimeout(() => {
        errorEl.style.opacity = '0';
        setTimeout(() => errorEl.remove(), 300);
    }, 5000);
}

function showFieldError(input, message) {
    input.classList.add('input--error');
    
    let errorEl = input.parentElement.querySelector('.form-error');
    if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.className = 'form-error';
        input.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
    
    // Убираем при фокусе
    input.addEventListener('focus', () => {
        input.classList.remove('input--error');
        errorEl.remove();
    }, { once: true });
}

function clearFieldErrors(form) {
    form.querySelectorAll('.input--error').forEach(el => {
        el.classList.remove('input--error');
    });
    form.querySelectorAll('.form-error').forEach(el => el.remove());
}

// === Loading States ===
function setButtonLoading(btn, loading = true) {
    if (loading) {
        btn.dataset.originalText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = `
            <span class="btn-spinner"></span>
            <span>Загрузка...</span>
        `;
    } else {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Отправить';
    }
}

// === Init ===
function initUI() {
    // Подписываемся на изменения состояния
    on('cart:updated', updateCartCount);
    on('cart:item-added', () => animateCartIcon());
    
    // Начальное обновление
    updateCartCount();
}

// Add shake animation to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-4px); }
        40% { transform: translateX(4px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
    }
    
    .error-message {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        background: #FEE2E2;
        color: var(--color-error);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        margin-bottom: var(--space-4);
        animation: fadeIn 200ms ease-out;
        transition: opacity 300ms ease-out;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .btn-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 600ms linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .btn--success {
        background: var(--color-matcha) !important;
        border-color: var(--color-matcha) !important;
        color: var(--color-text) !important;
    }
    
    .toast-container {
        position: fixed;
        bottom: var(--space-6);
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        pointer-events: none;
    }
`;
document.head.appendChild(style);

export {
    formatPrice,
    showToast,
    showProductsLoading,
    renderProductCard,
    renderProductsGrid,
    initProductCardHandlers,
    updateCartCount,
    showError,
    showFieldError,
    clearFieldErrors,
    setButtonLoading,
    animatePulse,
    animateCartIcon,
    initUI,
};

