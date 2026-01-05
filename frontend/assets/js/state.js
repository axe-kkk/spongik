/**
 * State Module
 * Управление состоянием: cart, favorites, user
 * Реактивные обновления через события
 */

// === Event Bus ===
const listeners = {};

export function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return () => off(event, callback);
}

export function off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(cb => cb !== callback);
}

export function emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(cb => cb(data));
}

// === Cart State ===
const CART_KEY = 'spongik_cart';

function loadCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    emit('cart:updated', cart);
}

export const cart = {
    items: loadCart(),
    
    getAll() {
        return this.items;
    },
    
    getCount() {
        return this.items.reduce((sum, item) => sum + item.qty, 0);
    },
    
    getTotal() {
        return this.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    },
    
    find(productId) {
        return this.items.find(item => item.id === productId);
    },
    
    add(product, qty = 1) {
        // DEBUG: логируем данные продукта при добавлении
        console.log('Adding product to cart:', {
            id: product.id,
            name: product.name,
            price: product.price,
            final_price: product.final_price,
            old_price: product.old_price,
            discount_percent: product.discount_percent,
            is_featured: product.is_featured
        });
        
        const existing = this.find(product.id);
        
        if (existing) {
            existing.qty += qty;
            // Обновляем данные о скидках и акциях
            const basePrice = parseFloat(product.price) || 0;
            const finalPrice = parseFloat(product.final_price || product.price) || 0;
            existing.base_price = basePrice;
            existing.price = finalPrice;
            existing.old_price = product.old_price !== undefined ? product.old_price : (existing.old_price || null);
            existing.discount_percent = product.discount_percent !== undefined ? product.discount_percent : (existing.discount_percent || null);
            existing.is_featured = product.is_featured !== undefined ? product.is_featured : (existing.is_featured || false);
        } else {
            // Сохраняем base price и final price отдельно для правильного определения скидок
            const basePrice = parseFloat(product.price) || 0;
            const finalPrice = parseFloat(product.final_price || product.price) || 0;
            
            const newItem = {
                id: product.id,
                name: product.name,
                slug: product.slug,
                price: finalPrice, // Финальная цена для расчетов
                base_price: basePrice, // Базовая цена для определения промоакций
                old_price: product.old_price !== undefined ? product.old_price : null,
                discount_percent: product.discount_percent !== undefined ? product.discount_percent : null,
                is_featured: product.is_featured !== undefined ? product.is_featured : false,
                image: product.primary_image,
                qty,
            };
            
            // DEBUG: логируем сохраненный элемент
            console.log('Saved cart item:', newItem);
            
            this.items.push(newItem);
        }
        
        saveCart(this.items);
        emit('cart:item-added', { product, qty });
        return true;
    },
    
    updateQty(productId, qty) {
        const item = this.find(productId);
        if (!item) return false;
        
        if (qty <= 0) {
            return this.remove(productId);
        }
        
        item.qty = qty;
        saveCart(this.items);
        return true;
    },
    
    remove(productId) {
        const index = this.items.findIndex(item => item.id === productId);
        if (index === -1) return false;
        
        const [removed] = this.items.splice(index, 1);
        saveCart(this.items);
        emit('cart:item-removed', removed);
        return true;
    },
    
    clear() {
        this.items = [];
        saveCart(this.items);
    },
    
    save() {
        saveCart(this.items);
    },
};

// === Favorites State ===
const FAVORITES_KEY = 'spongik_favorites';

function loadFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    } catch {
        return [];
    }
}

function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    emit('favorites:updated', favorites);
}

export const favorites = {
    items: loadFavorites(),
    
    getAll() {
        return this.items;
    },
    
    getCount() {
        return this.items.length;
    },
    
    has(productId) {
        return this.items.some(item => item.id === productId);
    },
    
    add(product) {
        if (this.has(product.id)) return false;
        
        this.items.push({
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.final_price || product.price,
            image: product.primary_image,
        });
        
        saveFavorites(this.items);
        emit('favorites:item-added', product);
        return true;
    },
    
    remove(productId) {
        const index = this.items.findIndex(item => item.id === productId);
        if (index === -1) return false;
        
        const [removed] = this.items.splice(index, 1);
        saveFavorites(this.items);
        emit('favorites:item-removed', removed);
        return true;
    },
    
    toggle(product) {
        if (this.has(product.id)) {
            this.remove(product.id);
            return false;
        } else {
            this.add(product);
            return true;
        }
    },
    
    clear() {
        this.items = [];
        saveFavorites(this.items);
    },
};

// === User State ===
export const user = {
    data: null,
    isAuthenticated: false,
    
    set(userData) {
        this.data = userData;
        this.isAuthenticated = !!userData;
        emit('user:updated', userData);
    },
    
    clear() {
        this.data = null;
        this.isAuthenticated = false;
        emit('user:updated', null);
    },
    
    isAdmin() {
        return this.data?.role === 'admin';
    },
};

// === Sync with server for authenticated users ===
export async function syncFavoritesWithServer(api) {
    if (!user.isAuthenticated) return;
    
    try {
        const serverFavorites = await api.getFavorites();
        favorites.items = serverFavorites.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.final_price || p.price,
            image: p.primary_image,
        }));
        saveFavorites(favorites.items);
    } catch (e) {
        console.warn('Failed to sync favorites:', e);
    }
}

export default { cart, favorites, user, on, off, emit };



