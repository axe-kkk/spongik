/**
 * Cart Page Module
 */

import { cart, on } from './state.js';
import { formatPrice, showToast, animatePulse } from './ui.js';
import api from './api.js';

// === DOM Elements ===
const elements = {
    cartContent: document.getElementById('cart-content'),
    cartItems: document.getElementById('cart-items'),
    cartEmpty: document.getElementById('cart-empty'),
    cartSummary: document.getElementById('cart-summary'),
    summaryPositionsCount: document.getElementById('summary-positions-count'),
    summaryItemsList: document.getElementById('summary-items-list'),
    summaryItemsCount: document.getElementById('summary-items-count'),
    summarySubtotal: document.getElementById('summary-subtotal'),
    summaryOriginalPriceRow: document.getElementById('summary-original-price-row'),
    summaryOriginalPrice: document.getElementById('summary-original-price'),
    summaryDiscountRow: document.getElementById('summary-discount-row'),
    summaryDiscount: document.getElementById('summary-discount'),
    summaryTotal: document.getElementById('summary-total'),
    checkoutBtn: document.getElementById('checkout-btn'),
};

// === Init ===
let isUpdatingQty = false;

async function init() {
    // Обновляем данные для существующих товаров в корзине (если они были добавлены до обновления логики)
    await updateCartItemsData();
    
    // Рендерим корзину после обновления данных
    renderCart();
    
    on('cart:updated', () => {
        // Only re-render if not updating quantity (e.g., when item is added or removed)
        if (!isUpdatingQty) {
            renderCart();
        }
    });
}

// Обновление данных для товаров в корзине (если они были добавлены до обновления логики)
async function updateCartItemsData() {
    const items = cart.getAll();
    if (items.length === 0) return;
    
    let needsUpdate = false;
    
    for (const item of items) {
        // Всегда обновляем данные из API для актуальности
        // Особенно важно, если:
        // 1. Нет base_price или slug
        // 2. old_price и discount_percent равны null (возможно, данные неполные)
        // 3. base_price === price (нет скидки, но возможно должна быть)
        // 4. Нет изображения
        const shouldUpdate = !item.base_price || 
                            !item.slug ||
                            !item.image ||
                            (item.old_price === null && item.discount_percent === null);
        
        if (shouldUpdate) {
            try {
                // Пробуем получить товар по slug
                const productSlug = item.slug;
                if (!productSlug) {
                    continue;
                }
                
                const product = await api.getProduct(productSlug);
                
                if (product) {
                    const basePrice = parseFloat(product.price) || 0;
                    const finalPrice = parseFloat(product.final_price || product.price) || 0;
                    
                    // Обновляем данные только если они изменились или отсутствовали
                    const dataChanged = item.base_price !== basePrice ||
                                      item.price !== finalPrice ||
                                      item.old_price !== (product.old_price || null) ||
                                      item.discount_percent !== (product.discount_percent || null);
                    
                    if (dataChanged || !item.base_price) {
                        item.base_price = basePrice;
                        item.price = finalPrice;
                        item.old_price = product.old_price || null;
                        item.discount_percent = product.discount_percent || null;
                        item.is_featured = product.is_featured || false;
                        if (!item.slug) item.slug = product.slug;
                        // Обновляем изображение, если оно отсутствует или изменилось
                        if (product.primary_image && (!item.image || item.image !== product.primary_image)) {
                            item.image = product.primary_image;
                        }
                        
                        needsUpdate = true;
                    } else {
                        // Даже если данные не изменились, обновляем изображение если оно отсутствует
                        if (product.primary_image && !item.image) {
                            item.image = product.primary_image;
                            needsUpdate = true;
                        }
                    }
                }
            } catch (error) {
                console.error(`Failed to update cart item ${item.id}:`, error);
            }
        } else {
        }
    }
    
    if (needsUpdate) {
        cart.save();
        // Эмитим событие для перерисовки корзины
        // renderCart() будет вызван в init() после этой функции
    } else {
    }
}

// === Render Cart ===
function renderCart() {
    const items = cart.getAll();
    
    if (items.length === 0) {
        showEmptyCart();
        return;
    }
    
    showCartContent();
    renderItems(items);
    updateSummary();
}

function showEmptyCart() {
    if (elements.cartContent) elements.cartContent.style.display = 'none';
    if (elements.cartEmpty) elements.cartEmpty.style.display = 'block';
}

function showCartContent() {
    if (elements.cartContent) elements.cartContent.style.display = 'grid';
    if (elements.cartEmpty) elements.cartEmpty.style.display = 'none';
}

function renderItems(items) {
    if (!elements.cartItems) return;
    
    elements.cartItems.innerHTML = items.map(item => {
        // Определяем цены (ТОЧНО КАК В КАТАЛОГЕ)
        // В корзине: item.base_price - базовая цена, item.price - финальная цена
        // Если base_price нет (старые товары), используем price как basePrice
        const basePrice = parseFloat(item.base_price) || parseFloat(item.price) || 0;
        const finalPrice = parseFloat(item.price) || 0;
        
        // Проверяем old_price - может быть null, undefined, строкой или числом
        let oldPrice = null;
        if (item.old_price !== null && item.old_price !== undefined && item.old_price !== '') {
            const parsed = parseFloat(item.old_price);
            if (!isNaN(parsed) && parsed > 0) {
                oldPrice = parsed;
            }
        }
        
        // Определяем, есть ли скидка и какие цены показывать (ТОЧНО КАК В КАТАЛОГЕ)
        // Вариант 1: есть old_price (прямая скидка на товаре)
        const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
        // Вариант 2: есть промоакция (final_price < basePrice)
        const hasPromoDiscount = finalPrice < basePrice && basePrice > 0;
        
        const hasDiscount = hasDirectDiscount || hasPromoDiscount;
        
        // Определяем старую и новую цены для отображения
        let displayOldPrice = null;
        let displayNewPrice = finalPrice;
        
        if (hasDirectDiscount) {
            // Если есть old_price, показываем old_price (старая) и basePrice (новая)
            displayOldPrice = oldPrice;
            displayNewPrice = basePrice;
        } else if (hasPromoDiscount) {
            // Если есть промоакция, показываем basePrice (старая) и finalPrice (новая)
            displayOldPrice = basePrice;
            displayNewPrice = finalPrice;
        }
        
        // Определяем процент скидки (ТОЧНО КАК В КАТАЛОГЕ)
        let discountPercent = item.discount_percent || null;
        if (!discountPercent || discountPercent === 0) {
            if (hasDirectDiscount && oldPrice) {
                discountPercent = Math.round((1 - basePrice / oldPrice) * 100);
            } else if (hasPromoDiscount && basePrice > 0) {
                discountPercent = Math.round((1 - finalPrice / basePrice) * 100);
            }
        }
        
        // Рассчитываем итоговые цены с учетом количества
        const totalPrice = displayNewPrice * item.qty;
        const totalOldPrice = displayOldPrice ? displayOldPrice * item.qty : null;
        
        // Формируем бейджи (ТОЧНО КАК В КАТАЛОГЕ)
        const badges = [];
        if (discountPercent && discountPercent > 0) {
            badges.push(`<span class="badge badge--sale">-${discountPercent}%</span>`);
        }
        if (item.is_featured) {
            badges.push(`<span class="badge badge--new">New</span>`);
        }
        
        return `
        <article class="cart-item" 
                 data-item-id="${item.id}"
                 data-item-price="${finalPrice}"
                 data-item-base-price="${basePrice}"
                 data-item-old-price="${oldPrice || ''}"
                 data-item-slug="${item.slug || ''}"
                 style="cursor: pointer;">
            <div class="cart-item__image" style="position: relative;">
                ${badges.length > 0 ? `<div class="product-card__badges" style="position: absolute; top: 8px; left: 8px; z-index: 2; display: flex; flex-direction: column; gap: 4px;">${badges.join('')}</div>` : ''}
                ${item.image 
                    ? `<img src="${item.image}" alt="${item.name}" class="cart-item__img">`
                    : `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, var(--color-pink-soft) 0%, var(--color-cream) 100%); display: flex; align-items: center; justify-content: center;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width: 48px; height: 48px; opacity: 0.3;">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="M21 15l-5-5L5 21"/>
                        </svg>
                    </div>`
                }
            </div>
            <div class="cart-item__content">
                <h3 class="cart-item__name">
                    <a href="/pages/product?slug=${item.slug}" style="text-decoration: none; color: inherit;">${item.name}</a>
                </h3>
                <div class="cart-item__price-wrapper" data-price-wrapper>
                    ${hasDiscount && displayOldPrice !== null
                        ? `<span class="cart-item__price-old" data-price-old>${formatPrice(totalOldPrice)}</span>
                           <span class="cart-item__price" data-price-current style="color: var(--color-pink);">${formatPrice(totalPrice)}</span>`
                        : `<span class="cart-item__price" data-price-current>${formatPrice(totalPrice)}</span>`
                    }
                </div>
                <div class="cart-item__actions">
                    <div class="cart-item__qty">
                        <button class="cart-item__qty-btn" data-action="decrease" ${item.qty <= 1 ? 'disabled' : ''} aria-label="Зменшити кількість">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M5 12h14"/>
                            </svg>
                        </button>
                        <span class="cart-item__qty-value" data-qty-value>${item.qty}</span>
                        <button class="cart-item__qty-btn" data-action="increase" aria-label="Збільшити кількість">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                        </button>
                    </div>
                    <button class="cart-item__remove" data-action="remove" aria-label="Видалити товар">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        </article>
        `;
    }).join('');
    
    initItemHandlers();
}

function initItemHandlers() {
    elements.cartItems.querySelectorAll('.cart-item').forEach(item => {
        const id = parseInt(item.dataset.itemId);
        const itemPrice = parseFloat(item.dataset.itemPrice) || 0;
        const itemOldPrice = item.dataset.itemOldPrice ? parseFloat(item.dataset.itemOldPrice) : null;
        const slug = item.dataset.itemSlug;
        
        // Card click -> product page (except buttons)
        item.addEventListener('click', (e) => {
            // Don't navigate if clicking on buttons or links
            if (e.target.closest('button') || e.target.closest('a')) {
                return;
            }
            
            if (slug) {
                window.location.href = `/pages/product?slug=${slug}`;
            }
        });
        
        // Quantity buttons
        item.querySelectorAll('.cart-item__qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                
                const action = btn.dataset.action;
                const currentItem = cart.find(id);
                if (!currentItem) return;
                
                let newQty;
                if (action === 'increase') {
                    newQty = currentItem.qty + 1;
                } else if (action === 'decrease') {
                    newQty = currentItem.qty - 1;
                    if (newQty <= 0) return;
                } else {
                    return;
                }
                
                // Set flag to prevent full re-render
                isUpdatingQty = true;
                
                // Update cart
                cart.updateQty(id, newQty);
                
                // Update UI without re-rendering
                updateItemUI(item, newQty);
                
                // Reset flag after a short delay
                setTimeout(() => {
                    isUpdatingQty = false;
                }, 100);
            });
        });
        
        // Remove button
        item.querySelector('[data-action="remove"]')?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            
            // Animate out
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            item.style.transition = 'all 0.3s ease-out';
            
            setTimeout(() => {
                cart.remove(id);
                showToast('Товар видалено');
            }, 300);
        });
    });
}

function updateItemUI(item, qty, itemPrice, itemOldPrice) {
    // Update quantity
    const qtyValue = item.querySelector('[data-qty-value]');
    if (qtyValue) {
        qtyValue.textContent = qty;
    }
    
    // Update decrease button disabled state
    const decreaseBtn = item.querySelector('[data-action="decrease"]');
    if (decreaseBtn) {
        decreaseBtn.disabled = qty <= 1;
    }
    
    // Get item data from cart
    const itemId = parseInt(item.dataset.itemId);
    const cartItem = cart.find(itemId);
    if (!cartItem) return;
    
    // Определяем цены (ТОЧНО КАК В КАТАЛОГЕ)
    const basePrice = parseFloat(cartItem.base_price || cartItem.price) || 0;
    const finalPrice = parseFloat(cartItem.price) || 0;
    
    // Проверяем old_price
    let oldPrice = null;
    if (cartItem.old_price !== null && cartItem.old_price !== undefined && cartItem.old_price !== '') {
        const parsed = parseFloat(cartItem.old_price);
        if (!isNaN(parsed) && parsed > 0) {
            oldPrice = parsed;
        }
    }
    
    // Определяем скидки (ТОЧНО КАК В КАТАЛОГЕ)
    const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
    const hasPromoDiscount = finalPrice < basePrice && cartItem.discount_percent;
    const hasDiscount = hasDirectDiscount || hasPromoDiscount;
    
    // Определяем старую и новую цены для отображения
    let displayOldPrice = null;
    let displayNewPrice = finalPrice;
    
    if (hasDirectDiscount) {
        displayOldPrice = oldPrice;
        displayNewPrice = basePrice;
    } else if (hasPromoDiscount) {
        displayOldPrice = basePrice;
        displayNewPrice = finalPrice;
    }
    
    // Рассчитываем итоговые цены с учетом количества
    const totalPrice = displayNewPrice * qty;
    const totalOldPrice = displayOldPrice ? displayOldPrice * qty : null;
    
    // Update prices
    const priceWrapper = item.querySelector('[data-price-wrapper]');
    if (priceWrapper) {
        if (hasDiscount && displayOldPrice !== null) {
            priceWrapper.innerHTML = `
                <span class="cart-item__price-old" data-price-old>${formatPrice(totalOldPrice)}</span>
                <span class="cart-item__price" data-price-current style="color: var(--color-pink);">${formatPrice(totalPrice)}</span>
            `;
        } else {
            priceWrapper.innerHTML = `
                <span class="cart-item__price" data-price-current>${formatPrice(totalPrice)}</span>
            `;
        }
    }
    
    // Update summary
    updateSummary();
}

function updateSummary() {
    const items = cart.getAll();
    const itemCount = cart.getCount();
    const positionsCount = items.length;
    const subtotal = cart.getTotal();
    
    // Подсчитываем общую экономию и оригинальную цену
    let totalSavings = 0;
    let totalOriginalPrice = 0;
    
    items.forEach(item => {
        const basePrice = parseFloat(item.base_price || item.price) || 0;
        const finalPrice = parseFloat(item.price) || 0;
        
        // Проверяем old_price
        let oldPrice = null;
        if (item.old_price !== null && item.old_price !== undefined && item.old_price !== '') {
            const parsed = parseFloat(item.old_price);
            if (!isNaN(parsed) && parsed > 0) {
                oldPrice = parsed;
            }
        }
        
        // Определяем скидки
        const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
        const hasPromoDiscount = finalPrice < basePrice;
        
        if (hasDirectDiscount) {
            // Экономия = (old_price - basePrice) * qty
            totalSavings += (oldPrice - basePrice) * item.qty;
            totalOriginalPrice += oldPrice * item.qty;
        } else if (hasPromoDiscount) {
            // Экономия = (basePrice - finalPrice) * qty
            totalSavings += (basePrice - finalPrice) * item.qty;
            totalOriginalPrice += basePrice * item.qty;
        } else {
            totalOriginalPrice += basePrice * item.qty;
        }
    });
    
    // Форматируем количество товаров
    let itemsText = '';
    if (itemCount === 0) {
        itemsText = '0 товарів';
    } else if (itemCount === 1) {
        itemsText = '1 товар';
    } else if (itemCount < 5) {
        itemsText = `${itemCount} товари`;
    } else {
        itemsText = `${itemCount} товарів`;
    }
    
    // Обновляем количество позиций
    if (elements.summaryPositionsCount) {
        let positionsText = '';
        if (positionsCount === 0) {
            positionsText = '0';
        } else if (positionsCount === 1) {
            positionsText = '1 позиція';
        } else if (positionsCount < 5) {
            positionsText = `${positionsCount} позиції`;
        } else {
            positionsText = `${positionsCount} позицій`;
        }
        elements.summaryPositionsCount.textContent = positionsText;
    }
    
    // Рендерим список товаров с ценами за единицу
    if (elements.summaryItemsList) {
        if (items.length === 0) {
            elements.summaryItemsList.innerHTML = '';
        } else {
            elements.summaryItemsList.innerHTML = items.map(item => {
                const basePrice = parseFloat(item.base_price || item.price) || 0;
                const finalPrice = parseFloat(item.price) || 0;
                
                // Проверяем old_price
                let oldPrice = null;
                if (item.old_price !== null && item.old_price !== undefined && item.old_price !== '') {
                    const parsed = parseFloat(item.old_price);
                    if (!isNaN(parsed) && parsed > 0) {
                        oldPrice = parsed;
                    }
                }
                
                // Определяем скидки
                const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
                const hasPromoDiscount = finalPrice < basePrice;
                
                // Определяем цену за единицу для отображения
                let displayPrice = finalPrice;
                let displayOldPrice = null;
                
                if (hasDirectDiscount) {
                    displayOldPrice = oldPrice;
                    displayPrice = basePrice;
                } else if (hasPromoDiscount) {
                    displayOldPrice = basePrice;
                    displayPrice = finalPrice;
                }
                
                return `
                    <div class="cart-summary__item">
                        <div class="cart-summary__item-name">${item.name}</div>
                        <div class="cart-summary__item-price">
                            ${displayOldPrice 
                                ? `<span class="cart-summary__item-price-old">${formatPrice(displayOldPrice)}</span>` 
                                : ''}
                            <span class="cart-summary__item-price-current">${formatPrice(displayPrice)}</span>
                            ${item.qty > 1 ? `<span class="cart-summary__item-qty"> × ${item.qty}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
    
    // Обновляем количество товаров
    if (elements.summaryItemsCount) {
        elements.summaryItemsCount.textContent = itemsText;
    }
    
    // Обновляем подытог
    if (elements.summarySubtotal) {
        elements.summarySubtotal.textContent = formatPrice(subtotal);
    }
    
    // Показываем/скрываем оригинальную цену (если есть скидки)
    if (elements.summaryOriginalPriceRow && elements.summaryOriginalPrice) {
        if (totalSavings > 0 && totalOriginalPrice > subtotal) {
            elements.summaryOriginalPriceRow.style.display = 'flex';
            elements.summaryOriginalPrice.textContent = formatPrice(totalOriginalPrice);
            elements.summaryOriginalPrice.style.textDecoration = 'line-through';
            elements.summaryOriginalPrice.style.color = 'var(--color-text-muted)';
        } else {
            elements.summaryOriginalPriceRow.style.display = 'none';
        }
    }
    
    // Показываем/скрываем экономию
    if (elements.summaryDiscountRow && elements.summaryDiscount) {
        if (totalSavings > 0) {
            elements.summaryDiscountRow.style.display = 'flex';
            elements.summaryDiscount.textContent = formatPrice(totalSavings);
            elements.summaryDiscount.style.color = 'var(--color-success)';
            elements.summaryDiscount.style.fontWeight = '600';
        } else {
            elements.summaryDiscountRow.style.display = 'none';
        }
    }
    
    // Обновляем итоговую сумму
    if (elements.summaryTotal) {
        elements.summaryTotal.textContent = formatPrice(Math.max(0, subtotal));
    }
    
    // Disable checkout if empty
    if (elements.checkoutBtn) {
        elements.checkoutBtn.classList.toggle('btn--disabled', cart.getCount() === 0);
    }
}

// === Start ===
document.addEventListener('DOMContentLoaded', init);

