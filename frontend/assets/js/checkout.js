/**
 * Checkout Page Module
 */

import { cart } from './state.js';
import { formatPrice, showToast, showFieldError, clearFieldErrors, setButtonLoading, initUI } from './ui.js';
import api from './api.js';
import { searchCities, getAllWarehouses, searchWarehouseByNumber } from './nova-poshta.js';

// === State ===
let deliveryCost = 0;

// === DOM Elements ===
const elements = {
    form: document.getElementById('checkout-form'),
    summaryItemsList: document.getElementById('summary-items-list'),
    summaryPositionsCount: document.getElementById('summary-positions-count'),
    summaryItemsCount: document.getElementById('summary-items-count'),
    summarySubtotal: document.getElementById('summary-subtotal'),
    summaryOriginalPriceRow: document.getElementById('summary-original-price-row'),
    summaryOriginalPrice: document.getElementById('summary-original-price'),
    summaryDiscountRow: document.getElementById('summary-discount-row'),
    summaryDiscount: document.getElementById('summary-discount'),
    summaryDelivery: document.getElementById('summary-delivery'),
    summaryTotal: document.getElementById('summary-total'),
    submitBtn: document.getElementById('submit-btn'),
    successModal: document.getElementById('success-modal'),
    orderNumber: document.getElementById('order-number'),
    deliveryNovaPoshta: document.getElementById('delivery-nova-poshta'),
    deliveryCourier: document.getElementById('delivery-courier'),
    paymentInfoCard: document.getElementById('payment-info-card'),
};

// === Init ===
function init() {
    // Initialize UI (header, cart count, etc.)
    initUI();
    
    // Redirect if cart is empty
    if (cart.getCount() === 0) {
        window.location.href = '/pages/cart';
        return;
    }
    
    renderMiniCart();
    updateSummary();
    initDeliveryToggle();
    initPaymentToggle();
    initNovaPoshtaAutocomplete();
    initFormValidation();
    initFormSubmit();
}

// === Mini Cart ===
function renderMiniCart() {
    if (!elements.summaryItemsList) return;
    
    const items = cart.getAll();
    const positionsCount = items.length;
    
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
    
    // Форматируем количество товаров
    const itemCount = cart.getCount();
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
    
    if (elements.summaryItemsCount) {
        elements.summaryItemsCount.textContent = itemsText;
    }
    
    // Рендерим список товаров (ТОЧНО КАК В КОРЗИНЕ)
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

// === Summary ===
function updateSummary() {
    const items = cart.getAll();
    const subtotal = cart.getTotal();
    
    // Подсчитываем общую экономию
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
            totalSavings += (oldPrice - basePrice) * item.qty;
            totalOriginalPrice += oldPrice * item.qty;
        } else if (hasPromoDiscount) {
            totalSavings += (basePrice - finalPrice) * item.qty;
            totalOriginalPrice += basePrice * item.qty;
        } else {
            totalOriginalPrice += basePrice * item.qty;
        }
    });
    
    // Обновляем подытог
    if (elements.summarySubtotal) {
        elements.summarySubtotal.textContent = formatPrice(subtotal);
    }
    
    // Показываем/скрываем оригинальную цену
    if (elements.summaryOriginalPriceRow && elements.summaryOriginalPrice) {
        if (totalSavings > 0 && totalOriginalPrice > subtotal) {
            elements.summaryOriginalPriceRow.style.display = 'flex';
            elements.summaryOriginalPrice.textContent = formatPrice(totalOriginalPrice);
        } else {
            elements.summaryOriginalPriceRow.style.display = 'none';
        }
    }
    
    // Показываем/скрываем экономию
    if (elements.summaryDiscountRow && elements.summaryDiscount) {
        if (totalSavings > 0) {
            elements.summaryDiscountRow.style.display = 'flex';
            elements.summaryDiscount.textContent = formatPrice(totalSavings);
        } else {
            elements.summaryDiscountRow.style.display = 'none';
        }
    }
    
    // Обновляем доставку
    // Бесплатная доставка при заказе от 1000 грн
    const FREE_DELIVERY_THRESHOLD = 1000;
    const isFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;
    const remainingForFreeDelivery = FREE_DELIVERY_THRESHOLD - subtotal;
    
    if (elements.summaryDelivery) {
        if (isFreeDelivery) {
            elements.summaryDelivery.textContent = 'Безкоштовно';
            deliveryCost = 0;
        } else {
            elements.summaryDelivery.textContent = 'За тарифами перевізника';
            // Стоимость доставки рассчитывается Новой Почтой, здесь не указываем точную сумму
            deliveryCost = 0; // Будет рассчитано при оформлении
            
            // Показываем подсказку о бесплатной доставке
            const deliveryHint = document.getElementById('delivery-hint');
            if (deliveryHint) {
                deliveryHint.style.display = 'block';
                deliveryHint.textContent = `Додайте товарів на ${formatPrice(remainingForFreeDelivery)} для безкоштовної доставки`;
            }
        }
    }
    
    // Скрываем подсказку если доставка бесплатная
    const deliveryHint = document.getElementById('delivery-hint');
    if (deliveryHint && isFreeDelivery) {
        deliveryHint.style.display = 'none';
    }
    
    // Обновляем итоговую сумму
    // Если доставка бесплатная, показываем только subtotal
    // Иначе показываем subtotal + "доставка за тарифами"
    const total = subtotal + deliveryCost;
    if (elements.summaryTotal) {
        elements.summaryTotal.textContent = formatPrice(Math.max(0, total));
    }
    
    // Показуємо інформацію про передоплату
    const prepaymentInfo = document.getElementById('prepayment-info');
    if (prepaymentInfo) {
        prepaymentInfo.style.display = 'block';
    }
}

// === Delivery Toggle ===
function initDeliveryToggle() {
    const radios = document.querySelectorAll('input[name="delivery_type"]');
    
    // Устанавливаем минимальную дату для поля даты доставки
    const deliveryDateInput = document.getElementById('delivery-date');
    if (deliveryDateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        deliveryDateInput.min = tomorrow.toISOString().split('T')[0];
    }
    
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            const value = radio.value;
            
            // Toggle fields visibility
            if (elements.deliveryNovaPoshta) {
                elements.deliveryNovaPoshta.style.display = value === 'nova_poshta' ? 'block' : 'none';
                // Обновляем required атрибуты
                const cityInput = document.getElementById('delivery-city');
                const warehouseInput = document.getElementById('delivery-warehouse');
                if (cityInput) cityInput.required = value === 'nova_poshta';
                if (warehouseInput) warehouseInput.required = value === 'nova_poshta';
            }
            if (elements.deliveryCourier) {
                elements.deliveryCourier.style.display = value === 'courier' ? 'block' : 'none';
                // Обновляем required атрибуты
                const streetInput = document.getElementById('delivery-street');
                const houseInput = document.getElementById('delivery-house');
                if (streetInput) streetInput.required = value === 'courier';
                if (houseInput) houseInput.required = value === 'courier';
            }
            
            // Update delivery cost
            // Тільки Нова Пошта доступна
            deliveryCost = 0; // Nova Poshta - calculated separately
            
            updateSummary();
        });
    });
    
    // Инициализируем видимость полей при загрузке
    const selectedDelivery = document.querySelector('input[name="delivery_type"]:checked')?.value;
    if (selectedDelivery) {
        const event = new Event('change');
        document.querySelector(`input[name="delivery_type"][value="${selectedDelivery}"]`)?.dispatchEvent(event);
    }
}

// === Payment Toggle ===
function initPaymentToggle() {
    // Тільки накладений платіж доступний, тому toggle не потрібен
    // Показуємо інфо про накладений платіж завжди
    if (elements.paymentInfoCard) {
        elements.paymentInfoCard.style.display = 'block';
    }
}

// === Form Validation ===
function initFormValidation() {
    if (!elements.form) return;
    
    // Real-time validation on blur
    elements.form.querySelectorAll('input[required]').forEach(input => {
        input.addEventListener('blur', () => {
            validateField(input);
        });
        
        // Clear error on input
        input.addEventListener('input', () => {
            input.classList.remove('input--error');
            const error = input.parentElement.querySelector('.form-error');
            if (error) error.remove();
        });
    });
}

function validateField(input) {
    const value = input.value.trim();
    let error = null;
    
    if (input.required && !value) {
        error = 'Це поле обов\'язкове';
    } else if (input.type === 'email' && value && !isValidEmail(value)) {
        error = 'Невірний формат email';
    } else if (input.type === 'tel' && value && !isValidPhone(value)) {
        error = 'Невірний формат телефону';
    }
    
    if (error) {
        showFieldError(input, error);
        return false;
    }
    
    return true;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    // Allow various formats
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^\+?[\d]{10,13}$/.test(cleaned);
}

function validateForm() {
    let isValid = true;
    
    elements.form.querySelectorAll('input[required]').forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });
    
    // Validate delivery fields based on type
    const deliveryType = elements.form.querySelector('input[name="delivery_type"]:checked')?.value;
    
    if (deliveryType === 'nova_poshta') {
        const city = document.getElementById('delivery-city');
        const warehouse = document.getElementById('delivery-warehouse');
        
        if (!city?.value.trim()) {
            showFieldError(city, 'Вкажіть місто');
            isValid = false;
        }
        if (!warehouse?.value.trim()) {
            showFieldError(warehouse, 'Вкажіть відділення або поштомат');
            isValid = false;
        }
    } else if (deliveryType === 'courier') {
        const street = document.getElementById('delivery-street');
        const house = document.getElementById('delivery-house');
        
        if (!street?.value.trim()) {
            showFieldError(street, 'Вкажіть вулицю');
            isValid = false;
        }
        if (!house?.value.trim()) {
            showFieldError(house, 'Вкажіть номер будинку');
            isValid = false;
        }
    }
    
    return isValid;
}

// === Form Submit ===
function initFormSubmit() {
    elements.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        clearFieldErrors(elements.form);
        
        if (!validateForm()) {
            showToast('Перевірте правильність заповнення форми', 'error');
            
            // Scroll to first error
            const firstError = elements.form.querySelector('.input--error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
            return;
        }
        
        await submitOrder();
    });
}

async function submitOrder() {
    setButtonLoading(elements.submitBtn, true);
    
    try {
        const formData = new FormData(elements.form);
        
        // Build order data
        const firstname = formData.get('customer_firstname') || '';
        const lastname = formData.get('customer_lastname') || '';
        const customerName = `${firstname} ${lastname}`.trim();
        
        // Формируем адрес доставки для курьера
        let deliveryAddress = null;
        const deliveryType = formData.get('delivery_type');
        if (deliveryType === 'courier') {
            const parts = [];
            const street = formData.get('delivery_street');
            const house = formData.get('delivery_house');
            const apartment = formData.get('delivery_apartment');
            const entrance = formData.get('delivery_entrance');
            const floor = formData.get('delivery_floor');
            const intercom = formData.get('delivery_intercom');
            
            if (street) parts.push(`вул. ${street}`);
            if (house) parts.push(house);
            if (apartment) parts.push(`кв. ${apartment}`);
            if (entrance) parts.push(`під'їзд ${entrance}`);
            if (floor) parts.push(`поверх ${floor}`);
            if (intercom) parts.push(`домофон ${intercom}`);
            
            deliveryAddress = parts.length > 0 ? parts.join(', ') : null;
        }
        
        const orderData = {
            items: cart.getAll().map(item => ({
                product_id: item.id,
                quantity: item.qty,
            })),
            customer_name: customerName,
            customer_phone: formData.get('customer_phone'),
            customer_email: formData.get('customer_email') || null,
            delivery_type: deliveryType,
            delivery_city: formData.get('delivery_city') || null,
            delivery_warehouse: formData.get('delivery_warehouse') || null,
            delivery_address: deliveryAddress,
            payment_type: formData.get('payment_type'),
            notes: formData.get('notes') || null,
        };
        
        const order = await api.createOrder(orderData);
        
        // Calculate totals from cart before clearing
        const items = cart.getAll();
        let subtotal = 0;
        let originalTotal = 0;
        
        items.forEach(item => {
            const basePrice = parseFloat(item.base_price || item.price) || 0;
            const finalPrice = parseFloat(item.price) || 0;
            const oldPrice = item.old_price ? parseFloat(item.old_price) : null;
            
            // Определяем, есть ли скидка
            const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
            const hasPromoDiscount = finalPrice < basePrice && item.discount_percent;
            
            if (hasDirectDiscount && oldPrice) {
                originalTotal += oldPrice * item.qty;
                subtotal += basePrice * item.qty;
            } else if (hasPromoDiscount) {
                originalTotal += basePrice * item.qty;
                subtotal += finalPrice * item.qty;
            } else {
                originalTotal += basePrice * item.qty;
                subtotal += finalPrice * item.qty;
            }
        });
        
        const discount = originalTotal > subtotal ? originalTotal - subtotal : 0;
        
        // Save order details to sessionStorage for display on success page
        const orderDetails = {
            order_number: order.order_number,
            items: items.map(item => {
                const basePrice = parseFloat(item.base_price || item.price) || 0;
                const finalPrice = parseFloat(item.price) || 0;
                const oldPrice = item.old_price ? parseFloat(item.old_price) : null;
                
                const hasDirectDiscount = oldPrice !== null && oldPrice > basePrice;
                const hasPromoDiscount = finalPrice < basePrice && item.discount_percent;
                
                let displayPrice = finalPrice;
                if (hasDirectDiscount && oldPrice) {
                    displayPrice = basePrice;
                } else if (hasPromoDiscount) {
                    displayPrice = finalPrice;
                }
                
                return {
                    product_name: item.name,
                    quantity: item.qty,
                    price: displayPrice,
                    total: displayPrice * item.qty,
                };
            }),
            subtotal: subtotal,
            discount: discount,
            delivery_cost: order.delivery_cost || 0,
            total: order.total,
            delivery_city: formData.get('delivery_city'),
            delivery_warehouse: formData.get('delivery_warehouse'),
            delivery_address: deliveryAddress,
        };
        
        sessionStorage.setItem('lastOrder', JSON.stringify(orderDetails));
        
        // Success! Clear cart
        cart.clear();
        
        // Redirect to success page
        window.location.href = `/pages/order-success?order=${order.order_number}`;
        
    } catch (e) {
        console.error('Order failed:', e);
        showToast(e.message || 'Помилка оформлення замовлення', 'error');
    }
    
    setButtonLoading(elements.submitBtn, false);
}

// === Nova Poshta Autocomplete ===
let selectedCityRef = null;
let selectedCityName = null;
let citySearchTimeout = null;
let warehouseSearchTimeout = null;

function initNovaPoshtaAutocomplete() {
    const cityInput = document.getElementById('delivery-city');
    const warehouseInput = document.getElementById('delivery-warehouse');
    const cityDropdown = document.getElementById('city-dropdown');
    const warehouseDropdown = document.getElementById('warehouse-dropdown');
    
    if (!cityInput || !warehouseInput || !cityDropdown || !warehouseDropdown) return;
    
    // City autocomplete
    cityInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(citySearchTimeout);
        
        if (query.length < 2) {
            cityDropdown.style.display = 'none';
            selectedCityRef = null;
            selectedCityName = null;
            warehouseInput.disabled = true;
            warehouseInput.value = '';
            const warehouseRefInput = document.getElementById('delivery-warehouse-ref');
            if (warehouseRefInput) warehouseRefInput.value = '';
            return;
        }
        
        citySearchTimeout = setTimeout(async () => {
            cityDropdown.innerHTML = '<div class="autocomplete-dropdown__loading">Завантаження...</div>';
            cityDropdown.style.display = 'block';
            
            try {
                const cities = await searchCities(query);
                
                if (cities.length === 0) {
                    cityDropdown.innerHTML = '<div class="autocomplete-dropdown__empty">Місто не знайдено</div>';
                    return;
                }
                
                cityDropdown.innerHTML = cities.map(city => `
                    <div class="autocomplete-dropdown__item" data-ref="${city.ref}" data-name="${city.name}">
                        <div class="autocomplete-dropdown__item-name">${city.name}</div>
                        ${city.area ? `<div class="autocomplete-dropdown__item-desc">${city.area}, ${city.region}</div>` : ''}
                    </div>
                `).join('');
                
                // Add click handlers
                cityDropdown.querySelectorAll('.autocomplete-dropdown__item').forEach(item => {
                    item.addEventListener('click', () => {
                        const cityName = item.dataset.name;
                        selectedCityRef = item.dataset.ref;
                        selectedCityName = cityName;
                        
                        cityInput.value = cityName;
                        cityDropdown.style.display = 'none';
                        
                        // Enable warehouse input and load warehouses
                        warehouseInput.disabled = false;
                        warehouseInput.value = '';
                        warehouseInput.placeholder = 'Оберіть відділення';
                        loadWarehouses(selectedCityRef, selectedCityName);
                    });
                });
            } catch (error) {
                console.error('Failed to search cities:', error);
                cityDropdown.innerHTML = '<div class="autocomplete-dropdown__empty">Помилка завантаження</div>';
            }
        }, 300);
    });
    
    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!cityInput.contains(e.target) && !cityDropdown.contains(e.target)) {
            cityDropdown.style.display = 'none';
        }
        if (!warehouseInput.contains(e.target) && !warehouseDropdown.contains(e.target)) {
            warehouseDropdown.style.display = 'none';
        }
    });
    
    // Warehouse autocomplete
    warehouseInput.addEventListener('input', (e) => {
        if (!selectedCityRef) return;
        
        const query = e.target.value.trim();
        
        clearTimeout(warehouseSearchTimeout);
        
        if (query.length < 1) {
            warehouseDropdown.style.display = 'none';
            return;
        }
        
        warehouseSearchTimeout = setTimeout(async () => {
            warehouseDropdown.innerHTML = '<div class="autocomplete-dropdown__loading">Завантаження...</div>';
            warehouseDropdown.style.display = 'block';
            
            try {
                const warehouses = await getAllWarehouses(selectedCityRef, selectedCityName);
                
                // Перевіряємо, чи запит - це тільки цифри (номер відділення/поштомата)
                const isNumberQuery = /^\d+$/.test(query.trim());
                const queryNumber = isNumberQuery ? query.trim() : null;
                
                let filtered = [];
                
                if (isNumberQuery) {
                    // Пошук по номеру - точне співпадіння та пошук в назві
                    // Використовуємо більш гнучку логіку для пошуку
                    filtered = warehouses.filter(wh => {
                        const number = (wh.number || '').trim();
                        const name = (wh.name || '').toLowerCase();
                        const queryLower = queryNumber.toLowerCase();
                        
                        // 1. Точне співпадіння номера (найвищий пріоритет)
                        if (number === queryNumber || number === String(queryNumber)) {
                            return true;
                        }
                        
                        // 2. Пошук номера в назві - різні формати
                        // Перевіряємо всі можливі варіанти написання номера
                        const searchPatterns = [
                            `№${queryNumber}`,
                            `#${queryNumber}`,
                            ` ${queryNumber} `,
                            ` ${queryNumber}`,
                            ` ${queryNumber},`,
                            ` ${queryNumber}.`,
                            `відділення ${queryNumber}`,
                            `відділення №${queryNumber}`,
                            `відділення #${queryNumber}`,
                            `поштомат ${queryNumber}`,
                            `поштомат №${queryNumber}`,
                            `поштомат #${queryNumber}`,
                            `поштомат${queryNumber}`, // без пробілу
                            `поштомат№${queryNumber}`, // без пробілу
                        ];
                        
                        // Перевіряємо всі патерни
                        for (const pattern of searchPatterns) {
                            if (name.includes(pattern.toLowerCase())) {
                                return true;
                            }
                        }
                        
                        // 3. Перевіряємо, чи номер закінчується на шуканий номер
                        if (name.endsWith(` ${queryNumber}`) || 
                            name.endsWith(`№${queryNumber}`) || 
                            name.endsWith(`#${queryNumber}`) ||
                            name.endsWith(` ${queryNumber}`) ||
                            name.endsWith(queryNumber)) {
                            return true;
                        }
                        
                        // 4. Використовуємо regex для пошуку номера як окремого значення
                        // Шукаємо номер, який не є частиною іншого числа
                        const numberRegex = new RegExp(`(?:^|[^\\d])${queryNumber}(?:[^\\d]|$)`, 'i');
                        if (numberRegex.test(name)) {
                            return true;
                        }
                        
                        return false;
                    });
                    
                    // Сортуємо: спочатку точні співпадіння по номеру, потім по назві
                    filtered.sort((a, b) => {
                        const aNumber = (a.number || '').trim();
                        const bNumber = (b.number || '').trim();
                        
                        // Точні співпадіння номера - на першому місці
                        const aExact = aNumber === queryNumber || aNumber === String(queryNumber);
                        const bExact = bNumber === queryNumber || bNumber === String(queryNumber);
                        
                        if (aExact && !bExact) return -1;
                        if (!aExact && bExact) return 1;
                        
                        // Потім сортуємо по номеру
                        if (aNumber && bNumber) {
                            const numA = parseInt(aNumber) || 0;
                            const numB = parseInt(bNumber) || 0;
                            if (numA !== numB) return numA - numB;
                        }
                        
                        return (a.name || '').localeCompare(b.name || '');
                    });
                } else {
                    // Текстовий пошук - шукаємо в назві та адресі
                    const normalizedQuery = query.toLowerCase().trim();
                    
                    filtered = warehouses.filter(wh => {
                        const name = (wh.name || '').toLowerCase();
                        const address = (wh.shortAddress || '').toLowerCase();
                        
                        // Пошук в назві
                        if (name.includes(normalizedQuery)) {
                            return true;
                        }
                        
                        // Пошук в адресі
                        if (address.includes(normalizedQuery)) {
                            return true;
                        }
                        
                        return false;
                    });
                }
                
                if (filtered.length === 0) {
                    warehouseDropdown.innerHTML = '<div class="autocomplete-dropdown__empty">Відділення не знайдено</div>';
                    return;
                }
                
                warehouseDropdown.innerHTML = filtered.map(wh => {
                    // Для поштоматов используем shortAddress, если он есть
                    const shortAddr = wh.shortAddress || '';
                    const displayName = wh.name || '';
                    const displayDesc = wh.type === 'Postomat' && shortAddr ? shortAddr : (shortAddr || displayName);
                    
                    return `
                    <div class="autocomplete-dropdown__item" 
                         data-ref="${wh.ref || ''}" 
                         data-name="${displayName}"
                         data-short-address="${shortAddr}"
                         data-type="${wh.type || ''}">
                        <div class="autocomplete-dropdown__item-name">
                            ${wh.type === 'Postomat' ? '📮 ' : '📦 '}
                            ${displayName}
                        </div>
                        <div class="autocomplete-dropdown__item-desc">${displayDesc}</div>
                    </div>
                    `;
                }).join('');
                
                // Add click handlers
                warehouseDropdown.querySelectorAll('.autocomplete-dropdown__item').forEach(item => {
                    item.addEventListener('click', () => {
                        const warehouseName = item.dataset.name;
                        const warehouseRef = item.dataset.ref;
                        const warehouseType = item.dataset.type;
                        const shortAddress = item.dataset.shortAddress || '';
                        
                        // Для поштомата используем shortAddress (если есть), иначе название
                        // Для отделения используем название
                        let displayValue = warehouseName;
                        if (warehouseType === 'Postomat') {
                            if (shortAddress && shortAddress.trim()) {
                                displayValue = shortAddress.trim();
                            } else if (warehouseName && warehouseName.trim() && warehouseName.trim() !== 'Поштомат') {
                                displayValue = warehouseName.trim();
                            } else {
                                displayValue = warehouseName || 'Поштомат';
                            }
                        }
                        
                        warehouseInput.value = displayValue;
                        const warehouseRefInput = document.getElementById('delivery-warehouse-ref');
                        if (warehouseRefInput) warehouseRefInput.value = warehouseRef;
                        warehouseDropdown.style.display = 'none';
                    });
                });
            } catch (error) {
                console.error('Failed to search warehouses:', error);
                warehouseDropdown.innerHTML = '<div class="autocomplete-dropdown__empty">Помилка завантаження</div>';
            }
        }, 300);
    });
}

async function loadWarehouses(cityRef, cityName = null) {
    const warehouseInput = document.getElementById('delivery-warehouse');
    const warehouseDropdown = document.getElementById('warehouse-dropdown');
    
    if (!warehouseInput || !warehouseDropdown) return;
    
    warehouseDropdown.innerHTML = '<div class="autocomplete-dropdown__loading">Завантаження відділень...</div>';
    warehouseDropdown.style.display = 'block';
    
    try {
        const warehouses = await getAllWarehouses(cityRef, cityName);
        
        if (warehouses.length === 0) {
            warehouseDropdown.innerHTML = '<div class="autocomplete-dropdown__empty">Відділення не знайдено</div>';
            return;
        }
        
        warehouseDropdown.innerHTML = warehouses.map(wh => {
            // Для поштоматов используем shortAddress, если он есть
            const shortAddr = wh.shortAddress || '';
            const displayName = wh.name || '';
            const displayDesc = wh.type === 'Postomat' && shortAddr ? shortAddr : (shortAddr || displayName);
            
            return `
            <div class="autocomplete-dropdown__item" 
                 data-ref="${wh.ref || ''}" 
                 data-name="${displayName}"
                 data-short-address="${shortAddr}"
                 data-type="${wh.type || ''}">
                <div class="autocomplete-dropdown__item-name">
                    ${wh.type === 'Postomat' ? '📮 ' : '📦 '}
                    ${displayName}
                </div>
                <div class="autocomplete-dropdown__item-desc">${displayDesc}</div>
            </div>
            `;
        }).join('');
        
        // Add click handlers
        warehouseDropdown.querySelectorAll('.autocomplete-dropdown__item').forEach(item => {
            item.addEventListener('click', () => {
                const warehouseName = item.dataset.name;
                const warehouseRef = item.dataset.ref;
                const warehouseType = item.dataset.type;
                const shortAddress = item.dataset.shortAddress || '';
                
                // Для поштомата используем shortAddress (если есть), иначе название
                // Для отделения используем название
                let displayValue = warehouseName;
                if (warehouseType === 'Postomat') {
                    if (shortAddress && shortAddress.trim()) {
                        displayValue = shortAddress.trim();
                    } else if (warehouseName && warehouseName.trim() && warehouseName.trim() !== 'Поштомат') {
                        displayValue = warehouseName.trim();
                    } else {
                        displayValue = warehouseName || 'Поштомат';
                    }
                }
                
                warehouseInput.value = displayValue;
                const warehouseRefInput = document.getElementById('delivery-warehouse-ref');
                if (warehouseRefInput) warehouseRefInput.value = warehouseRef;
                warehouseDropdown.style.display = 'none';
            });
        });
    } catch (error) {
        console.error('Failed to load warehouses:', error);
        warehouseDropdown.innerHTML = '<div class="autocomplete-dropdown__empty">Помилка завантаження</div>';
    }
}

// === Start ===
document.addEventListener('DOMContentLoaded', init);



