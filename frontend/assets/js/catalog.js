/**
 * Catalog Page Module
 * Fashion-style каталог с фильтрами
 */

import api from './api.js';
import { cart, favorites, on } from './state.js';
import { 
    formatPrice, 
    showToast, 
    updateCartCount,
    animatePulse,
    animateCartIcon 
} from './ui.js';

// === State ===
let currentFilters = {
    category: [],
    q: null,
    min_price: null,
    max_price: null,
    in_stock: true, // По умолчанию включен
    on_sale: null,
    sort: 'newest',
    page: 1,
    page_size: 25,
};

let allProducts = [];
let hasMoreProducts = false;

let categories = [];

// === DOM Elements ===
const elements = {
    grid: document.getElementById('catalog-grid'),
    pagination: document.getElementById('pagination'),
    productsCount: document.getElementById('products-count'),
    sidebar: document.getElementById('catalog-sidebar'),
    overlay: document.getElementById('filter-overlay'),
    filterClose: document.getElementById('filter-close'),
    categoryFilters: document.getElementById('category-filters'),
    priceMin: document.getElementById('price-min'),
    priceMax: document.getElementById('price-max'),
    filterInStock: document.getElementById('filter-in-stock'),
    filterOnSale: document.getElementById('filter-on-sale'),
    applyFilters: document.getElementById('apply-filters'),
    resetFilters: document.getElementById('reset-filters'),
    searchInput: document.getElementById('search-input'),
};

// === Init ===
async function init() {
    // Load initial params from URL
    loadFiltersFromURL();
    
    // Init UI
    initUI();
    updateCartCount();
    
    // Load data
    await Promise.all([
        loadCategories(),
        loadProducts(),
    ]);
    
    // Render active filters after loading
    renderActiveFilters();
    
    // Subscribe to state changes
    on('cart:updated', updateCartCount);
}

function initUI() {
    // Header scroll
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 10);
        }, { passive: true });
    }
    
    // Filter toggle (mobile)
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
        filterToggle.addEventListener('click', openFilters);
    }
    
    // Filter panel close
    elements.filterClose?.addEventListener('click', closeFilters);
    elements.overlay?.addEventListener('click', closeFilters);
    
    // Filter accordion
    initFilterAccordion();
    
    // Category search
    const categorySearch = document.getElementById('category-search');
    if (categorySearch) {
        let searchTimeout;
        categorySearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                renderCategories(e.target.value);
            }, 300);
        });
    }
    
    // Sort change - custom select
    initSortSelect();
    
    // Price range slider
    initPriceRange();
    
    // Quick filters (in stock, on sale)
    initQuickFilters();
    
    // Apply filters
    elements.applyFilters?.addEventListener('click', () => {
        applyFiltersFromInputs();
        closeFilters();
    });
    
    // Reset filters
    elements.resetFilters?.addEventListener('click', () => {
        resetAllFilters();
        closeFilters();
    });
    
    // Search
    const searchClear = document.getElementById('search-clear');
    let searchTimeout;
    
    elements.searchInput?.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        
        // Show/hide clear button
        if (searchClear) {
            searchClear.style.display = value ? 'flex' : 'none';
        }
        
        // Debounce search
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.q = value || null;
            currentFilters.page = 1;
            allProducts = [];
            loadProducts();
            updateURL();
            updateActiveFiltersCount();
        }, 500);
    });
    
    // Clear search
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            if (elements.searchInput) {
                elements.searchInput.value = '';
                elements.searchInput.focus();
            }
            searchClear.style.display = 'none';
            currentFilters.q = null;
            currentFilters.page = 1;
            allProducts = [];
            loadProducts();
            updateURL();
            updateActiveFiltersCount();
        });
    }
    
    // Set initial sort value
    const sortWrapper = document.getElementById('sort-select-wrapper');
    if (sortWrapper) {
        const textEl = sortWrapper.querySelector('.custom-select__text');
        const option = sortWrapper.querySelector(`[data-value="${currentFilters.sort}"]`);
        if (textEl && option) {
            textEl.textContent = option.textContent;
            sortWrapper.querySelectorAll('.custom-select__option').forEach(opt => {
                opt.classList.toggle('is-selected', opt === option);
            });
        }
    }
}

// === Price Range ===
let priceMin = 0;
let priceMax = 10000;
let maxProductPrice = 10000; // Будет обновляться при загрузке товаров

function updatePriceRangeMax() {
    // Находим максимальную цену среди всех загруженных товаров
    if (allProducts && allProducts.length > 0) {
        const prices = allProducts.map(p => {
            // Используем final_price если есть, иначе price
            return parseFloat(p.final_price || p.price || 0);
        });
        const maxPrice = Math.max(...prices);
        if (maxPrice > 0) {
            // Округляем вверх до ближайших 100
            maxProductPrice = Math.ceil(maxPrice / 100) * 100;
            
            // Обновляем слайдеры
            const minSlider = document.getElementById('price-min-slider');
            const maxSlider = document.getElementById('price-max-slider');
            if (minSlider) {
                minSlider.max = maxProductPrice;
                minSlider.step = 10;
            }
            if (maxSlider) {
                maxSlider.max = maxProductPrice;
                maxSlider.step = 10;
                // Если текущее значение больше нового максимума, обновляем
                if (parseInt(maxSlider.value) > maxProductPrice) {
                    maxSlider.value = maxProductPrice;
                    priceMax = maxProductPrice;
                    const maxDisplay = document.getElementById('price-max-display');
                    const maxInput = document.getElementById('price-max');
                    if (maxDisplay) maxDisplay.textContent = maxProductPrice.toLocaleString('uk-UA');
                    if (maxInput) maxInput.value = '';
                }
            }
        }
    }
}

function initPriceRange() {
    const minSlider = document.getElementById('price-min-slider');
    const maxSlider = document.getElementById('price-max-slider');
    const minInput = document.getElementById('price-min');
    const maxInput = document.getElementById('price-max');
    const minDisplay = document.getElementById('price-min-display');
    const maxDisplay = document.getElementById('price-max-display');
    
    if (!minSlider || !maxSlider || !minInput || !maxInput) return;
    
    // Устанавливаем начальное максимальное значение
    maxSlider.max = maxProductPrice;
    
    // Синхронизация слайдеров с инпутами
    function updateFromSliders() {
        priceMin = parseInt(minSlider.value);
        priceMax = parseInt(maxSlider.value);
        
        // Убеждаемся, что min <= max
        if (priceMin > priceMax) {
            priceMin = priceMax;
            minSlider.value = priceMin;
        }
        
        minInput.value = priceMin || '';
        maxInput.value = priceMax >= maxProductPrice ? '' : priceMax;
        
        minDisplay.textContent = priceMin.toLocaleString('uk-UA');
        maxDisplay.textContent = priceMax >= maxProductPrice ? '∞' : priceMax.toLocaleString('uk-UA');
        
        // Применяем фильтры автоматически
        currentFilters.min_price = priceMin > 0 ? priceMin : null;
        currentFilters.max_price = priceMax < 10000 ? priceMax : null;
        currentFilters.page = 1;
        allProducts = [];
        loadProducts();
        updateURL();
        updateActiveFiltersCount();
    }
    
    function updateFromInputs() {
        const minVal = parseInt(minInput.value) || 0;
        const maxVal = parseInt(maxInput.value) || maxProductPrice;
        
        priceMin = Math.max(0, Math.min(minVal, maxProductPrice));
        priceMax = Math.max(priceMin, Math.min(maxVal, maxProductPrice));
        
        minSlider.value = priceMin;
        maxSlider.value = priceMax;
        
        minDisplay.textContent = priceMin.toLocaleString('uk-UA');
        maxDisplay.textContent = priceMax >= maxProductPrice ? '∞' : priceMax.toLocaleString('uk-UA');
        
        // Применяем фильтры автоматически
        currentFilters.min_price = priceMin > 0 ? priceMin : null;
        currentFilters.max_price = priceMax < maxProductPrice ? priceMax : null;
        currentFilters.page = 1;
        allProducts = [];
        loadProducts();
        updateURL();
        updateActiveFiltersCount();
    }
    
    // События для слайдеров
    minSlider.addEventListener('input', updateFromSliders);
    maxSlider.addEventListener('input', updateFromSliders);
    
    // События для инпутов (с debounce)
    let inputTimeout;
    minInput.addEventListener('input', () => {
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(updateFromInputs, 500);
    });
    maxInput.addEventListener('input', () => {
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(updateFromInputs, 500);
    });
    
    // Инициализация из URL
    if (currentFilters.min_price) {
        priceMin = parseInt(currentFilters.min_price);
        minSlider.value = priceMin;
        minInput.value = priceMin;
    }
    if (currentFilters.max_price) {
        priceMax = parseInt(currentFilters.max_price);
        maxSlider.value = priceMax;
        maxInput.value = priceMax;
    }
    
    minDisplay.textContent = priceMin.toLocaleString('uk-UA');
    maxDisplay.textContent = priceMax >= maxProductPrice ? '∞' : priceMax.toLocaleString('uk-UA');
    
    // Обновляем максимум после первой загрузки товаров
    if (allProducts && allProducts.length > 0) {
        updatePriceRangeMax();
    }
}

// === Quick Filters ===
function initQuickFilters() {
    // In stock filter
    elements.filterInStock?.addEventListener('change', (e) => {
        currentFilters.in_stock = e.target.checked ? true : null;
        currentFilters.page = 1;
        allProducts = [];
        loadProducts();
        updateURL();
        renderActiveFilters();
    });
    
    // On sale filter
    elements.filterOnSale?.addEventListener('change', (e) => {
        currentFilters.on_sale = e.target.checked ? true : null;
        currentFilters.page = 1;
        allProducts = [];
        loadProducts();
        updateURL();
        renderActiveFilters();
    });
}

// === Filters Panel ===
function openFilters() {
    elements.sidebar?.classList.add('is-open');
    elements.overlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeFilters() {
    elements.sidebar?.classList.remove('is-open');
    elements.overlay?.classList.remove('is-open');
    document.body.style.overflow = '';
}

function applyFiltersFromInputs() {
    // Цена уже применяется автоматически в initPriceRange
    currentFilters.in_stock = elements.filterInStock?.checked || null;
    currentFilters.on_sale = elements.filterOnSale?.checked || null;
    currentFilters.page = 1;
    
    allProducts = [];
    loadProducts();
    updateURL();
    updateActiveFiltersCount();
}

function resetAllFilters() {
    currentFilters = {
        ...currentFilters,
        category: [],
        q: null,
        min_price: null,
        max_price: null,
        in_stock: true, // По умолчанию включен
        on_sale: null,
        page: 1,
        page_size: 25,
    };
    
    // Reset inputs
    priceMin = 0;
    priceMax = maxProductPrice;
    const minSlider = document.getElementById('price-min-slider');
    const maxSlider = document.getElementById('price-max-slider');
    const minDisplay = document.getElementById('price-min-display');
    const maxDisplay = document.getElementById('price-max-display');
    if (minSlider) minSlider.value = 0;
    if (maxSlider) {
        maxSlider.value = maxProductPrice;
        maxSlider.max = maxProductPrice;
    }
    if (elements.priceMin) elements.priceMin.value = '';
    if (elements.priceMax) elements.priceMax.value = '';
    if (minDisplay) minDisplay.textContent = '0';
    if (maxDisplay) maxDisplay.textContent = '∞';
    if (elements.filterInStock) elements.filterInStock.checked = true;
    if (elements.filterOnSale) elements.filterOnSale.checked = false;
    if (elements.searchInput) elements.searchInput.value = '';
    
    // Reset category UI
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.toggle('is-active', !item.dataset.category);
    });
    
    allProducts = [];
    loadProducts();
    updateURL();
    updateActiveFiltersCount();
}

function updateActiveFiltersCount() {
    renderActiveFilters();
}

function renderActiveFilters() {
    const container = document.getElementById('active-filters-tags');
    if (!container) return;
    
    const tags = [];
    
    // Categories
    if (currentFilters.category && currentFilters.category.length > 0) {
        currentFilters.category.forEach(categorySlug => {
            const category = categories.find(c => c.slug === categorySlug);
            if (category) {
                tags.push({
                    type: 'category',
                    label: category.name,
                    value: categorySlug
                });
            }
        });
    }
    
    // Price
    if (currentFilters.min_price || currentFilters.max_price) {
        const min = currentFilters.min_price || 0;
        const max = currentFilters.max_price || '∞';
        tags.push({
            type: 'price',
            label: `Ціна: ${min} - ${max} ₴`,
            value: 'price'
        });
    }
    
    // In stock
    if (currentFilters.in_stock) {
        tags.push({
            type: 'in_stock',
            label: 'В наявності',
            value: 'in_stock'
        });
    }
    
    // On sale
    if (currentFilters.on_sale) {
        tags.push({
            type: 'on_sale',
            label: 'Зі знижкою',
            value: 'on_sale'
        });
    }
    
    if (tags.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = tags.map(tag => `
        <span class="filter-tag" data-filter-value="${tag.value || ''}">
            <span class="filter-tag__label">${tag.label}</span>
            <button class="filter-tag__remove" data-filter-type="${tag.type}" aria-label="Видалити">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </span>
    `).join('');
    
    // Add remove handlers
    container.querySelectorAll('.filter-tag__remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.filterType;
            
            switch(type) {
                case 'category':
                    const categorySlug = btn.closest('.filter-tag').dataset.filterValue;
                    if (categorySlug) {
                        currentFilters.category = currentFilters.category.filter(c => c !== categorySlug);
                        // Update UI
                        document.querySelectorAll('.category-item').forEach(item => {
                            const slug = item.dataset.category || '';
                            if (!slug) {
                                // "All categories" is active only when no categories selected
                                if (currentFilters.category.length === 0) {
                                    item.classList.add('is-active');
                                } else {
                                    item.classList.remove('is-active');
                                }
                            } else {
                                if (currentFilters.category.includes(slug)) {
                                    item.classList.add('is-active');
                                } else {
                                    item.classList.remove('is-active');
                                }
                            }
                        });
                    }
                    break;
                case 'price':
                    currentFilters.min_price = null;
                    currentFilters.max_price = null;
                    if (elements.priceMin) elements.priceMin.value = '';
                    if (elements.priceMax) elements.priceMax.value = '';
                    break;
                case 'in_stock':
                    currentFilters.in_stock = true; // Возвращаем к дефолту
                    if (elements.filterInStock) elements.filterInStock.checked = true;
                    break;
                case 'on_sale':
                    currentFilters.on_sale = null;
                    if (elements.filterOnSale) elements.filterOnSale.checked = false;
                    break;
            }
            
            currentFilters.page = 1;
            allProducts = [];
            loadProducts();
            updateURL();
            updateActiveFiltersCount();
        });
    });
}

// === URL Sync ===
function loadFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    // Support both single category and multiple categories
    const categoryParam = params.getAll('category');
    currentFilters.category = categoryParam.length > 0 ? categoryParam : [];
    currentFilters.q = params.get('q');
    currentFilters.min_price = params.get('min_price');
    currentFilters.max_price = params.get('max_price');
    // Если параметр in_stock явно указан в URL, используем его, иначе по умолчанию true
    const inStockParam = params.get('in_stock');
    currentFilters.in_stock = inStockParam === 'false' ? null : (inStockParam === 'true' ? true : true);
    currentFilters.on_sale = params.get('on_sale') === 'true' ? true : null;
    currentFilters.sort = params.get('sort') || 'newest';
    currentFilters.page = parseInt(params.get('page')) || 1;
    
    // Update price inputs and sliders
    if (currentFilters.min_price) {
        priceMin = parseInt(currentFilters.min_price);
        const minSlider = document.getElementById('price-min-slider');
        const minDisplay = document.getElementById('price-min-display');
        if (minSlider) minSlider.value = priceMin;
        if (elements.priceMin) elements.priceMin.value = priceMin;
        if (minDisplay) minDisplay.textContent = priceMin.toLocaleString('uk-UA');
    }
    if (currentFilters.max_price) {
        priceMax = parseInt(currentFilters.max_price);
        const maxSlider = document.getElementById('price-max-slider');
        const maxDisplay = document.getElementById('price-max-display');
        if (maxSlider) maxSlider.value = priceMax;
        if (elements.priceMax) elements.priceMax.value = priceMax;
        if (maxDisplay) maxDisplay.textContent = priceMax.toLocaleString('uk-UA');
    }
    if (elements.filterInStock) {
        elements.filterInStock.checked = currentFilters.in_stock === true;
    }
    if (elements.filterOnSale) {
        elements.filterOnSale.checked = currentFilters.on_sale || false;
    }
    if (elements.searchInput && currentFilters.q) {
        elements.searchInput.value = currentFilters.q;
    }
    
    updateActiveFiltersCount();
}

function updateURL() {
    const params = new URLSearchParams();
    
    // Add all categories as separate parameters
    if (currentFilters.category && currentFilters.category.length > 0) {
        currentFilters.category.forEach(cat => {
            params.append('category', cat);
        });
    }
    if (currentFilters.q) params.set('q', currentFilters.q);
    if (currentFilters.min_price) params.set('min_price', currentFilters.min_price);
    if (currentFilters.max_price) params.set('max_price', currentFilters.max_price);
    if (currentFilters.in_stock) params.set('in_stock', 'true');
    if (currentFilters.on_sale) params.set('on_sale', 'true');
    if (currentFilters.sort !== 'newest') params.set('sort', currentFilters.sort);
    if (currentFilters.page > 1) params.set('page', currentFilters.page);
    
    const newURL = params.toString() 
        ? `${window.location.pathname}?${params}` 
        : window.location.pathname;
    
    history.replaceState(null, '', newURL);
}

// === Data Loading ===
async function loadCategories() {
    try {
        categories = await api.getCategories();
        renderCategories();
    } catch (e) {
        console.error('Failed to load categories:', e);
    }
}

function renderCategories(searchQuery = '') {
    if (!elements.categoryFilters) return;
    
    // Filter categories by search
    let filteredCategories = categories.filter(cat => {
        if (!searchQuery) return true;
        return cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
    
    // If searching, include parent categories of matching children
    if (searchQuery) {
        const matchingIds = new Set(filteredCategories.map(c => c.id));
        const parentIds = new Set();
        
        filteredCategories.forEach(cat => {
            if (cat.parent_id) {
                parentIds.add(cat.parent_id);
            }
        });
        
        // Add parent categories that aren't already in the list
        categories.forEach(cat => {
            if (parentIds.has(cat.id) && !matchingIds.has(cat.id)) {
                filteredCategories.push(cat);
                matchingIds.add(cat.id);
            }
        });
    }
    
    // Build category hierarchy
    const categoryMap = new Map();
    const rootCategories = [];
    
    // First pass: create map
    filteredCategories.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] });
    });
    
    // Second pass: build tree
    filteredCategories.forEach(cat => {
        const category = categoryMap.get(cat.id);
        if (cat.parent_id && categoryMap.has(cat.parent_id)) {
            // This is a child category
            categoryMap.get(cat.parent_id).children.push(category);
        } else {
            // This is a root category
            rootCategories.push(category);
        }
    });
    
    // Sort root categories by sort_order
    rootCategories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    // Show "All" option (only active when no categories selected)
    const hasSelectedCategories = currentFilters.category && currentFilters.category.length > 0;
    const allOption = `
        <button class="category-item ${!hasSelectedCategories ? 'is-active' : ''}"
                data-category="">
            <span class="category-item__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 7h16M4 12h16M4 17h7"/>
                </svg>
            </span>
            <span class="category-item__name">Всі категорії</span>
        </button>
    `;
    
    // Render category recursively
    function renderCategory(cat, level = 0) {
        const isActive = currentFilters.category && currentFilters.category.includes(cat.slug);
        const count = cat.product_count || '';
        const isChild = level > 0;
        const hasChildren = cat.children && cat.children.length > 0;
        
        // Sort children by sort_order
        if (hasChildren) {
            cat.children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        }
        
        // Check if any child is selected (to auto-expand)
        const hasActiveChild = hasChildren && cat.children.some(child => 
            currentFilters.category && currentFilters.category.includes(child.slug)
        );
        const isExpanded = hasActiveChild; // Auto-expand if child is selected
        
        let html = `
            <div class="category-group" data-category-id="${cat.id}">
                <button class="category-item ${isActive ? 'is-active' : ''} ${isChild ? 'category-item--child' : ''} ${hasChildren ? 'category-item--has-children' : ''}"
                        data-category="${cat.slug}"
                        data-has-children="${hasChildren ? 'true' : 'false'}"
                        style="padding-left: ${16 + level * 24}px;">
                    <span class="category-item__icon">
                        ${isChild ? `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        ` : `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 0 1.946-.806A3.42 3.42 0 0 0 21 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V3a3.42 3.42 0 0 0 1.835.697z"/>
                            </svg>
                        `}
                    </span>
                    <span class="category-item__name">${cat.name}</span>
                    ${count ? `<span class="category-item__count">${count}</span>` : ''}
                </button>
                ${hasChildren ? `
                    <div class="category-children ${isExpanded ? 'is-expanded' : ''}">
                        ${cat.children.map(child => renderCategory(child, level + 1)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        return html;
    }
    
    // Render all categories
    const categoriesHtml = rootCategories.map(cat => renderCategory(cat, 0)).join('');
    
    elements.categoryFilters.innerHTML = allOption + categoriesHtml;
    
    // Initialize expanded state for categories with active children (no toggle icon needed)
    
    // Helper function to get all child category slugs recursively
    function getAllChildSlugs(parentSlug) {
        const parentCat = categories.find(c => c.slug === parentSlug);
        if (!parentCat) return [];
        
        const childSlugs = [];
        const parentId = parentCat.id;
        
        function collectChildren(parentId) {
            categories.forEach(cat => {
                if (cat.parent_id === parentId) {
                    childSlugs.push(cat.slug);
                    collectChildren(cat.id);
                }
            });
        }
        
        collectChildren(parentId);
        return childSlugs;
    }
    
    // Helper function to get parent category slug
    function getParentSlug(childSlug) {
        const childCat = categories.find(c => c.slug === childSlug);
        if (!childCat || !childCat.parent_id) return null;
        
        const parentCat = categories.find(c => c.id === childCat.parent_id);
        return parentCat ? parentCat.slug : null;
    }
    
    // Add click handlers for category selection
    elements.categoryFilters.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const slug = item.dataset.category || '';
            const hasChildren = item.dataset.hasChildren === 'true';
            
            let wasActive = false;
            
            // Check if category is already selected
            if (slug) {
                if (!currentFilters.category) {
                    currentFilters.category = [];
                }
                wasActive = currentFilters.category.includes(slug);
            }
            
            // Handle expand/collapse for categories with children
            if (hasChildren) {
                const categoryGroup = item.closest('.category-group');
                const childrenContainer = categoryGroup?.querySelector('.category-children');
                
                if (childrenContainer) {
                    const isExpanded = childrenContainer.classList.contains('is-expanded');
                    
                    // If clicking on already selected and expanded category - collapse it
                    if (wasActive && isExpanded) {
                        childrenContainer.classList.remove('is-expanded');
                    } else if (!isExpanded) {
                        // Expand if collapsed
                        childrenContainer.classList.add('is-expanded');
                    }
                }
            }
            
            // Handle "All categories" click
            if (!slug) {
                wasActive = currentFilters.category.length === 0;
                currentFilters.category = [];
            } else {
                if (!currentFilters.category) {
                    currentFilters.category = [];
                }
                
                // wasActive already checked above
                if (hasChildren) {
                    // Parent category selected
                    if (wasActive) {
                        // Remove parent and all its children
                        const childSlugs = getAllChildSlugs(slug);
                        currentFilters.category = currentFilters.category.filter(
                            c => c !== slug && !childSlugs.includes(c)
                        );
                    } else {
                        // Add parent and all its children, remove children if they were selected separately
                        const childSlugs = getAllChildSlugs(slug);
                        currentFilters.category = currentFilters.category.filter(
                            c => !childSlugs.includes(c)
                        );
                        currentFilters.category.push(slug);
                        currentFilters.category.push(...childSlugs);
                    }
                } else {
                    // Child category selected
                    const parentSlug = getParentSlug(slug);
                    
                    if (wasActive) {
                        // Remove only this child
                        currentFilters.category = currentFilters.category.filter(c => c !== slug);
                    } else {
                        // Add only this child, remove parent if it was selected
                        if (parentSlug && currentFilters.category.includes(parentSlug)) {
                            // Remove parent and all its other children
                            const allChildSlugs = getAllChildSlugs(parentSlug);
                            currentFilters.category = currentFilters.category.filter(
                                c => c !== parentSlug && !allChildSlugs.includes(c)
                            );
                        }
                        currentFilters.category.push(slug);
                    }
                }
            }
            
            // Update all buttons based on current selection
            document.querySelectorAll('.category-item').forEach(c => {
                const cSlug = c.dataset.category || '';
                if (!cSlug) {
                    // "All categories" is active only when no categories selected
                    if (currentFilters.category.length === 0) {
                        c.classList.add('is-active');
                    } else {
                        c.classList.remove('is-active');
                    }
                } else {
                    if (currentFilters.category.includes(cSlug)) {
                        c.classList.add('is-active');
                    } else {
                        c.classList.remove('is-active');
                    }
                }
            });
            
            // Apply filter immediately
            currentFilters.page = 1;
            allProducts = [];
            loadProducts();
            updateURL();
            updateActiveFiltersCount();
            renderActiveFilters();
        });
    });
    
    // Show empty state if no categories found
    if (filteredCategories.length === 0 && searchQuery) {
        elements.categoryFilters.innerHTML = `
            <div class="category-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
                <p>Категорії не знайдено</p>
            </div>
        `;
    }
}

async function loadProducts(loadMore = false) {
    if (!elements.grid) return;
    
    // Show skeletons only on first load
    if (!loadMore && allProducts.length === 0) {
        showSkeletons(8);
    }
    
    try {
        // Build params
        const params = {
            ...currentFilters,
            page: loadMore ? currentFilters.page + 1 : 1,
        };
        
        // Remove null values and empty arrays
        Object.keys(params).forEach(key => {
            if (params[key] === null || params[key] === undefined) {
                delete params[key];
            } else if (Array.isArray(params[key]) && params[key].length === 0) {
                delete params[key];
            }
        });
        
        const data = await api.getProducts(params);
        
        if (loadMore) {
            // Append to existing products
            allProducts = [...allProducts, ...data.items];
            currentFilters.page = params.page;
        } else {
            // Replace products
            allProducts = data.items;
            currentFilters.page = 1;
        }
        
        hasMoreProducts = data.items.length === currentFilters.page_size && 
                         allProducts.length < data.total;
        
        renderProducts(allProducts);
        renderLoadMore();
        updateProductsCount(data.total);
        
        // Обновляем максимальную цену для слайдера из данных API (только при первой загрузке)
        if (!loadMore && data.max_price) {
            const maxPrice = Math.ceil(parseFloat(data.max_price) / 100) * 100;
            maxProductPrice = maxPrice;
            
            const minSlider = document.getElementById('price-min-slider');
            const maxSlider = document.getElementById('price-max-slider');
            if (minSlider) {
                minSlider.max = maxProductPrice;
                minSlider.step = 10;
            }
            if (maxSlider) {
                maxSlider.max = maxProductPrice;
                maxSlider.step = 10;
                // Если текущее значение больше нового максимума, обновляем
                if (parseInt(maxSlider.value) > maxProductPrice) {
                    maxSlider.value = maxProductPrice;
                    priceMax = maxProductPrice;
                    const maxDisplay = document.getElementById('price-max-display');
                    const maxInput = document.getElementById('price-max');
                    if (maxDisplay) maxDisplay.textContent = maxProductPrice.toLocaleString('uk-UA');
                    if (maxInput) maxInput.value = '';
                }
            }
        }
        
    } catch (e) {
        console.error('Failed to load products:', e);
        showToast('Не вдалося завантажити товари', 'error');
        if (!loadMore) {
            renderEmpty();
        }
    }
}

// === Rendering ===
function showSkeletons(count) {
    elements.grid.innerHTML = Array(count).fill(null).map(() => `
        <article class="product-card product-card--skeleton">
            <div class="product-card__image">
                <div class="skeleton skeleton--image"></div>
            </div>
            <div class="product-card__body">
                <div class="skeleton skeleton--text" style="width: 40%;"></div>
                <div class="skeleton skeleton--text"></div>
                <div class="skeleton skeleton--text" style="width: 70%;"></div>
                <div class="skeleton skeleton--text" style="width: 50%; margin-top: 8px;"></div>
            </div>
        </article>
    `).join('');
}

function renderProducts(products) {
    if (!products || products.length === 0) {
        renderEmpty();
        return;
    }
    
    elements.grid.innerHTML = products.map(product => {
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
    
    initCardHandlers();
}

function renderEmpty() {
    elements.grid.innerHTML = `
        <div class="catalog-empty">
            <div class="catalog-empty__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
            </div>
            <h3 class="catalog-empty__title">Товарів не знайдено</h3>
            <p class="catalog-empty__text">Спробуйте змінити параметри пошуку або скинути фільтри</p>
            <button class="btn btn--primary catalog-empty__btn" id="empty-reset-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; margin-right: 8px;">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Скинути фільтри
            </button>
        </div>
    `;
    
    // Add event listener for reset button
    const resetBtn = document.getElementById('empty-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetAllFilters();
        });
    }
}

function renderLoadMore() {
    if (!elements.pagination) return;
    
    if (hasMoreProducts) {
        elements.pagination.innerHTML = `
            <button class="btn btn--primary btn--lg" id="load-more-btn" style="margin: 40px auto 0; display: block;">
                Завантажити ще
            </button>
        `;
        
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                loadProducts(true);
                loadMoreBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }
    } else {
        elements.pagination.innerHTML = '';
    }
}

function initFilterAccordion() {
    const filterGroups = document.querySelectorAll('.filter-group[data-accordion]');
    
    filterGroups.forEach(group => {
        const header = group.querySelector('.filter-group__header');
        const content = group.querySelector('.filter-group__content');
        
        if (!header || !content) return;
        
        // Open first group by default
        if (group === filterGroups[0]) {
            group.classList.add('is-open');
        }
        
        header.addEventListener('click', () => {
            const isOpen = group.classList.contains('is-open');
            
            if (isOpen) {
                group.classList.remove('is-open');
            } else {
                group.classList.add('is-open');
            }
        });
    });
    
    // Collapse all button
    const collapseAllBtn = document.getElementById('collapse-all-filters');
    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', () => {
            const allOpen = Array.from(filterGroups).every(g => g.classList.contains('is-open'));
            
            filterGroups.forEach(group => {
                if (allOpen) {
                    group.classList.remove('is-open');
                } else {
                    group.classList.add('is-open');
                }
            });
            
            collapseAllBtn.classList.toggle('is-collapsed', !allOpen);
        });
    }
}

function initSortSelect() {
    const wrapper = document.getElementById('sort-select-wrapper');
    const trigger = document.getElementById('sort-select-trigger');
    const textEl = wrapper?.querySelector('.custom-select__text');
    const input = document.getElementById('sort-select-input');
    const dropdown = wrapper?.querySelector('.custom-select__dropdown');
    
    if (!wrapper || !trigger || !textEl || !input || !dropdown) return;
    
    // Set initial value
    const currentValue = currentFilters.sort || 'newest';
    input.value = currentValue;
    const currentOption = dropdown.querySelector(`[data-value="${currentValue}"]`);
    if (currentOption) {
        textEl.textContent = currentOption.textContent;
        dropdown.querySelectorAll('.custom-select__option').forEach(opt => {
            opt.classList.toggle('is-selected', opt === currentOption);
        });
    }
    
    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrapper.classList.toggle('is-open');
    });
    
    // Handle option selection
    dropdown.querySelectorAll('.custom-select__option').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;
            const label = option.textContent;
            
            input.value = value;
            textEl.textContent = label;
            
            dropdown.querySelectorAll('.custom-select__option').forEach(opt => {
                opt.classList.toggle('is-selected', opt === option);
            });
            
            wrapper.classList.remove('is-open');
            
            // Update filter and reload
            currentFilters.sort = value;
            currentFilters.page = 1;
            allProducts = [];
            loadProducts();
            updateURL();
        });
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('is-open');
        }
    });
}

function updateProductsCount(total) {
    if (elements.productsCount) {
        const word = getProductWord(total);
        elements.productsCount.textContent = `${total} ${word}`;
    }
}

function getProductWord(n) {
    const lastTwo = n % 100;
    const lastOne = n % 10;
    
    if (lastTwo >= 11 && lastTwo <= 19) return 'товарів';
    if (lastOne === 1) return 'товар';
    if (lastOne >= 2 && lastOne <= 4) return 'товари';
    return 'товарів';
}

// === Card Handlers ===
function initCardHandlers() {
    // Favorite toggle
    elements.grid.querySelectorAll('[data-action="toggle-favorite"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            const product = getProductFromCard(card);
            
            const isNowFavorite = favorites.toggle(product);
            btn.classList.toggle('is-active', isNowFavorite);
            
            animatePulse(btn);
            showToast(isNowFavorite ? 'Додано в обране' : 'Видалено з обраного', 'default', 2000);
        });
    });
    
    // Add to cart
    elements.grid.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btn.closest('.product-card');
            const product = getProductFromCard(card);
            
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
    elements.grid.querySelectorAll('.product-card').forEach(card => {
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

function getProductFromCard(card) {
    const priceEl = card.querySelector('.product-card__price-sale') || 
                    card.querySelector('.product-card__price-current');
    
    return {
        id: parseInt(card.dataset.productId),
        slug: card.dataset.productSlug,
        name: card.querySelector('.product-card__name')?.textContent || '',
        price: parseFloat(priceEl?.textContent?.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
        primary_image: card.querySelector('.product-card__img')?.src || null,
    };
}

// === Start ===
// Make functions available globally for inline handlers
window.resetAllFilters = resetAllFilters;
window.loadProducts = loadProducts;

document.addEventListener('DOMContentLoaded', init);

