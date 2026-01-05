/**
 * Order Success Page Module
 */

import { initUI } from './ui.js';
import api from './api.js';

// === Init Header ===
function initHeader() {
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
    
    // Header scroll
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 10);
        }, { passive: true });
    }
}

// === Init ===
async function init() {
    // Initialize header
    initHeader();
    
    // Initialize UI (cart count, etc.)
    initUI();
    
    // Get order number from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderNumber = urlParams.get('order');
    
    if (orderNumber) {
        // Load order details
        await loadOrderDetails(orderNumber);
    } else {
        // If no order number, redirect to home
        window.location.href = '/';
    }
}

// === Load Order Details ===
async function loadOrderDetails(orderNumber) {
    try {
        // Display order number
        const orderNumberEl = document.getElementById('order-number');
        if (orderNumberEl) {
            orderNumberEl.textContent = orderNumber;
        }
        
        // First, try to get order from sessionStorage (saved before redirect)
        const savedOrder = sessionStorage.getItem('lastOrder');
        if (savedOrder) {
            try {
                const order = JSON.parse(savedOrder);
                if (order.order_number === orderNumber) {
                    renderOrderDetails(order);
                    // Clear sessionStorage after displaying
                    sessionStorage.removeItem('lastOrder');
                    return;
                }
            } catch (e) {
            }
        }
        
        // Try to get order details from API (if user is logged in)
        try {
            const orders = await api.getMyOrders();
            const order = orders.find(o => o.order_number === orderNumber);
            
            if (order) {
                renderOrderDetails(order);
            } else {
                // If order not found, show basic info
                showBasicInfo();
            }
        } catch (error) {
            // If not logged in or order not found, show basic info
            showBasicInfo();
        }
    } catch (error) {
        console.error('Failed to load order details:', error);
        showBasicInfo();
    }
}

// === Render Order Details ===
function renderOrderDetails(order) {
    const detailsEl = document.getElementById('order-details');
    if (!detailsEl) return;
    
    const itemsHtml = order.items.map(item => `
        <div class="order-success__item">
            <div class="order-success__item-name">${item.product_name}</div>
            <div class="order-success__item-info">
                <span class="order-success__item-qty">${item.quantity} шт.</span>
                <span class="order-success__item-price">${formatPrice(item.total)}</span>
            </div>
        </div>
    `).join('');
    
    detailsEl.innerHTML = `
        <div class="order-success__section">
            <h3 class="order-success__section-title">Деталі замовлення</h3>
            <div class="order-success__items">
                ${itemsHtml}
            </div>
        </div>
        
        <div class="order-success__section">
            <div class="order-success__summary-row">
                <span>Товари:</span>
                <span>${formatPrice(order.subtotal)}</span>
            </div>
            ${order.discount > 0 ? `
                <div class="order-success__summary-row">
                    <span>Знижка:</span>
                    <span>-${formatPrice(order.discount)}</span>
                </div>
            ` : ''}
            ${(() => {
                const FREE_DELIVERY_THRESHOLD = 1000;
                const isFreeDelivery = order.subtotal >= FREE_DELIVERY_THRESHOLD;
                
                if (order.delivery_cost > 0) {
                    return `
                        <div class="order-success__summary-row">
                            <span>Доставка:</span>
                            <span>${formatPrice(order.delivery_cost)}</span>
                        </div>
                    `;
                } else if (isFreeDelivery) {
                    return `
                        <div class="order-success__summary-row">
                            <span>Доставка:</span>
                            <span>Безкоштовно</span>
                        </div>
                    `;
                } else {
                    return `
                        <div class="order-success__summary-row">
                            <span>Доставка:</span>
                            <span>За тарифами перевізника</span>
                        </div>
                    `;
                }
            })()}
            <div class="order-success__summary-row order-success__summary-row--total">
                <span>До сплати:</span>
                <span>${formatPrice(order.total)}</span>
            </div>
        </div>
        
        ${order.delivery_city || order.delivery_warehouse ? `
            <div class="order-success__section">
                <h3 class="order-success__section-title">Доставка</h3>
                <div class="order-success__delivery-info">
                    ${order.delivery_city ? `<p><strong>Місто:</strong> ${order.delivery_city}</p>` : ''}
                    ${order.delivery_warehouse ? `<p><strong>Відділення:</strong> ${order.delivery_warehouse}</p>` : ''}
                    ${order.delivery_address ? `<p><strong>Адреса:</strong> ${order.delivery_address}</p>` : ''}
                </div>
            </div>
        ` : ''}
    `;
}

// === Show Basic Info ===
function showBasicInfo() {
    const detailsEl = document.getElementById('order-details');
    if (!detailsEl) return;
    
    detailsEl.innerHTML = `
        <div class="order-success__section">
            <p>Деталі замовлення будуть надіслані вам на email або SMS після підтвердження менеджером.</p>
        </div>
    `;
}

// === Format Price ===
function formatPrice(price) {
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

// === Start ===
document.addEventListener('DOMContentLoaded', init);

