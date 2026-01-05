/**
 * Account Page Module
 * Минимальный журнал — порядок и доверие
 */

import api from './api.js';
import { user, favorites, cart, on } from './state.js';
import { formatPrice, showToast, updateCartCount } from './ui.js';

// === Status Labels ===
const STATUS_LABELS = {
    pending: 'Очікує',
    confirmed: 'Підтверджено',
    processing: 'Обробляється',
    shipped: 'Відправлено',
    delivered: 'Доставлено',
    cancelled: 'Скасовано',
    refunded: 'Повернено',
};

// === DOM Elements ===
const elements = {
    userName: document.getElementById('user-name'),
    logoutBtn: document.getElementById('logout-btn'),
    ordersList: document.getElementById('orders-list'),
    ordersEmpty: document.getElementById('orders-empty'),
    ordersSection: document.getElementById('orders-section'),
    profileSection: document.getElementById('profile-section'),
    favoritesSection: document.getElementById('favorites-section'),
    favoritesGrid: document.getElementById('favorites-grid'),
    favoritesEmpty: document.getElementById('favorites-empty'),
    profileForm: document.getElementById('profile-form'),
    orderModal: document.getElementById('order-modal'),
    modalClose: document.getElementById('modal-close'),
    modalOrderNumber: document.getElementById('modal-order-number'),
    modalBody: document.getElementById('modal-body'),
};

// === Init ===
async function init() {
    // Check auth
    try {
        const userData = await api.getMe();
        user.set(userData);
        renderUserInfo();
    } catch (e) {
        // Redirect to login
        window.location.href = '/pages/login';
        return;
    }
    
    initTabs();
    initLogout();
    initModal();
    initProfileForm();
    
    await loadOrders();
    loadFavorites();
    
    updateCartCount();
    on('cart:updated', updateCartCount);
}

// === User Info ===
function renderUserInfo() {
    if (elements.userName && user.data) {
        elements.userName.textContent = user.data.first_name || 'Користувач';
    }
    
    // Fill profile form
    if (user.data) {
        const firstname = document.getElementById('profile-firstname');
        const lastname = document.getElementById('profile-lastname');
        const phone = document.getElementById('profile-phone');
        const email = document.getElementById('profile-email');
        
        if (firstname) firstname.value = user.data.first_name || '';
        if (lastname) lastname.value = user.data.last_name || '';
        if (phone) phone.value = user.data.phone || '';
        if (email) email.value = user.data.email || '';
    }
}

// === Tabs ===
function initTabs() {
    document.querySelectorAll('.account-nav__item').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            const tabId = tab.dataset.tab;
            
            // Update nav
            document.querySelectorAll('.account-nav__item').forEach(t => {
                t.classList.remove('is-active');
            });
            tab.classList.add('is-active');
            
            // Update sections
            elements.ordersSection.style.display = tabId === 'orders' ? 'block' : 'none';
            elements.profileSection.style.display = tabId === 'profile' ? 'block' : 'none';
            elements.favoritesSection.style.display = tabId === 'favorites' ? 'block' : 'none';
            
            // Update URL hash
            history.replaceState(null, '', `#${tabId}`);
        });
    });
    
    // Check initial hash
    const hash = window.location.hash.slice(1);
    if (hash) {
        const tab = document.querySelector(`[data-tab="${hash}"]`);
        if (tab) tab.click();
    }
}

// === Logout ===
function initLogout() {
    elements.logoutBtn?.addEventListener('click', async () => {
        try {
            await api.logout();
            user.clear();
            window.location.href = '/';
        } catch (e) {
            showToast('Помилка виходу', 'error');
        }
    });
}

// === Orders ===
async function loadOrders() {
    if (!elements.ordersList) return;
    
    // Show skeletons
    showOrdersLoading();
    
    try {
        const orders = await api.getMyOrders();
        
        if (orders.length === 0) {
            elements.ordersList.innerHTML = '';
            elements.ordersEmpty.style.display = 'block';
            return;
        }
        
        elements.ordersEmpty.style.display = 'none';
        renderOrders(orders);
    } catch (e) {
        console.error('Failed to load orders:', e);
        showToast('Не вдалося завантажити замовлення', 'error');
    }
}

function showOrdersLoading() {
    elements.ordersList.innerHTML = Array(3).fill(null).map(() => `
        <div class="order-card order-card--skeleton">
            <div class="order-card__header">
                <div>
                    <div class="skeleton skeleton--text" style="width: 120px;"></div>
                    <div class="skeleton skeleton--text" style="width: 80px; margin-top: 8px;"></div>
                </div>
                <div class="skeleton skeleton--badge"></div>
            </div>
            <div class="order-card__items">
                <div class="skeleton skeleton--img"></div>
                <div class="skeleton skeleton--img"></div>
            </div>
            <div class="order-card__footer">
                <div class="skeleton skeleton--text" style="width: 100px;"></div>
            </div>
        </div>
    `).join('');
}

function renderOrders(orders) {
    elements.ordersList.innerHTML = orders.map(order => {
        const itemsPreview = order.items?.slice(0, 3) || [];
        const moreCount = (order.items?.length || 0) - 3;
        
        return `
            <article class="order-card" data-order-id="${order.id}">
                <div class="order-card__header">
                    <div>
                        <div class="order-card__number">${order.order_number}</div>
                        <div class="order-card__date">${formatDate(order.created_at)}</div>
                    </div>
                    <span class="order-status order-status--${order.status}">
                        ${STATUS_LABELS[order.status] || order.status}
                    </span>
                </div>
                
                <div class="order-card__items">
                    ${itemsPreview.map(item => `
                        <div class="order-card__item-img">
                            ${item.product?.primary_image 
                                ? `<img src="${item.product.primary_image}" alt="${item.product_name}">`
                                : ''
                            }
                        </div>
                    `).join('')}
                    ${moreCount > 0 ? `
                        <div class="order-card__item-more">+${moreCount}</div>
                    ` : ''}
                </div>
                
                <div class="order-card__footer">
                    <div>
                        <span class="order-card__total-label">Сума</span>
                        <span class="order-card__total">${formatPrice(order.total)}</span>
                    </div>
                    <svg class="order-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </div>
            </article>
        `;
    }).join('');
    
    // Add click handlers
    elements.ordersList.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', () => {
            const orderId = card.dataset.orderId;
            openOrderModal(orderId);
        });
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// === Order Modal ===
function initModal() {
    elements.modalClose?.addEventListener('click', closeModal);
    elements.orderModal?.addEventListener('click', (e) => {
        if (e.target === elements.orderModal) closeModal();
    });
}

async function openOrderModal(orderId) {
    if (!elements.orderModal) return;
    
    elements.orderModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    
    try {
        const order = await api.getMyOrder(orderId);
        renderOrderDetail(order);
    } catch (e) {
        showToast('Не вдалося завантажити деталі', 'error');
        closeModal();
    }
}

function closeModal() {
    elements.orderModal?.classList.remove('is-open');
    document.body.style.overflow = '';
}

function renderOrderDetail(order) {
    elements.modalOrderNumber.textContent = order.order_number;
    
    elements.modalBody.innerHTML = `
        <div class="order-detail__status">
            <span class="order-status order-status--${order.status}">
                ${STATUS_LABELS[order.status] || order.status}
            </span>
        </div>
        
        <div class="order-detail__section">
            <div class="order-detail__section-title">Товари</div>
            <div class="order-detail__items">
                ${order.items.map(item => `
                    <div class="order-detail__item">
                        <div class="order-detail__item-img">
                            ${item.product?.primary_image 
                                ? `<img src="${item.product.primary_image}" alt="${item.product_name}">`
                                : ''
                            }
                        </div>
                        <div class="order-detail__item-info">
                            <div class="order-detail__item-name">${item.product_name}</div>
                            <div class="order-detail__item-meta">${item.quantity} × ${formatPrice(item.price)}</div>
                        </div>
                        <div class="order-detail__item-price">${formatPrice(item.total)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="order-detail__section">
            <div class="order-detail__section-title">Доставка</div>
            <div class="order-detail__info">
                <div class="order-detail__row">
                    <span>Отримувач</span>
                    <span>${order.customer_name}</span>
                </div>
                <div class="order-detail__row">
                    <span>Телефон</span>
                    <span>${order.customer_phone}</span>
                </div>
                ${order.delivery_city ? `
                    <div class="order-detail__row">
                        <span>Місто</span>
                        <span>${order.delivery_city}</span>
                    </div>
                ` : ''}
                ${order.delivery_warehouse ? `
                    <div class="order-detail__row">
                        <span>Відділення</span>
                        <span>${order.delivery_warehouse}</span>
                    </div>
                ` : ''}
                ${order.delivery_address ? `
                    <div class="order-detail__row">
                        <span>Адреса</span>
                        <span>${order.delivery_address}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="order-detail__total">
            <span>До сплати</span>
            <span class="order-detail__total-value">${formatPrice(order.total)}</span>
        </div>
    `;
}

// === Favorites ===
function loadFavorites() {
    if (!elements.favoritesGrid) return;
    
    const items = favorites.getAll();
    
    if (items.length === 0) {
        elements.favoritesGrid.innerHTML = '';
        elements.favoritesEmpty.style.display = 'block';
        return;
    }
    
    elements.favoritesEmpty.style.display = 'none';
    
    elements.favoritesGrid.innerHTML = items.map(item => `
        <article class="product-card" data-product-id="${item.id}" data-product-slug="${item.slug}">
            <div class="product-card__image">
                ${item.image 
                    ? `<img class="product-card__img" src="${item.image}" alt="${item.name}">`
                    : `<div class="product-card__placeholder"></div>`
                }
            </div>
            <div class="product-card__body">
                <h3 class="product-card__name">${item.name}</h3>
                <div class="product-card__price">
                    <span class="product-card__price-current">${formatPrice(item.price)}</span>
                </div>
            </div>
        </article>
    `).join('');
    
    // Click handlers
    elements.favoritesGrid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.dataset.productSlug;
            if (slug) window.location.href = `/pages/product?slug=${slug}`;
        });
        card.style.cursor = 'pointer';
    });
}

// === Profile Form ===
function initProfileForm() {
    elements.profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = elements.profileForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Збереження...';
        btn.disabled = true;
        
        try {
            await api.updateProfile({
                first_name: document.getElementById('profile-firstname')?.value,
                last_name: document.getElementById('profile-lastname')?.value,
                phone: document.getElementById('profile-phone')?.value,
                email: document.getElementById('profile-email')?.value,
            });
            
            showToast('Дані збережено', 'success');
        } catch (e) {
            showToast(e.message || 'Помилка збереження', 'error');
        }
        
        btn.textContent = originalText;
        btn.disabled = false;
    });
}

// === Start ===
document.addEventListener('DOMContentLoaded', init);

