/**
 * Favorites Page Module
 */

import { favorites, cart, on } from './state.js';
import { formatPrice, showToast, initUI, animateCartIcon } from './ui.js';
import api from './api.js';

// === DOM Elements ===
const elements = {
    favoritesGrid: document.getElementById('favorites-grid'),
    favoritesEmpty: document.getElementById('favorites-empty'),
    favoritesCount: document.getElementById('favorites-count'),
};

// === Init ===
function init() {
    initUI();
    loadFavorites();
    
    // Обновляем при изменении избранного
    on('favorites:updated', () => {
        loadFavorites();
    });
}

// === Load Favorites ===
async function loadFavorites() {
    if (!elements.favoritesGrid) return;
    
    const favoriteItems = favorites.getAll();
    
    // Обновляем счетчик
    if (elements.favoritesCount) {
        const count = favoriteItems.length;
        let countText = '';
        if (count === 0) {
            countText = '0 товарів';
        } else if (count === 1) {
            countText = '1 товар';
        } else if (count < 5) {
            countText = `${count} товари`;
        } else {
            countText = `${count} товарів`;
        }
        elements.favoritesCount.textContent = countText;
    }
    
    if (favoriteItems.length === 0) {
        elements.favoritesGrid.innerHTML = '';
        if (elements.favoritesEmpty) {
            elements.favoritesEmpty.style.display = 'block';
        }
        return;
    }
    
    if (elements.favoritesEmpty) {
        elements.favoritesEmpty.style.display = 'none';
    }
    
    // Загружаем полные данные товаров из API
    try {
        const products = await Promise.all(
            favoriteItems.map(async (item) => {
                try {
                    const product = await api.getProduct(item.slug);
                    return product;
                } catch (error) {
                    console.error(`Failed to load product ${item.slug}:`, error);
                    // Возвращаем базовые данные из localStorage
                    return {
                        id: item.id,
                        name: item.name,
                        slug: item.slug,
                        price: item.price || 0,
                        final_price: item.price || 0,
                        old_price: null,
                        discount_percent: null,
                        is_featured: false,
                        in_stock: true,
                        primary_image: item.image || null,
                        brand: null,
                    };
                }
            })
        );
        
        // Рендерим карточки товаров (ТОЧНО КАК В КАТАЛОГЕ)
        renderProducts(products);
        
    } catch (error) {
        console.error('Failed to load favorites:', error);
        // Fallback: используем данные из localStorage
        const fallbackProducts = favoriteItems.map(item => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            price: item.price || 0,
            final_price: item.price || 0,
            old_price: null,
            discount_percent: null,
            is_featured: false,
            in_stock: true,
            primary_image: item.image || null,
            brand: null,
        }));
        renderProducts(fallbackProducts);
    }
}

// === Render Products (ТОЧНО КАК В КАТАЛОГЕ) ===
function renderProducts(products) {
    if (!products || products.length === 0) {
        if (elements.favoritesEmpty) {
            elements.favoritesEmpty.style.display = 'block';
        }
        elements.favoritesGrid.innerHTML = '';
        return;
    }
    
    if (elements.favoritesEmpty) {
        elements.favoritesEmpty.style.display = 'none';
    }
    
    elements.favoritesGrid.innerHTML = products.map(product => {
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
            <article class="product-card" 
                     data-product-id="${product.id}" 
                     data-product-slug="${product.slug}"
                     data-product-price="${basePrice}"
                     data-product-final-price="${finalPrice}"
                     data-product-old-price="${oldPrice || ''}"
                     data-product-discount-percent="${discountPercent || ''}"
                     data-product-is-featured="${product.is_featured ? 'true' : 'false'}">
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
    
    initCardHandlers();
}

// === Card Handlers (ТОЧНО КАК В КАТАЛОГЕ) ===
function initCardHandlers() {
    // Favorite toggle
    elements.favoritesGrid.querySelectorAll('[data-action="toggle-favorite"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            const productId = parseInt(card.dataset.productId);
            const slug = card.dataset.productSlug;
            
            // Получаем данные продукта
            const product = {
                id: productId,
                slug: slug,
                name: card.querySelector('.product-card__name')?.textContent || '',
                price: parseFloat(card.dataset.productPrice || 0),
                final_price: parseFloat(card.dataset.productFinalPrice || card.dataset.productPrice || 0),
                old_price: card.dataset.productOldPrice ? parseFloat(card.dataset.productOldPrice) : null,
                discount_percent: card.dataset.productDiscountPercent ? parseInt(card.dataset.productDiscountPercent) : null,
                is_featured: card.dataset.productIsFeatured === 'true',
                primary_image: card.querySelector('.product-card__img')?.src || null,
            };
            
            const isNowFavorite = favorites.toggle(product);
            btn.classList.toggle('is-active', isNowFavorite);
            
            showToast(
                isNowFavorite ? 'Додано в обране' : 'Видалено з обраного',
                'default',
                2000
            );
            
            // Если удалили из избранного, перезагружаем список
            if (!isNowFavorite) {
                loadFavorites();
            }
        });
    });
    
    // Add to cart
    elements.favoritesGrid.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            const productId = parseInt(card.dataset.productId);
            const slug = card.dataset.productSlug;
            
            try {
                // Загружаем полные данные продукта
                const product = await api.getProduct(slug);
                
                // Добавляем в корзину
                cart.add(product);
                
                // UI feedback
                const originalText = btn.textContent;
                btn.textContent = 'Додано ✓';
                btn.disabled = true;
                btn.classList.add('btn--success');
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                    btn.classList.remove('btn--success');
                }, 1500);
                
                showToast('Товар додано в кошик', 'success', 2500);
                
                // Анимация иконки корзины
                animateCartIcon();
            } catch (error) {
                console.error('Failed to add to cart:', error);
                showToast('Помилка при додаванні товару', 'error', 3000);
            }
        });
    });
    
    // Card click navigation
    elements.favoritesGrid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Не переходим, если кликнули на кнопку или ссылку
            if (e.target.closest('button') || e.target.closest('a')) {
                return;
            }
            
            const slug = card.dataset.productSlug;
            if (slug) {
                window.location.href = `/pages/product?slug=${slug}`;
            }
        });
        
        card.style.cursor = 'pointer';
    });
}

// === Start ===
document.addEventListener('DOMContentLoaded', init);

