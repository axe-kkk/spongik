/**
 * Main Application Entry Point
 * Инициализация и связывание модулей
 */

import api from './api.js';
import { cart, favorites, user, on, syncFavoritesWithServer } from './state.js';
import { 
    initUI, 
    showToast, 
    showProductsLoading, 
    renderProductsGrid,
    updateCartCount,
    formatPrice 
} from './ui.js';

// === App Initialization ===
class App {
    constructor() {
        this.api = api;
        this.cart = cart;
        this.favorites = favorites;
        this.user = user;
    }
    
    async init() {
        
        // Init UI handlers
        initUI();
        
        // Init header
        this.initHeader();
        
        // Check auth status
        await this.checkAuth();
        
        // Load initial data based on page
        await this.loadPageData();
        
    }
    
    initHeader() {
        const header = document.getElementById('header');
        if (!header) return;
        
        // Scroll effect
        const onScroll = () => {
            header.classList.toggle('scrolled', window.scrollY > 10);
        };
        
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        
        // Mobile search toggle
        const searchBtn = header.querySelector('[aria-label="Поиск"]');
        const searchInput = header.querySelector('.search-input');
        
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => {
                const searchWrapper = header.querySelector('.header__search');
                if (searchWrapper) {
                    searchWrapper.style.display = 
                        searchWrapper.style.display === 'block' ? 'none' : 'block';
                    searchInput.focus();
                }
            });
            
            // Search submit
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const query = searchInput.value.trim();
                    if (query) {
                        window.location.href = `/catalog?q=${encodeURIComponent(query)}`;
                    }
                }
            });
        }
    }
    
    async checkAuth() {
        try {
            const userData = await this.api.getMe();
            this.user.set(userData);
            
            // Sync favorites with server
            await syncFavoritesWithServer(this.api);
            
            this.updateAuthUI();
        } catch (e) {
            // Not authenticated - that's fine
            this.user.clear();
        }
    }
    
    updateAuthUI() {
        // Update UI based on auth state
        document.querySelectorAll('[data-auth-only]').forEach(el => {
            el.style.display = this.user.isAuthenticated ? '' : 'none';
        });
        
        document.querySelectorAll('[data-guest-only]').forEach(el => {
            el.style.display = this.user.isAuthenticated ? 'none' : '';
        });
    }
    
    async loadPageData() {
        const path = window.location.pathname;
        
        // Home page - load bestsellers
        if (path === '/' || path === '/index.html' || path.includes('/pages/index.html')) {
            await this.loadBestsellers();
        }
        
        // Catalog page
        if (path.includes('/catalog')) {
            await this.loadCatalog();
        }
        
        // Product page
        if (path.includes('/product/')) {
            const slug = path.split('/product/')[1]?.replace(/\/$/, '');
            if (slug) {
                await this.loadProduct(slug);
            }
        }
    }
    
    async loadBestsellers() {
        const grid = document.getElementById('products-grid');
        if (!grid) return;
        
        // Show skeletons
        showProductsLoading(grid, 4);
        
        try {
            const data = await this.api.getProducts({ 
                page_size: 8,
                sort: 'newest'
            });
            
            renderProductsGrid(data.items, grid);
        } catch (e) {
            console.error('Failed to load products:', e);
            showToast('Не удалось загрузить товары', 'error');
            
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <h3 class="empty-state__title">Ошибка загрузки</h3>
                    <p class="empty-state__text">${e.message}</p>
                    <button class="btn btn--secondary" onclick="location.reload()">
                        Попробовать снова
                    </button>
                </div>
            `;
        }
    }
    
    async loadCatalog() {
        const grid = document.getElementById('catalog-grid');
        if (!grid) return;
        
        const params = new URLSearchParams(window.location.search);
        
        showProductsLoading(grid, 8);
        
        try {
            const data = await this.api.getProducts({
                category: params.get('category'),
                q: params.get('q'),
                min_price: params.get('min_price'),
                max_price: params.get('max_price'),
                in_stock: params.get('in_stock'),
                on_sale: params.get('on_sale'),
                sort: params.get('sort') || 'newest',
                page: params.get('page') || 1,
                page_size: 12,
            });
            
            renderProductsGrid(data.items, grid);
            this.renderPagination(data);
        } catch (e) {
            console.error('Failed to load catalog:', e);
            showToast('Не удалось загрузить каталог', 'error');
        }
    }
    
    async loadProduct(slug) {
        const container = document.getElementById('product-detail');
        if (!container) return;
        
        try {
            const product = await this.api.getProduct(slug);
            this.renderProductDetail(product, container);
        } catch (e) {
            console.error('Failed to load product:', e);
            container.innerHTML = `
                <div class="empty-state">
                    <h3 class="empty-state__title">Товар не найден</h3>
                    <p class="empty-state__text">Возможно, он был удалён или перемещён</p>
                    <a href="/catalog" class="btn btn--primary">В каталог</a>
                </div>
            `;
        }
    }
    
    renderProductDetail(product, container) {
        // Product detail rendering logic
        // This would be a full product page template
    }
    
    renderPagination(data) {
        const container = document.getElementById('pagination');
        if (!container || data.pages <= 1) return;
        
        // Pagination rendering logic
    }
}

// === Global exports for inline handlers ===
window.Spongik = {
    showToast,
    formatPrice,
    cart,
    favorites,
};

// === Start App ===
const app = new App();

document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(console.error);
});

export default app;





