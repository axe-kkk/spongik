/**
 * Admin Panel - Spongik
 */

const API = '/api';

let currentPage = 'dashboard';
let currentUser = null;
let salesChart = null;
let ordersPage = 1;
let productsPage = 1;
let selectedProducts = new Set();
let pendingImages = [];
let confirmCallback = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        const res = await fetch(API + '/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error();
        currentUser = await res.json();
        
        if (currentUser.role !== 'admin') {
            window.location.href = '/pages/account';
            return;
        }
        
        document.getElementById('admin-name').textContent = currentUser.first_name || currentUser.email;
    } catch (e) {
        window.location.href = '/pages/login';
        return;
    }
    
    initNavigation();
    initLogout();
    initButtons();
    initFilters();
    initModals();
    
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigateTo(hash);
}

function initButtons() {
    var addCatBtn = document.getElementById('add-category-btn');
    if (addCatBtn) {
        addCatBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openAddCategoryModal().catch(function(err) {
                console.error('Error opening add category modal:', err);
                showToast('Помилка відкриття форми', 'error');
            });
        });
    }
    
    var addProdBtn = document.getElementById('add-product-btn');
    if (addProdBtn) addProdBtn.addEventListener('click', openAddProductModal);
    
    var addPromoBtn = document.getElementById('add-promo-btn');
    if (addPromoBtn) addPromoBtn.addEventListener('click', openAddPromoModal);
    
    var bulkActBtn = document.getElementById('bulk-activate');
    if (bulkActBtn) bulkActBtn.addEventListener('click', function() { bulkUpdate(true); });
    
    var bulkDeactBtn = document.getElementById('bulk-deactivate');
    if (bulkDeactBtn) bulkDeactBtn.addEventListener('click', function() { bulkUpdate(false); });
    
    var bulkPriceBtn = document.getElementById('bulk-price');
    if (bulkPriceBtn) bulkPriceBtn.addEventListener('click', openBulkPriceModal);
    
    var bulkPromoBtn = document.getElementById('bulk-promo');
    if (bulkPromoBtn) bulkPromoBtn.addEventListener('click', openBulkPromoModal);
    
    var selectAllBtn = document.getElementById('select-all-products');
    if (selectAllBtn) selectAllBtn.addEventListener('change', toggleSelectAll);
}

function toggleSelectAll(e) {
    var isChecked = e.target.checked;
    var checkboxes = document.querySelectorAll('.product-checkbox');
    
    checkboxes.forEach(function(cb) {
        cb.checked = isChecked;
    });
    
    updateBulkActions();
}

function initFilters() {
    // Orders - Status filter
    var filterStatusWrap = document.getElementById('filter-status-wrap');
    if (filterStatusWrap) {
        initSingleCustomSelect(filterStatusWrap, function() { ordersPage = 1; loadOrders(); });
    }
    
    var filterPhone = document.getElementById('filter-phone');
    if (filterPhone) {
        filterPhone.addEventListener('input', debounce(function() { ordersPage = 1; loadOrders(); }, 500));
    }
    
    // Products - Search
    var prodSearch = document.getElementById('products-search');
    if (prodSearch) {
        prodSearch.addEventListener('input', debounce(function() { productsPage = 1; loadProducts(); }, 500));
    }
    
    // Products - Category filter
    var filterCategoryWrap = document.getElementById('filter-category-wrap');
    if (filterCategoryWrap) {
        initSingleCustomSelect(filterCategoryWrap, function() { productsPage = 1; loadProducts(); });
        loadCategoriesFilter();
    }
    
    // Products - Stock filter
    var filterStockWrap = document.getElementById('filter-stock-wrap');
    if (filterStockWrap) {
        initSingleCustomSelect(filterStockWrap, function() { productsPage = 1; loadProducts(); });
    }
    
    // Products - Active filter
    var filterActiveWrap = document.getElementById('filter-active-wrap');
    if (filterActiveWrap) {
        initSingleCustomSelect(filterActiveWrap, function() { productsPage = 1; loadProducts(); });
    }
    
    // Categories - Search
    var catSearch = document.getElementById('categories-search');
    if (catSearch) {
        catSearch.addEventListener('input', debounce(function() { loadCategories(); }, 300));
    }
    
    // Promotions - Search
    var promoSearch = document.getElementById('promotions-search');
    if (promoSearch) {
        promoSearch.addEventListener('input', debounce(function() { loadPromotions(); }, 300));
    }
    
    // Users - Search
    var usersSearch = document.getElementById('users-search');
    if (usersSearch) {
        usersSearch.addEventListener('input', debounce(function() { loadUsers(); }, 300));
    }
}

async function loadCategoriesFilter() {
    try {
        var categories = await api('/categories');
        var dropdown = document.getElementById('filter-category-options');
        if (dropdown && categories.length) {
            var optionsHtml = '<div class="custom-select__option is-selected" data-value="">Всі категорії</div>';
            categories.forEach(function(c) {
                optionsHtml += '<div class="custom-select__option" data-value="' + c.id + '">' + c.name + '</div>';
            });
            dropdown.innerHTML = optionsHtml;
            
            // Re-init click handlers
            var wrap = document.getElementById('filter-category-wrap');
            dropdown.querySelectorAll('.custom-select__option').forEach(function(option) {
                option.addEventListener('click', function() {
                    var value = option.dataset.value;
                    var label = option.textContent;
                    var input = wrap.querySelector('input[type="hidden"]');
                    var textEl = wrap.querySelector('.custom-select__text');
                    
                    input.value = value;
                    textEl.textContent = label;
                    if (value) {
                        textEl.classList.remove('custom-select__placeholder');
                    } else {
                        textEl.classList.add('custom-select__placeholder');
                    }
                    
                    dropdown.querySelectorAll('.custom-select__option').forEach(function(o) {
                        o.classList.remove('is-selected');
                    });
                    option.classList.add('is-selected');
                    
                    wrap.classList.remove('is-open');
                    productsPage = 1;
                    loadProducts();
                });
            });
        }
    } catch (e) {
        console.error(e);
    }
}

function initSingleCustomSelect(select, onChange) {
    var trigger = select.querySelector('.custom-select__trigger');
    var dropdown = select.querySelector('.custom-select__dropdown');
    var input = select.querySelector('input[type="hidden"]');
    var textEl = select.querySelector('.custom-select__text');
    
    trigger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        select.classList.toggle('is-open');
    });
    
    dropdown.querySelectorAll('.custom-select__option').forEach(function(option) {
        option.addEventListener('click', function() {
            var value = option.dataset.value;
            var label = option.textContent;
            
            input.value = value;
            textEl.textContent = label;
            if (value) {
                textEl.classList.remove('custom-select__placeholder');
            } else {
                textEl.classList.add('custom-select__placeholder');
            }
            
            dropdown.querySelectorAll('.custom-select__option').forEach(function(o) {
                o.classList.remove('is-selected');
            });
            option.classList.add('is-selected');
            
            select.classList.remove('is-open');
            if (onChange) onChange(value);
        });
    });
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-select')) {
            select.classList.remove('is-open');
        }
    });
}

function initNavigation() {
    var links = document.querySelectorAll('.sidebar__link[data-page]');
    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });
    
    var toggle = document.getElementById('sidebar-toggle');
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    
    if (toggle && sidebar && overlay) {
        toggle.addEventListener('click', function() {
            sidebar.classList.toggle('is-open');
            overlay.classList.toggle('is-open');
        });
        
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('is-open');
            overlay.classList.remove('is-open');
        });
    }
}

function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.sidebar__link').forEach(function(l) {
        l.classList.remove('is-active');
    });
    
    var activeLink = document.querySelector('[data-page="' + page + '"]');
    if (activeLink) activeLink.classList.add('is-active');
    
    var titles = { dashboard: 'Дашборд', orders: 'Замовлення', products: 'Товари', categories: 'Категорії', promotions: 'Акції', users: 'Користувачі' };
    var titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[page] || page;
    
    document.querySelectorAll('.admin-content').forEach(function(p) {
        p.style.display = 'none';
    });
    
    var pageEl = document.getElementById(page + '-page');
    if (pageEl) pageEl.style.display = 'block';
    
    if (page === 'dashboard') loadDashboard();
    else if (page === 'orders') loadOrders();
    else if (page === 'products') loadProducts();
    else if (page === 'categories') loadCategories();
    else if (page === 'promotions') loadPromotions();
    else if (page === 'users') loadUsers();
    
    history.replaceState(null, '', '#' + page);
}

function initLogout() {
    var btn = document.getElementById('logout-btn');
    if (btn) {
        btn.addEventListener('click', async function() {
            await fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/';
        });
    }
}

function initModals() {
    var closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    
    var overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target.id === 'modal-overlay') closeModal();
        });
    }
    
    var confirmYes = document.getElementById('confirm-yes');
    if (confirmYes) {
        confirmYes.addEventListener('click', async function() {
            if (confirmCallback) await confirmCallback();
            closeConfirmModal();
        });
    }
    
    var confirmNo = document.getElementById('confirm-no');
    if (confirmNo) confirmNo.addEventListener('click', closeConfirmModal);
    
    var confirmOverlay = document.getElementById('confirm-overlay');
    if (confirmOverlay) {
        confirmOverlay.addEventListener('click', function(e) {
            if (e.target.id === 'confirm-overlay') closeConfirmModal();
        });
    }
}

async function api(endpoint, options) {
    options = options || {};
    var headers = options.headers || {};
    headers['Content-Type'] = 'application/json';
    
    var res = await fetch(API + endpoint, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body,
        credentials: 'include'
    });
    
    if (!res.ok) {
        var err = {};
        try { err = await res.json(); } catch(e) {}
        throw new Error(err.detail || 'Error');
    }
    
    if (res.status === 204) return null;
    return res.json();
}

// Dashboard
async function loadDashboard() {
    try {
        var stats = await api('/admin/stats');
        
        document.getElementById('stat-orders-today').textContent = stats.orders_today || 0;
        document.getElementById('stat-revenue-today').textContent = formatPrice(stats.revenue_today || 0);
        document.getElementById('stat-orders-month').textContent = stats.orders_month || 0;
        document.getElementById('stat-revenue-month').textContent = formatPrice(stats.revenue_month || 0);
        
        var topEl = document.getElementById('top-products');
        if (stats.top_products_qty && stats.top_products_qty.length) {
            topEl.innerHTML = stats.top_products_qty.slice(0, 5).map(function(p, i) {
                return '<div class="top-product"><span class="top-product__rank">' + (i+1) + '</span><span class="top-product__name">' + p.name + '</span><span class="top-product__qty">' + p.total_qty + ' шт</span></div>';
            }).join('');
        } else {
            topEl.innerHTML = '<div class="empty-text">Немає даних</div>';
        }
        
        if (stats.sales_by_day && stats.sales_by_day.length) {
            renderSalesChart(stats.sales_by_day);
        }
        
        var orders = await api('/admin/orders?page_size=5');
        renderRecentOrders(orders.items || orders);
    } catch (e) {
        console.error(e);
    }
}

function renderSalesChart(data) {
    var ctx = document.getElementById('sales-chart');
    if (!ctx) return;
    if (salesChart) salesChart.destroy();
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(function(d) { return new Date(d.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }); }),
            datasets: [{
                label: 'Виручка',
                data: data.map(function(d) { return d.revenue; }),
                borderColor: '#F297A0',
                backgroundColor: 'rgba(242, 151, 160, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderRecentOrders(orders) {
    var tbody = document.getElementById('recent-orders');
    if (!tbody) return;
    
    if (!orders || !orders.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-text">Немає замовлень</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(function(o) {
        return '<tr><td><strong>' + o.order_number + '</strong></td><td>' + o.customer_name + '</td><td>' + formatPrice(o.total) + '</td><td><span class="status status--' + o.status + '">' + getStatusLabel(o.status) + '</span></td><td>' + formatDate(o.created_at) + '</td></tr>';
    }).join('');
}

// Orders
async function loadOrders() {
    var statusEl = document.getElementById('filter-status');
    var phoneEl = document.getElementById('filter-phone');
    var status = statusEl ? statusEl.value : '';
    var phone = phoneEl ? phoneEl.value : '';
    
    try {
        var params = 'page=' + ordersPage + '&page_size=20';
        if (status) params += '&status=' + status;
        if (phone) params += '&phone=' + phone;
        
        var data = await api('/admin/orders?' + params);
        var orders = data.items || data;
        
        var tbody = document.getElementById('orders-table');
        if (!orders || !orders.length) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty-text">Немає замовлень</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(function(o) {
            var statusOptions = ['pending','confirmed','processing','shipped','delivered','cancelled'].map(function(s) {
                return '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + getStatusLabel(s) + '</option>';
            }).join('');
            
            // Подсчитываем общее количество товаров
            var itemsCount = 0;
            if (o.items && o.items.length) {
                itemsCount = o.items.reduce(function(sum, item) { return sum + item.quantity; }, 0);
            }
            
            var emailHtml = o.customer_email ? '<span title="' + o.customer_email + '">✉</span>' : '—';
            var paymentType = getPaymentTypeLabel(o.payment_type);
            var isPaidHtml = '<label class="checkbox" style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer;"><input type="checkbox" class="order-paid-checkbox" data-order-id="' + o.id + '" data-order-status="' + o.status + '"' + (o.is_paid ? ' checked' : '') + '><span>' + (o.is_paid ? '<span class="status status--active" title="Оплачена предоплата">✓</span>' : '<span class="status status--inactive" title="Не оплачена предоплата">—</span>') + '</span></label>';
            
            // Правильно определяем доставку: бесплатная если delivery_cost = 0 и subtotal >= 1000
            var deliveryHtml = '';
            var FREE_DELIVERY_THRESHOLD = 1000;
            if (o.delivery_cost > 0) {
                deliveryHtml = formatPrice(o.delivery_cost);
            } else if (o.subtotal >= FREE_DELIVERY_THRESHOLD) {
                deliveryHtml = '<span style="color: var(--admin-success);">Безкоштовно</span>';
            } else {
                deliveryHtml = '<span style="color: var(--admin-text-secondary);">За тарифами</span>';
            }
            
            return '<tr><td><strong>' + o.order_number + '</strong></td><td>' + o.customer_name + '</td><td>' + o.customer_phone + '</td><td>' + emailHtml + '</td><td>' + (o.items ? o.items.length : 0) + ' позицій<br><small>' + itemsCount + ' шт</small></td><td>' + formatPrice(o.total) + '<br><small style="color: var(--admin-text-secondary);">Доставка: ' + deliveryHtml + '</small></td><td>' + paymentType + '</td><td>' + isPaidHtml + '</td><td><select class="input input--sm status-select" data-order-id="' + o.id + '">' + statusOptions + '</select></td><td>' + formatDate(o.created_at) + '</td><td><button class="btn-icon" onclick="viewOrder(' + o.id + ')">👁</button></td></tr>';
        }).join('');
        
        tbody.querySelectorAll('.status-select').forEach(function(sel) {
            sel.addEventListener('change', async function(e) {
                try {
                    await api('/admin/orders/' + e.target.dataset.orderId, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: e.target.value })
                    });
                    showToast('Статус оновлено');
                } catch (err) {
                    showToast('Помилка', 'error');
                    loadOrders();
                }
            });
        });
        
        // Обработчики для чекбоксов предоплаты
        tbody.querySelectorAll('.order-paid-checkbox').forEach(function(checkbox) {
            checkbox.addEventListener('change', async function(e) {
                var orderId = e.target.dataset.orderId;
                var orderStatus = e.target.dataset.orderStatus;
                var isChecked = e.target.checked;
                
                try {
                    await api('/admin/orders/' + orderId, {
                        method: 'PATCH',
                        body: JSON.stringify({ 
                            status: orderStatus,
                            is_paid: isChecked 
                        })
                    });
                    showToast('Статус предоплати оновлено');
                    // Обновляем UI
                    var statusSpan = e.target.nextElementSibling;
                    if (statusSpan) {
                        statusSpan.innerHTML = isChecked 
                            ? '<span class="status status--active" title="Оплачена предоплата">✓</span>' 
                            : '<span class="status status--inactive" title="Не оплачена предоплата">—</span>';
                    }
                } catch (err) {
                    showToast('Помилка', 'error');
                    e.target.checked = !isChecked; // Откатываем изменение
                }
            });
        });
    } catch (e) {
        console.error(e);
    }
}

window.viewOrder = async function(id) {
    try {
        var o = await api('/admin/orders/' + id);
        
        // Статус заказа
        var statusBadge = '<span class="order-status-badge order-status-badge--' + o.status + '">' + getStatusLabel(o.status) + '</span>';
        
        // Формируем список товаров с деталями
        var itemsHtml = (o.items || []).map(function(item) {
            return '<div class="order-item">' +
                '<div class="order-item__info">' +
                    '<div class="order-item__name">' + item.product_name + '</div>' +
                    (item.product_sku ? '<div class="order-item__sku">Артикул: ' + item.product_sku + '</div>' : '') +
                '</div>' +
                '<div class="order-item__qty">' + item.quantity + ' шт</div>' +
                '<div class="order-item__price">' +
                    '<div class="order-item__price-unit">' + formatPrice(item.price) + '</div>' +
                    '<div class="order-item__price-total">' + formatPrice(item.total) + '</div>' +
                '</div>' +
            '</div>';
        }).join('') || '<div class="empty-text">Немає товарів</div>';
        
        // Подсчитываем общее количество
        var totalItems = 0;
        if (o.items && o.items.length) {
            totalItems = o.items.reduce(function(sum, item) { return sum + item.quantity; }, 0);
        }
        
        // Информация о доставке
        var deliveryInfo = '';
        if (o.delivery_type === 'nova_poshta') {
            deliveryInfo = '<div class="order-detail__row"><span class="order-detail__icon">🚚</span><span>Доставка:</span><strong>Нова Пошта</strong></div>';
            if (o.delivery_city) deliveryInfo += '<div class="order-detail__row"><span class="order-detail__icon">📍</span><span>Місто:</span><strong>' + o.delivery_city + '</strong></div>';
            if (o.delivery_warehouse) deliveryInfo += '<div class="order-detail__row"><span class="order-detail__icon">📦</span><span>Відділення/Поштомат:</span><strong>' + o.delivery_warehouse + '</strong></div>';
        } else if (o.delivery_type === 'courier') {
            deliveryInfo = '<div class="order-detail__row"><span class="order-detail__icon">🚚</span><span>Доставка:</span><strong>Кур\'єр</strong></div>';
            if (o.delivery_address) deliveryInfo += '<div class="order-detail__row"><span class="order-detail__icon">📍</span><span>Адреса:</span><strong>' + o.delivery_address + '</strong></div>';
        } else if (o.delivery_type === 'pickup') {
            deliveryInfo = '<div class="order-detail__row"><span class="order-detail__icon">🏪</span><span>Доставка:</span><strong>Самовивіз</strong></div>';
        }
        
        // Информация об оплате
        var paymentInfo = '<div class="order-detail__row"><span class="order-detail__icon">💳</span><span>Спосіб оплати:</span><strong>' + getPaymentTypeLabel(o.payment_type) + '</strong></div>';
        paymentInfo += '<div class="order-detail__row"><span class="order-detail__icon">💰</span><span>Предоплата:</span><strong>' + (o.is_paid ? '<span class="status status--active">Оплачена предоплата</span>' : '<span class="status status--inactive">Не оплачена предоплата</span>') + '</strong></div>';
        
        // Детальная информация о суммах
        var FREE_DELIVERY_THRESHOLD = 1000;
        var totalsHtml = '<div class="order-totals">';
        totalsHtml += '<div class="order-totals__row"><span>Товари:</span><strong>' + formatPrice(o.subtotal) + '</strong></div>';
        if (o.discount > 0) {
            totalsHtml += '<div class="order-totals__row order-totals__row--discount"><span>Знижка:</span><strong style="color: #f297a0;">-' + formatPrice(o.discount) + '</strong></div>';
        }
        // Правильно определяем доставку
        if (o.delivery_cost > 0) {
            totalsHtml += '<div class="order-totals__row"><span>Доставка:</span><strong>' + formatPrice(o.delivery_cost) + '</strong></div>';
        } else if (o.subtotal >= FREE_DELIVERY_THRESHOLD) {
            totalsHtml += '<div class="order-totals__row"><span>Доставка:</span><strong style="color: var(--admin-success);">Безкоштовно</strong></div>';
        } else {
            totalsHtml += '<div class="order-totals__row"><span>Доставка:</span><strong style="color: var(--admin-text-secondary);">За тарифами перевізника</strong></div>';
        }
        totalsHtml += '<div class="order-totals__row order-totals__row--total"><span>Всього:</span><strong>' + formatPrice(o.total) + '</strong></div>';
        totalsHtml += '</div>';
        
        // Промокод
        var promoHtml = '';
        if (o.promotion_code) {
            promoHtml = '<div class="order-detail__promo"><span class="order-detail__icon">🎟️</span><span>Промокод:</span><strong>' + o.promotion_code + '</strong></div>';
        }
        
        // Заметки
        var notesHtml = '';
        if (o.notes) {
            notesHtml = '<div class="order-detail__notes"><span class="order-detail__icon">📝</span><div><strong>Примітки:</strong><p>' + o.notes + '</p></div></div>';
        }
        
        // Даты
        var datesHtml = '<div class="order-detail__dates">';
        datesHtml += '<div class="order-detail__row"><span class="order-detail__icon">📅</span><span>Створено:</span><span>' + formatDate(o.created_at) + '</span></div>';
        if (o.updated_at && o.updated_at !== o.created_at) {
            datesHtml += '<div class="order-detail__row"><span class="order-detail__icon">🔄</span><span>Оновлено:</span><span>' + formatDate(o.updated_at) + '</span></div>';
        }
        datesHtml += '</div>';
        
        var html = '<div class="order-detail">' +
            '<div class="order-detail__header">' +
                '<div class="order-detail__number">Замовлення ' + o.order_number + '</div>' +
                statusBadge +
            '</div>' +
            '<div class="order-detail__section">' +
                '<h4 class="order-detail__section-title"><span class="order-detail__icon">👤</span>Клієнт</h4>' +
                '<div class="order-detail__row"><span class="order-detail__icon">📛</span><span>Ім\'я:</span><strong>' + o.customer_name + '</strong></div>' +
                '<div class="order-detail__row"><span class="order-detail__icon">📞</span><span>Телефон:</span><strong><a href="tel:' + o.customer_phone + '" class="order-detail__link">' + o.customer_phone + '</a></strong></div>' +
                (o.customer_email ? '<div class="order-detail__row"><span class="order-detail__icon">✉️</span><span>Email:</span><strong><a href="mailto:' + o.customer_email + '" class="order-detail__link">' + o.customer_email + '</a></strong></div>' : '') +
            '</div>' +
            '<div class="order-detail__section">' +
                '<h4 class="order-detail__section-title"><span class="order-detail__icon">🚚</span>Доставка</h4>' +
                deliveryInfo +
            '</div>' +
            '<div class="order-detail__section">' +
                '<h4 class="order-detail__section-title"><span class="order-detail__icon">💳</span>Оплата</h4>' +
                paymentInfo +
            '</div>' +
            '<div class="order-detail__section">' +
                '<h4 class="order-detail__section-title"><span class="order-detail__icon">🛍️</span>Товари (' + (o.items ? o.items.length : 0) + ' позицій, ' + totalItems + ' шт)</h4>' +
                '<div class="order-items">' + itemsHtml + '</div>' +
            '</div>' +
            totalsHtml +
            promoHtml +
            notesHtml +
            datesHtml +
            '</div>';
        
        openModal('Замовлення ' + o.order_number, html);
    } catch (e) {
        showToast('Помилка', 'error');
    }
};

// Products
async function loadProducts() {
    var searchEl = document.getElementById('products-search');
    var categoryEl = document.getElementById('filter-category');
    var stockEl = document.getElementById('filter-stock');
    var activeEl = document.getElementById('filter-active');
    
    var search = searchEl ? searchEl.value : '';
    var category = categoryEl ? categoryEl.value : '';
    var stock = stockEl ? stockEl.value : '';
    var active = activeEl ? activeEl.value : '';
    
    try {
        var params = 'page=' + productsPage + '&page_size=20';
        if (search) params += '&q=' + encodeURIComponent(search);
        if (category) params += '&category_id=' + category;
        if (stock === 'in_stock') params += '&in_stock=true';
        if (stock === 'out_of_stock') params += '&in_stock=false';
        if (active === 'active') params += '&is_active=true';
        if (active === 'inactive') params += '&is_active=false';
        
        var data = await api('/admin/products?' + params);
        var products = data.items || data;
        
        var tbody = document.getElementById('products-table');
        if (!products || !products.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-text">Немає товарів</td></tr>';
            return;
        }
        
        tbody.innerHTML = products.map(function(p) {
            var imgHtml = p.primary_image ? '<img src="' + p.primary_image + '" alt="">' : '';
            var priceHtml = '';
            if (p.discount_percent && p.final_price < p.price) {
                priceHtml = '<span class="price-old">' + formatPrice(p.price) + '</span> <span class="price-new">' + formatPrice(p.final_price) + '</span>';
            } else if (p.old_price) {
                priceHtml = '<span class="price-old">' + formatPrice(p.old_price) + '</span> ' + formatPrice(p.price);
            } else {
                priceHtml = formatPrice(p.price);
            }
            var escapedName = p.name.replace(/'/g, "\\'");
            var inStockText = p.in_stock ? 'Присутній' : 'Відсутній';
            var isActiveText = p.is_active ? 'Активний' : 'Неактивний';
            
            var discountBadge = p.discount_percent ? '<span class="discount-badge">-' + p.discount_percent + '%</span>' : '';
            
            return '<tr><td><input type="checkbox" class="product-checkbox" data-id="' + p.id + '"></td><td><div class="product-thumb">' + imgHtml + '</div></td><td><a href="#" class="product-link" onclick="viewProduct(' + p.id + '); return false;"><strong>' + p.name + '</strong></a>' + discountBadge + '<br><small class="text-muted">' + (p.category_name || 'Без категорії') + '</small></td><td>' + (p.sku || '—') + '</td><td>' + priceHtml + '</td><td><span class="status status--' + (p.in_stock ? 'active' : 'inactive') + '">' + inStockText + '</span></td><td><span class="status status--' + (p.is_active ? 'active' : 'inactive') + '">' + isActiveText + '</span></td><td><button class="btn-icon" onclick="viewProduct(' + p.id + ')" title="Переглянути">👁</button><button class="btn-icon" onclick="editProduct(' + p.id + ')" title="Редагувати">✏️</button><button class="btn-icon" onclick="confirmDeleteProduct(' + p.id + ', \'' + escapedName + '\')" title="Видалити">🗑</button></td></tr>';
        }).join('');
        
        tbody.querySelectorAll('.product-checkbox').forEach(function(cb) {
            cb.addEventListener('change', updateBulkActions);
        });
    } catch (e) {
        console.error(e);
    }
}

function updateBulkActions() {
    var allCheckboxes = document.querySelectorAll('.product-checkbox');
    var checked = document.querySelectorAll('.product-checkbox:checked');
    selectedProducts = new Set();
    checked.forEach(function(c) { selectedProducts.add(c.dataset.id); });
    
    var bulkEl = document.getElementById('bulk-actions');
    if (selectedProducts.size > 0) {
        bulkEl.style.display = 'flex';
        document.getElementById('selected-count').textContent = selectedProducts.size + ' обрано';
    } else {
        bulkEl.style.display = 'none';
    }
    
    // Update select all checkbox
    var selectAllBtn = document.getElementById('select-all-products');
    if (selectAllBtn && allCheckboxes.length > 0) {
        selectAllBtn.checked = checked.length === allCheckboxes.length;
        selectAllBtn.indeterminate = checked.length > 0 && checked.length < allCheckboxes.length;
    }
}

async function bulkUpdate(isActive) {
    if (selectedProducts.size === 0) return;
    
    try {
        var ids = [];
        selectedProducts.forEach(function(id) { ids.push(Number(id)); });
        
        await api('/admin/products/bulk-active', {
            method: 'POST',
            body: JSON.stringify({ product_ids: ids, is_active: isActive })
        });
        showToast('Оновлено');
        loadProducts();
    } catch (e) {
        showToast('Помилка', 'error');
    }
}

function openBulkPriceModal() {
    if (selectedProducts.size === 0) {
        showToast('Оберіть товари', 'error');
        return;
    }
    
    openModal('Змінити ціну', '<form id="bulk-price-form"><p class="form-hint">Зміна ціни застосується безпосередньо до товарів</p><div class="form-group"><label class="form-label">Нова ціна (₴)</label><input type="number" class="input" name="value" required min="0" step="0.01" placeholder="Введіть нову ціну"></div><button type="submit" class="btn btn--primary btn--full">Застосувати</button></form>');
    
    document.getElementById('bulk-price-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var form = e.target;
        
        try {
            var ids = [];
            selectedProducts.forEach(function(id) { ids.push(Number(id)); });
            
            await api('/admin/products/bulk-price', {
                method: 'POST',
                body: JSON.stringify({
                    scope: 'product_ids',
                    product_ids: ids,
                    operation: 'set',
                    value_type: 'fixed',
                    value: parseFloat(form.value.value)
                })
            });
            closeModal();
            showToast('Ціни оновлено');
            loadProducts();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function openBulkPromoModal() {
    if (selectedProducts.size === 0) {
        showToast('Оберіть товари', 'error');
        return;
    }
    
    var today = new Date().toISOString().split('T')[0];
    var nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    openModal('Додати акцію', '<form id="bulk-promo-form"><p class="form-hint">Акція застосується до обраних товарів на вказаний період</p><div class="form-group"><label class="form-label">Назва акції *</label><input type="text" class="input" name="name" required placeholder="Наприклад: Зимовий розпродаж"></div><div class="form-group"><label class="form-label">Знижка (%)</label><input type="number" class="input" name="value" required min="1" max="99" value="10" placeholder="10"></div><div class="form-row"><div class="form-group"><label class="form-label">Початок</label><input type="date" class="input" name="start_at" value="' + today + '" required></div><div class="form-group"><label class="form-label">Кінець</label><input type="date" class="input" name="end_at" value="' + nextWeek + '" required></div></div><button type="submit" class="btn btn--primary btn--full">Створити акцію</button></form>');
    
    document.getElementById('bulk-promo-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var form = e.target;
        
        try {
            var ids = [];
            selectedProducts.forEach(function(id) { ids.push(id); });
            
            await api('/promotions', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name.value,
                    type: 'percent',
                    value: parseFloat(form.value.value),
                    scope: 'product',
                    target_ids: JSON.stringify(ids),
                    starts_at: form.start_at.value + 'T00:00:00',
                    ends_at: form.end_at.value + 'T23:59:59',
                    is_active: true,
                    priority: 10
                })
            });
            closeModal();
            showToast('Акцію створено');
            loadProducts();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
    
    document.getElementById('bulk-price-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var form = e.target;
        
        try {
            var ids = [];
            selectedProducts.forEach(function(id) { ids.push(Number(id)); });
            
            await api('/admin/products/bulk-price', {
                method: 'POST',
                body: JSON.stringify({
                    scope: 'product_ids',
                    product_ids: ids,
                    operation: form.operation.value,
                    value_type: form.value_type.value,
                    value: parseFloat(form.value.value)
                })
            });
            closeModal();
            showToast('Ціни оновлено');
            loadProducts();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function openAddProductModal() {
    var categories = [];
    try { categories = await api('/categories'); } catch(e) {}
    pendingImages = [];
    
    var catOptions = categories.map(function(c) { return { value: c.id, label: c.name }; });
    var categorySelect = createCustomSelect('category_id', catOptions, '', '— Оберіть категорію —');
    
    openModal('Новий товар', '<form id="add-product-form"><div class="form-group"><label class="form-label">Назва *</label><input type="text" class="input" name="name" required></div><div class="form-group"><label class="form-label">Категорія *</label>' + categorySelect + '</div><div class="form-row"><div class="form-group"><label class="form-label">Ціна *</label><input type="number" class="input" name="price" required></div><div class="form-group"><label class="form-label">Стара ціна</label><input type="number" class="input" name="old_price"></div></div><div class="form-group"><label class="form-label">Артикул</label><input type="text" class="input" name="sku"></div><div class="form-group"><label class="form-label">Наявність</label><div class="radio-group"><label class="radio"><input type="radio" name="in_stock" value="1" checked><span>В наявності</span></label><label class="radio"><input type="radio" name="in_stock" value="0"><span>Немає</span></label></div></div><div class="form-group"><label class="form-label">Опис</label><textarea class="input" name="description" rows="3"></textarea></div><div class="form-group"><label class="form-label">Фото (макс. 5)</label><div class="images-grid" id="pending-images"></div><div class="upload-area" id="upload-area-new"><input type="file" id="new-image-input" accept="image/*" multiple hidden><button type="button" class="btn btn--sm btn--secondary" onclick="document.getElementById(\'new-image-input\').click()">+ Додати фото</button></div></div><button type="submit" class="btn btn--primary btn--full">Створити</button></form>');
    
    initCustomSelects();
    document.getElementById('new-image-input').addEventListener('change', handleNewImages);
    document.getElementById('add-product-form').addEventListener('submit', submitAddProduct);
}

function handleNewImages(e) {
    var files = e.target.files;
    for (var i = 0; i < files.length; i++) {
        if (pendingImages.length >= 5) { showToast('Максимум 5 фото', 'error'); break; }
        (function(file) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                pendingImages.push({ file: file, preview: ev.target.result });
                renderPendingImages();
            };
            reader.readAsDataURL(file);
        })(files[i]);
    }
}

function renderPendingImages() {
    var container = document.getElementById('pending-images');
    if (!container) return;
    
    container.innerHTML = pendingImages.map(function(img, i) {
        return '<div class="image-item"><img src="' + img.preview + '" alt="" onclick="openImagePreview(\'' + img.preview + '\')"><button type="button" class="image-item__delete" onclick="event.stopPropagation(); removePendingImage(' + i + ')">×</button></div>';
    }).join('');
    
    var area = document.getElementById('upload-area-new');
    if (area) area.style.display = pendingImages.length >= 5 ? 'none' : 'block';
}

window.removePendingImage = function(i) {
    pendingImages.splice(i, 1);
    renderPendingImages();
};

async function submitAddProduct(e) {
    e.preventDefault();
    var form = e.target;
    var name = form.name.value;
    
    try {
        var product = await api('/admin/products', {
            method: 'POST',
            body: JSON.stringify({
                name: name,
                slug: slugify(name),
                price: parseFloat(form.price.value),
                old_price: form.old_price.value ? parseFloat(form.old_price.value) : null,
                sku: form.sku.value || null,
                in_stock: form.in_stock.value === '1',
                category_id: parseInt(form.category_id.value),
                description: form.description.value || null,
                is_active: true
            })
        });
        
        for (var i = 0; i < pendingImages.length; i++) {
            await uploadProductImage(product.id, pendingImages[i].file);
        }
        
        closeModal();
        showToast('Товар створено');
        loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.editProduct = async function(id) {
    try {
        var product = await api('/admin/products/' + id);
        var categories = await api('/categories');
        
        var images = product.images || [];
        var imagesHtml = images.map(function(img) {
            return '<div class="image-item"><img src="' + img.url + '" alt="" onclick="openImagePreview(\'' + img.url + '\')"><button type="button" class="image-item__delete" onclick="event.stopPropagation(); confirmDeleteImage(' + id + ', ' + img.id + ')">×</button></div>';
        }).join('') || '<p class="text-muted">Немає фото</p>';
        
        var catOptions = categories.map(function(c) { return { value: c.id, label: c.name }; });
        var categorySelect = createCustomSelect('category_id', catOptions, product.category_id, '— Оберіть категорію —');
        
        var uploadHtml = images.length < 5 ? '<div class="upload-area"><input type="file" id="edit-image-input" accept="image/*" multiple hidden><button type="button" class="btn btn--sm btn--secondary" onclick="document.getElementById(\'edit-image-input\').click()">+ Додати фото</button></div>' : '';
        
        openModal('Редагувати товар', '<form id="edit-product-form"><div class="form-group"><label class="form-label">Назва</label><input type="text" class="input" name="name" value="' + product.name + '" required></div><div class="form-group"><label class="form-label">Категорія *</label>' + categorySelect + '</div><div class="form-row"><div class="form-group"><label class="form-label">Ціна</label><input type="number" class="input" name="price" value="' + product.price + '" required></div><div class="form-group"><label class="form-label">Стара ціна</label><input type="number" class="input" name="old_price" value="' + (product.old_price || '') + '"></div></div><div class="form-group"><label class="form-label">Артикул</label><input type="text" class="input" name="sku" value="' + (product.sku || '') + '"></div><div class="form-group"><label class="form-label">Наявність</label><div class="radio-group"><label class="radio"><input type="radio" name="in_stock" value="1"' + (product.in_stock ? ' checked' : '') + '><span>В наявності</span></label><label class="radio"><input type="radio" name="in_stock" value="0"' + (!product.in_stock ? ' checked' : '') + '><span>Немає</span></label></div></div><div class="form-group"><label class="form-label">Опис</label><textarea class="input" name="description" rows="3">' + (product.description || '') + '</textarea></div><div class="form-group"><label class="form-label">Фото (макс. 5)</label><div class="images-grid" id="product-images">' + imagesHtml + '</div>' + uploadHtml + '</div><div class="form-group"><label class="checkbox"><input type="checkbox" name="is_active"' + (product.is_active ? ' checked' : '') + '><span>Активний</span></label></div><button type="submit" class="btn btn--primary btn--full">Зберегти</button></form>');
        
        initCustomSelects();
        
        var editInput = document.getElementById('edit-image-input');
        if (editInput) {
            editInput.addEventListener('change', async function(ev) {
                var files = ev.target.files;
                for (var i = 0; i < files.length; i++) {
                    if (images.length >= 5) { showToast('Максимум 5 фото', 'error'); break; }
                    await uploadProductImage(id, files[i]);
                }
                editProduct(id);
            });
        }
        
        document.getElementById('edit-product-form').addEventListener('submit', async function(ev) {
            ev.preventDefault();
            var form = ev.target;
            
            try {
                await api('/admin/products/' + id, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        name: form.name.value,
                        price: parseFloat(form.price.value),
                        old_price: form.old_price.value ? parseFloat(form.old_price.value) : null,
                        sku: form.sku.value || null,
                        in_stock: form.in_stock.value === '1',
                        category_id: parseInt(form.category_id.value),
                        description: form.description.value || null,
                        is_active: form.is_active.checked
                    })
                });
                closeModal();
                showToast('Товар оновлено');
                loadProducts();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    } catch (e) {
        showToast('Помилка', 'error');
    }
};

async function uploadProductImage(productId, file) {
    var formData = new FormData();
    formData.append('file', file);
    
    try {
        await fetch(API + '/admin/products/' + productId + '/images', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
    } catch (e) {
        showToast('Помилка завантаження', 'error');
    }
}

window.confirmDeleteImage = function(productId, imageId) {
    openConfirmModal('Видалити фото?', async function() {
        try {
            await api('/admin/products/' + productId + '/images/' + imageId, { method: 'DELETE' });
            showToast('Фото видалено');
            editProduct(productId);
        } catch (e) {
            showToast('Помилка', 'error');
        }
    });
};

window.confirmDeleteProduct = function(id, name) {
    openConfirmModal('Видалити товар "' + name + '"?', async function() {
        try {
            await api('/admin/products/' + id, { method: 'DELETE' });
            showToast('Товар видалено');
            loadProducts();
        } catch (e) {
            showToast('Помилка', 'error');
        }
    });
};

window.viewProduct = async function(id) {
    try {
        var p = await api('/admin/products/' + id);
        
        var imagesHtml = '';
        if (p.images && p.images.length) {
            imagesHtml = '<div class="product-view__gallery">' + p.images.map(function(img) {
                return '<div class="product-view__img"><img src="' + img.url + '" alt="" onclick="openImagePreview(\'' + img.url + '\')"></div>';
            }).join('') + '</div>';
        } else {
            imagesHtml = '<div class="product-view__no-img">📷 Немає фото</div>';
        }
        
        var priceHtml = '<div class="product-view__price">';
        if (p.old_price) {
            priceHtml += '<span class="price-old">' + formatPrice(p.old_price) + '</span>';
        }
        priceHtml += '<span class="price-current">' + formatPrice(p.price) + '</span></div>';
        
        var discountBadge = '';
        if (p.discount_percent && p.final_price < p.price) {
            discountBadge = '<span class="product-view__discount">-' + p.discount_percent + '%</span>';
        } else if (p.old_price) {
            var discount = Math.round((1 - parseFloat(p.price) / parseFloat(p.old_price)) * 100);
            if (discount > 0) {
                discountBadge = '<span class="product-view__discount">-' + discount + '%</span>';
            }
        }
        
        var inStockText = p.in_stock ? '<span class="status status--active">✅ Присутній</span>' : '<span class="status status--inactive">❌ Відсутній</span>';
        var isActiveText = p.is_active ? '<span class="status status--active">✅ Активний</span>' : '<span class="status status--inactive">❌ Неактивний</span>';
        var isFeaturedText = p.is_featured ? '<span class="status status--active">⭐ Рекомендований</span>' : '';
        
        var html = '<div class="product-view">' +
            '<div class="product-view__header">' +
                '<div class="product-view__title">' + p.name + '</div>' +
                discountBadge +
            '</div>' +
            imagesHtml +
            '<div class="product-view__info">' +
                '<div class="product-view__section">' +
                    '<h4 class="product-view__section-title">💰 Ціна</h4>' +
                    priceHtml +
                '</div>' +
                '<div class="product-view__section">' +
                    '<h4 class="product-view__section-title">📋 Інформація</h4>' +
                    '<div class="product-view__row"><span class="product-view__label">Категорія:</span><span class="product-view__value">' + (p.category_name || '—') + '</span></div>' +
                    '<div class="product-view__row"><span class="product-view__label">Артикул:</span><span class="product-view__value">' + (p.sku || '—') + '</span></div>' +
                    (p.brand ? '<div class="product-view__row"><span class="product-view__label">Бренд:</span><span class="product-view__value">' + p.brand + '</span></div>' : '') +
                '</div>' +
                '<div class="product-view__section">' +
                    '<h4 class="product-view__section-title">📊 Статус</h4>' +
                    '<div class="product-view__row"><span class="product-view__label">Наявність:</span><span class="product-view__value">' + inStockText + '</span></div>' +
                    '<div class="product-view__row"><span class="product-view__label">Активність:</span><span class="product-view__value">' + isActiveText + '</span></div>' +
                    (isFeaturedText ? '<div class="product-view__row"><span class="product-view__label">Рекомендація:</span><span class="product-view__value">' + isFeaturedText + '</span></div>' : '') +
                '</div>' +
                (p.description ? '<div class="product-view__section"><h4 class="product-view__section-title">📝 Опис</h4><div class="product-view__desc">' + p.description + '</div></div>' : '') +
                '<div class="product-view__section">' +
                    '<h4 class="product-view__section-title">📅 Дати</h4>' +
                    '<div class="product-view__row"><span class="product-view__label">Створено:</span><span class="product-view__value">' + formatDate(p.created_at) + '</span></div>' +
                    (p.updated_at && p.updated_at !== p.created_at ? '<div class="product-view__row"><span class="product-view__label">Оновлено:</span><span class="product-view__value">' + formatDate(p.updated_at) + '</span></div>' : '') +
                '</div>' +
            '</div>' +
            '<div class="product-view__actions">' +
                '<button class="btn btn--primary" onclick="closeModal(); editProduct(' + p.id + ');">✏️ Редагувати</button>' +
            '</div>' +
        '</div>';
        
        openModal('Картка товару', html);
    } catch (e) {
        showToast('Помилка завантаження', 'error');
    }
};

// Categories
// Функция для построения иерархии категорий
function buildCategoryTree(categories) {
    var map = {};
    var roots = [];
    
    // Создаем карту категорий
    categories.forEach(function(cat) {
        map[cat.id] = { ...cat, children: [] };
    });
    
    // Строим дерево
    categories.forEach(function(cat) {
        if (cat.parent_id && map[cat.parent_id]) {
            map[cat.parent_id].children.push(map[cat.id]);
        } else {
            roots.push(map[cat.id]);
        }
    });
    
    return roots;
}

// Функция для отображения категории с учетом вложенности
function renderCategoryRow(category, level, allCategories) {
    var indent = level * 24;
    var escapedName = category.name.replace(/'/g, "\\'");
    var indentHtml = level > 0 ? '<span style="display: inline-block; width: ' + indent + 'px;"></span><span style="color: var(--color-pink); margin-right: 4px;">└─</span>' : '';
    
    var row = '<tr>' +
        '<td>' + indentHtml + '<strong>' + category.name + '</strong></td>' +
        '<td>' + category.slug + '</td>' +
        '<td>' + (category.products_count || 0) + '</td>' +
        '<td><span class="status status--' + (category.is_active ? 'active' : 'inactive') + '">' + (category.is_active ? 'Так' : 'Ні') + '</span></td>' +
        '<td><button class="btn-icon" onclick="editCategory(' + category.id + ')">✏️</button><button class="btn-icon" onclick="confirmDeleteCategory(' + category.id + ', \'' + escapedName + '\')">🗑</button></td>' +
        '</tr>';
    
    // Рекурсивно отображаем дочерние категории
    if (category.children && category.children.length > 0) {
        category.children.forEach(function(child) {
            row += renderCategoryRow(child, level + 1, allCategories);
        });
    }
    
    return row;
}

async function loadCategories() {
    var searchEl = document.getElementById('categories-search');
    var search = searchEl ? searchEl.value.toLowerCase() : '';
    
    try {
        var categories = await api('/admin/categories');
        
        // Filter by search
        if (search) {
            categories = categories.filter(function(c) {
                return c.name.toLowerCase().indexOf(search) !== -1 || 
                       c.slug.toLowerCase().indexOf(search) !== -1;
            });
        }
        
        var tbody = document.getElementById('categories-table');
        if (!categories || !categories.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-text">Немає категорій</td></tr>';
            return;
        }
        
        // Строим дерево категорий
        var tree = buildCategoryTree(categories);
        
        // Отображаем категории с учетом иерархии
        var html = '';
        tree.forEach(function(root) {
            html += renderCategoryRow(root, 0, categories);
        });
        
        tbody.innerHTML = html;
    } catch (e) {
        console.error(e);
    }
}

async function openAddCategoryModal() {
    try {
        // Загружаем все категории для выбора родителя
        var categories = [];
        try {
            categories = await api('/admin/categories');
        } catch (e) {
            console.error('Failed to load categories:', e);
            categories = [];
        }
        
        // Строим опции для выбора родительской категории
        var parentOptions = '<option value="">Без батьківської категорії</option>';
        if (categories && categories.length > 0) {
            var tree = buildCategoryTree(categories);
            
            function buildOptions(cats, level) {
                var options = '';
                cats.forEach(function(cat) {
                    var indent = '&nbsp;'.repeat(level * 2);
                    options += '<option value="' + cat.id + '">' + indent + (level > 0 ? '└─ ' : '') + cat.name + '</option>';
                    if (cat.children && cat.children.length > 0) {
                        options += buildOptions(cat.children, level + 1);
                    }
                });
                return options;
            }
            
            parentOptions += buildOptions(tree, 0);
        }
        
        var html = '<form id="add-category-form">' +
            '<div class="form-group">' +
                '<label class="form-label">Назва *</label>' +
                '<input type="text" class="input" name="name" required>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">Батьківська категорія</label>' +
                '<select class="input" name="parent_id">' + parentOptions + '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="checkbox">' +
                    '<input type="checkbox" name="is_active" checked>' +
                    '<span>Активна</span>' +
                '</label>' +
            '</div>' +
            '<button type="submit" class="btn btn--primary btn--full">Створити</button>' +
            '</form>';
        
        openModal('Нова категорія', html);
        
        var form = document.getElementById('add-category-form');
        if (form) {
            // Удаляем старый обработчик, если он есть
            var newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            
            newForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                var name = e.target.name.value.trim();
                if (!name) {
                    showToast('Введіть назву категорії', 'error');
                    return;
                }
                
                var parentId = e.target.parent_id.value || null;
                var isActive = e.target.is_active.checked;
                
                try {
                    await api('/admin/categories', {
                        method: 'POST',
                        body: JSON.stringify({ 
                            name: name, 
                            slug: slugify(name),
                            parent_id: parentId ? parseInt(parentId) : null,
                            is_active: isActive
                        })
                    });
                    closeModal();
                    showToast('Категорію створено');
                    loadCategories();
                } catch (err) {
                    var errorMsg = err.message || 'Помилка створення категорії';
                    showToast(errorMsg, 'error');
                    console.error('Error creating category:', err);
                }
            });
        }
    } catch (err) {
        console.error('Error opening add category modal:', err);
        showToast('Помилка відкриття форми', 'error');
    }
}

window.editCategory = async function(id) {
    var categories = await api('/admin/categories');
    var cat = null;
    for (var i = 0; i < categories.length; i++) {
        if (categories[i].id == id) { cat = categories[i]; break; }
    }
    if (!cat) return;
    
    // Строим опции для выбора родительской категории (исключаем текущую и её дочерние)
    var parentOptions = '<option value="">Без батьківської категорії</option>';
    var tree = buildCategoryTree(categories);
    
    function buildOptions(cats, level, excludeId) {
        var options = '';
        cats.forEach(function(category) {
            // Исключаем текущую категорию и её дочерние
            if (category.id === excludeId) return;
            
            var indent = '&nbsp;'.repeat(level * 2);
            var selected = cat.parent_id === category.id ? ' selected' : '';
            options += '<option value="' + category.id + '"' + selected + '>' + indent + (level > 0 ? '└─ ' : '') + category.name + '</option>';
            if (category.children && category.children.length > 0) {
                options += buildOptions(category.children, level + 1, excludeId);
            }
        });
        return options;
    }
    
    parentOptions += buildOptions(tree, 0, id);
    
    var html = '<form id="edit-category-form">' +
        '<div class="form-group">' +
            '<label class="form-label">Назва</label>' +
            '<input type="text" class="input" name="name" value="' + (cat.name || '') + '" required>' +
        '</div>' +
        '<div class="form-group">' +
            '<label class="form-label">Батьківська категорія</label>' +
            '<select class="input" name="parent_id">' + parentOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
            '<label class="checkbox">' +
                '<input type="checkbox" name="is_active"' + (cat.is_active ? ' checked' : '') + '>' +
                '<span>Активна</span>' +
            '</label>' +
        '</div>' +
        '<button type="submit" class="btn btn--primary btn--full">Зберегти</button>' +
        '</form>';
    
    openModal('Редагувати категорію', html);
    
    document.getElementById('edit-category-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var name = e.target.name.value;
        var parentId = e.target.parent_id.value || null;
        var isActive = e.target.is_active.checked;
        
        try {
            await api('/admin/categories/' + id, {
                method: 'PATCH',
                body: JSON.stringify({ 
                    name: name, 
                    slug: slugify(name), 
                    parent_id: parentId ? parseInt(parentId) : null,
                    is_active: isActive 
                })
            });
            closeModal();
            showToast('Категорію оновлено');
            loadCategories();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
};

window.confirmDeleteCategory = function(id, name) {
    openConfirmModal('Видалити категорію "' + name + '"?', async function() {
        try {
            await api('/admin/categories/' + id, { method: 'DELETE' });
            showToast('Категорію видалено');
            loadCategories();
        } catch (e) {
            showToast('Помилка', 'error');
        }
    });
};

// Promotions
async function loadPromotions() {
    var searchEl = document.getElementById('promotions-search');
    var search = searchEl ? searchEl.value.toLowerCase() : '';
    
    try {
        var promos = await api('/promotions');
        
        // Filter by search
        if (search) {
            promos = promos.filter(function(p) {
                return p.name.toLowerCase().indexOf(search) !== -1 || 
                       (p.code && p.code.toLowerCase().indexOf(search) !== -1);
            });
        }
        
        var tbody = document.getElementById('promotions-table');
        if (!promos || !promos.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-text">Немає акцій</td></tr>';
            return;
        }
        
        tbody.innerHTML = promos.map(function(p) {
            var valueStr = p.type === 'percent' ? '-' + p.value + '%' : '-' + formatPrice(p.value);
            var targetCount = '—';
            if (p.scope === 'product' && p.target_ids) {
                try {
                    var ids = JSON.parse(p.target_ids);
                    targetCount = ids.length + ' шт';
                } catch(e) {}
            } else if (p.scope === 'all') {
                targetCount = 'Всі';
            }
            return '<tr><td><a href="#" class="product-link" onclick="viewPromo(' + p.id + '); return false;"><strong>' + p.name + '</strong></a></td><td><span class="discount-badge">' + valueStr + '</span></td><td>' + targetCount + '</td><td>' + formatDate(p.starts_at) + ' — ' + formatDate(p.ends_at) + '</td><td><span class="status status--' + (p.is_active ? 'active' : 'inactive') + '">' + (p.is_active ? 'Активна' : 'Неактивна') + '</span></td><td><button class="btn-icon" onclick="viewPromo(' + p.id + ')" title="Переглянути">👁</button><button class="btn-icon" onclick="editPromo(' + p.id + ')" title="Редагувати">✏️</button><button class="btn-icon" onclick="confirmDeletePromo(' + p.id + ')" title="Видалити">🗑</button></td></tr>';
        }).join('');
    } catch (e) {
        console.error(e);
    }
}

function openAddPromoModal() {
    showToast('Акції створюються через вибір товарів на сторінці Товари', 'error');
}

window.viewPromo = async function(id) {
    try {
        var promo = await api('/promotions/' + id);
        
        var valueStr = promo.type === 'percent' ? promo.value + '%' : formatPrice(promo.value);
        var scopeText = promo.scope === 'all' ? 'Всі товари' : (promo.scope === 'category' ? 'Категорія' : 'Обрані товари');
        var statusText = promo.is_active ? '<span class="status status--active">Активна</span>' : '<span class="status status--inactive">Неактивна</span>';
        
        var productsHtml = '';
        
        if (promo.scope === 'product' && promo.target_ids) {
            try {
                var ids = JSON.parse(promo.target_ids);
                if (ids.length > 0) {
                    // Загружаем товары
                    var allProducts = await api('/admin/products?page_size=100');
                    var products = (allProducts.items || allProducts).filter(function(p) {
                        return ids.indexOf(String(p.id)) !== -1 || ids.indexOf(p.id) !== -1;
                    });
                    
                    if (products.length > 0) {
                        productsHtml = '<div class="promo-products"><h4>Товари в акції (' + products.length + '):</h4><div class="promo-products__list">' + 
                            products.map(function(p) {
                                var imgHtml = p.primary_image ? '<img src="' + p.primary_image + '" alt="">' : '<div class="promo-product__no-img"></div>';
                                return '<div class="promo-product" onclick="closeModal(); viewProduct(' + p.id + ');">' +
                                    '<div class="promo-product__img">' + imgHtml + '</div>' +
                                    '<div class="promo-product__info">' +
                                        '<div class="promo-product__name">' + p.name + '</div>' +
                                        '<div class="promo-product__price">' + formatPrice(p.price) + '</div>' +
                                    '</div>' +
                                '</div>';
                            }).join('') +
                        '</div></div>';
                    }
                }
            } catch(e) {
                console.error(e);
            }
        } else if (promo.scope === 'all') {
            productsHtml = '<div class="promo-products"><p class="text-muted">Акція застосовується до всіх товарів</p></div>';
        }
        
        var html = '<div class="promo-view">' +
            '<div class="promo-view__info">' +
                '<div class="promo-view__row"><span class="promo-view__label">Назва:</span><span class="promo-view__value">' + promo.name + '</span></div>' +
                (promo.code ? '<div class="promo-view__row"><span class="promo-view__label">Код:</span><span class="promo-view__value"><strong>' + promo.code + '</strong></span></div>' : '') +
                '<div class="promo-view__row"><span class="promo-view__label">Тип:</span><span class="promo-view__value">' + (promo.type === 'percent' ? 'Відсоток' : 'Фіксована сума') + '</span></div>' +
                '<div class="promo-view__row"><span class="promo-view__label">Знижка:</span><span class="promo-view__value"><strong>' + valueStr + '</strong></span></div>' +
                '<div class="promo-view__row"><span class="promo-view__label">Область:</span><span class="promo-view__value">' + scopeText + '</span></div>' +
                '<div class="promo-view__row"><span class="promo-view__label">Період:</span><span class="promo-view__value">' + formatDate(promo.starts_at) + ' — ' + formatDate(promo.ends_at) + '</span></div>' +
                '<div class="promo-view__row"><span class="promo-view__label">Статус:</span><span class="promo-view__value">' + statusText + '</span></div>' +
            '</div>' +
            productsHtml +
            '<div class="promo-view__actions">' +
                '<button class="btn btn--primary" onclick="closeModal(); editPromo(' + promo.id + ');">Редагувати</button>' +
            '</div>' +
        '</div>';
        
        openModal('Акція: ' + promo.name, html);
    } catch (e) {
        showToast('Помилка завантаження', 'error');
    }
};

window.editPromo = async function(id) {
    try {
        var promo = await api('/promotions/' + id);
        
        var typeOptions = [
            { value: 'percent', label: 'Відсоток (%)' },
            { value: 'fixed', label: 'Фіксована сума (₴)' }
        ];
        var typeSelect = createCustomSelect('type', typeOptions, promo.type, 'Оберіть тип');
        
        var startsAt = promo.starts_at ? promo.starts_at.split('T')[0] : '';
        var endsAt = promo.ends_at ? promo.ends_at.split('T')[0] : '';
        
        openModal('Редагувати акцію', '<form id="edit-promo-form"><div class="form-group"><label class="form-label">Назва *</label><input type="text" class="input" name="name" value="' + promo.name + '" required></div><div class="form-row"><div class="form-group"><label class="form-label">Тип</label>' + typeSelect + '</div><div class="form-group"><label class="form-label">Значення</label><input type="number" class="input" name="value" value="' + promo.value + '" required></div></div><div class="form-row"><div class="form-group"><label class="form-label">Початок</label><input type="date" class="input" name="starts_at" value="' + startsAt + '"></div><div class="form-group"><label class="form-label">Кінець</label><input type="date" class="input" name="ends_at" value="' + endsAt + '"></div></div><div class="form-group"><label class="checkbox"><input type="checkbox" name="is_active"' + (promo.is_active ? ' checked' : '') + '><span>Активна</span></label></div><button type="submit" class="btn btn--primary btn--full">Зберегти</button></form>');
        
        initCustomSelects();
        
        document.getElementById('edit-promo-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            var form = e.target;
            
            try {
                await api('/promotions/' + id, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        name: form.name.value,
                        type: form.type.value,
                        value: parseFloat(form.value.value),
                        starts_at: form.starts_at.value ? form.starts_at.value + 'T00:00:00' : null,
                        ends_at: form.ends_at.value ? form.ends_at.value + 'T23:59:59' : null,
                        is_active: form.is_active.checked
                    })
                });
                closeModal();
                showToast('Акцію оновлено');
                loadPromotions();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    } catch (e) {
        showToast('Помилка завантаження', 'error');
    }
};

window.confirmDeletePromo = function(id) {
    openConfirmModal('Видалити акцію?', async function() {
        try {
            await api('/promotions/' + id, { method: 'DELETE' });
            showToast('Акцію видалено');
            loadPromotions();
        } catch (e) {
            showToast('Помилка', 'error');
        }
    });
};

// Users
async function loadUsers() {
    var searchEl = document.getElementById('users-search');
    var search = searchEl ? searchEl.value.toLowerCase() : '';
    
    try {
        var users = await api('/users');
        
        // Filter by search
        if (search) {
            users = users.filter(function(u) {
                return (u.email && u.email.toLowerCase().indexOf(search) !== -1) || 
                       (u.phone && u.phone.toLowerCase().indexOf(search) !== -1) ||
                       (u.first_name && u.first_name.toLowerCase().indexOf(search) !== -1) ||
                       (u.last_name && u.last_name.toLowerCase().indexOf(search) !== -1);
            });
        }
        
        var tbody = document.getElementById('users-table');
        if (!users || !users.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-text">Немає користувачів</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(function(u) {
            var name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
            var roleText = u.role === 'admin' ? '<span class="role-badge role-badge--admin">Адмін</span>' : 'Клієнт';
            var statusText = u.is_active ? '<span class="status status--active">Активний</span>' : '<span class="status status--inactive">Заблокований</span>';
            
            return '<tr><td>' + u.id + '</td><td>' + (u.email || '—') + '</td><td>' + (u.phone || '—') + '</td><td>' + name + '</td><td>' + roleText + '</td><td>' + statusText + '</td><td>' + formatDate(u.created_at) + '</td><td><button class="btn-icon" onclick="viewUser(' + u.id + ')" title="Переглянути">👁</button>' + (u.role !== 'admin' ? '<button class="btn-icon" onclick="toggleUserStatus(' + u.id + ', ' + u.is_active + ')" title="' + (u.is_active ? 'Заблокувати' : 'Розблокувати') + '">' + (u.is_active ? '🔒' : '🔓') + '</button>' : '') + '</td></tr>';
        }).join('');
    } catch (e) {
        console.error(e);
    }
}

window.viewUser = async function(id) {
    try {
        var u = await api('/users/' + id);
        var name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
        var roleText = u.role === 'admin' ? 'Адміністратор' : 'Клієнт';
        var statusText = u.is_active ? '<span class="status status--active">Активний</span>' : '<span class="status status--inactive">Заблокований</span>';
        
        var html = '<div class="user-view">' +
            '<div class="user-view__info">' +
                '<div class="user-view__row"><span class="user-view__label">ID:</span><span class="user-view__value">' + u.id + '</span></div>' +
                '<div class="user-view__row"><span class="user-view__label">Email:</span><span class="user-view__value">' + (u.email || '—') + '</span></div>' +
                '<div class="user-view__row"><span class="user-view__label">Телефон:</span><span class="user-view__value">' + (u.phone || '—') + '</span></div>' +
                '<div class="user-view__row"><span class="user-view__label">Ім\'я:</span><span class="user-view__value">' + name + '</span></div>' +
                '<div class="user-view__row"><span class="user-view__label">Роль:</span><span class="user-view__value">' + roleText + '</span></div>' +
                '<div class="user-view__row"><span class="user-view__label">Статус:</span><span class="user-view__value">' + statusText + '</span></div>' +
                '<div class="user-view__row"><span class="user-view__label">Реєстрація:</span><span class="user-view__value">' + formatDate(u.created_at) + '</span></div>' +
            '</div>' +
        '</div>';
        
        openModal('Користувач #' + u.id, html);
    } catch (e) {
        showToast('Помилка завантаження', 'error');
    }
};

window.toggleUserStatus = async function(id, currentStatus) {
    var action = currentStatus ? 'заблокувати' : 'розблокувати';
    openConfirmModal('Ви впевнені, що хочете ' + action + ' цього користувача?', async function() {
        try {
            await api('/users/' + id, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !currentStatus })
            });
            showToast('Статус оновлено');
            loadUsers();
        } catch (e) {
            showToast('Помилка', 'error');
        }
    });
};

// Modal
function openModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal-overlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('is-open');
    document.body.style.overflow = '';
}

function openConfirmModal(message, callback) {
    confirmCallback = callback;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-overlay').classList.add('is-open');
}

function closeConfirmModal() {
    document.getElementById('confirm-overlay').classList.remove('is-open');
    confirmCallback = null;
}

window.openImagePreview = function(url) {
    var overlay = document.createElement('div');
    overlay.className = 'image-preview-overlay';
    overlay.innerHTML = '<div class="image-preview"><img src="' + url + '" alt=""><button class="image-preview__close" onclick="this.parentElement.parentElement.remove()">×</button></div>';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
};

// Helpers
function formatPrice(val) {
    return new Intl.NumberFormat('uk-UA').format(val || 0) + ' ₴';
}

function formatDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('uk-UA');
}

function getStatusLabel(status) {
    var labels = { pending: 'Очікує', confirmed: 'Підтверджено', processing: 'Обробляється', shipped: 'Відправлено', delivered: 'Доставлено', cancelled: 'Скасовано' };
    return labels[status] || status;
}

function getPaymentTypeLabel(paymentType) {
    var labels = {
        'cash': 'Готівка',
        'card_on_delivery': 'Накладений платіж',
        'online': 'Онлайн'
    };
    return labels[paymentType] || paymentType;
}

function showToast(msg, type) {
    type = type || 'success';
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast is-visible toast--' + type;
    setTimeout(function() { toast.classList.remove('is-visible'); }, 3000);
}

function debounce(fn, ms) {
    var timeout;
    return function() {
        var args = arguments;
        var self = this;
        clearTimeout(timeout);
        timeout = setTimeout(function() { fn.apply(self, args); }, ms);
    };
}

function createCustomSelect(name, options, selectedValue, placeholder) {
    placeholder = placeholder || '— Оберіть —';
    var selectedText = placeholder;
    
    for (var i = 0; i < options.length; i++) {
        if (options[i].value == selectedValue) {
            selectedText = options[i].label;
            break;
        }
    }
    
    var optionsHtml = options.map(function(opt) {
        var selected = opt.value == selectedValue ? ' is-selected' : '';
        return '<div class="custom-select__option' + selected + '" data-value="' + opt.value + '">' + opt.label + '</div>';
    }).join('');
    
    return '<div class="custom-select" data-name="' + name + '"><input type="hidden" name="' + name + '" value="' + (selectedValue || '') + '"><button type="button" class="custom-select__trigger"><span class="custom-select__text' + (selectedValue ? '' : ' custom-select__placeholder') + '">' + selectedText + '</span></button><div class="custom-select__dropdown">' + optionsHtml + '</div></div>';
}

function initCustomSelects() {
    document.querySelectorAll('.custom-select').forEach(function(select) {
        var trigger = select.querySelector('.custom-select__trigger');
        var dropdown = select.querySelector('.custom-select__dropdown');
        var input = select.querySelector('input[type="hidden"]');
        var textEl = select.querySelector('.custom-select__text');
        
        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.custom-select.is-open').forEach(function(s) {
                if (s !== select) s.classList.remove('is-open');
            });
            
            select.classList.toggle('is-open');
        });
        
        dropdown.querySelectorAll('.custom-select__option').forEach(function(option) {
            option.addEventListener('click', function() {
                var value = option.dataset.value;
                var label = option.textContent;
                
                input.value = value;
                textEl.textContent = label;
                textEl.classList.remove('custom-select__placeholder');
                
                dropdown.querySelectorAll('.custom-select__option').forEach(function(o) {
                    o.classList.remove('is-selected');
                });
                option.classList.add('is-selected');
                
                select.classList.remove('is-open');
            });
        });
    });
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-select')) {
            document.querySelectorAll('.custom-select.is-open').forEach(function(s) {
                s.classList.remove('is-open');
            });
        }
    });
}

function slugify(str) {
    var map = {'а':'a','б':'b','в':'v','г':'g','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya'};
    var result = '';
    str = str.toLowerCase();
    for (var i = 0; i < str.length; i++) {
        var c = str[i];
        result += map[c] !== undefined ? map[c] : c;
    }
    return result.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
