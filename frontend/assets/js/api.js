/**
 * API Module
 * Централизованная работа с бекендом
 */

const API_BASE = '/api';

class ApiError extends Error {
    constructor(message, status, data = null) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        credentials: 'include', // для HttpOnly cookies
        ...options,
    };
    
    // Убираем Content-Type для FormData
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    
    try {
        const response = await fetch(url, config);
        
        // Пустой ответ
        if (response.status === 204) {
            return null;
        }
        
        const data = await response.json().catch(() => null);
        
        if (!response.ok) {
            throw new ApiError(
                data?.detail || 'Произошла ошибка',
                response.status,
                data
            );
        }
        
        return data;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        
        // Сетевая ошибка
        throw new ApiError('Нет соединения с сервером', 0);
    }
}

// === API методы ===

export const api = {
    // Products
    async getProducts(params = {}) {
        // Build query string manually to handle arrays correctly
        const queryParts = [];
        for (const [key, value] of Object.entries(params)) {
            if (value === null || value === undefined) continue;
            if (Array.isArray(value)) {
                // For arrays, add each value as a separate parameter with the same key
                // This creates: category=cat1&category=cat2
                value.forEach(v => {
                    if (v !== null && v !== undefined && v !== '') {
                        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
                    }
                });
            } else {
                queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }
        const query = queryParts.length > 0 ? queryParts.join('&') : '';
        const url = `/products${query ? '?' + query : ''}`;
        return request(url);
    },
    
    async getProduct(slug) {
        return request(`/products/${slug}`);
    },
    
    // Categories
    async getCategories() {
        return request('/categories');
    },
    
    // Auth
    async login(login, password) {
        return request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ login, password }),
        });
    },
    
    async register(data) {
        return request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    
    async logout() {
        return request('/auth/logout', { method: 'POST' });
    },
    
    async getMe() {
        return request('/auth/me');
    },
    
    // Favorites (для авторизованных)
    async getFavorites() {
        return request('/me/favorites');
    },
    
    async addFavorite(productId) {
        return request('/me/favorites', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId }),
        });
    },
    
    async removeFavorite(productId) {
        return request(`/me/favorites/${productId}`, {
            method: 'DELETE',
        });
    },
    
    // Orders
    async createOrder(data) {
        return request('/orders', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    
    async getMyOrders() {
        return request('/me/orders');
    },
    
    async getMyOrder(orderId) {
        return request(`/me/orders/${orderId}`);
    },
    
    // Promotions
    async getActivePromotions() {
        return request('/promotions/active');
    },
    
    async validatePromoCode(code) {
        const promos = await this.getActivePromotions();
        return promos.find(p => p.code === code) || null;
    },
    
    // Profile
    async updateProfile(data) {
        return request('/users/me', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },
};

export { ApiError };
export default api;

