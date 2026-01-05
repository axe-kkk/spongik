/**
 * Nova Poshta API Service
 * Документація: https://developers.novaposhta.ua/
 * 
 * Для отримання API ключа:
 * 1. Зареєструйтесь на https://my.novaposhta.ua/
 * 2. Перейдіть в розділ "API ключі"
 * 3. Створіть новий ключ
 * 4. Замініть YOUR_API_KEY_HERE на ваш ключ
 */

const NOVA_POSHTA_API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const NOVA_POSHTA_API_KEY = '1a7e10a80ffbb0011b09b02f0c3ca521'; // TODO: Замінити на реальний API ключ з https://my.novaposhta.ua/

// Затримка між запитами для уникнення "To many requests"
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // Мінімальний інтервал між запитами (мс)

/**
 * Запит до API Новой Почты з захистом від занадто частих запитів
 */
async function novaPoshtaRequest(methodName, methodProperties = {}) {
    try {
        // Если API ключ не установлен, возвращаем пустой массив
        if (NOVA_POSHTA_API_KEY === 'YOUR_API_KEY_HERE') {
            return [];
        }
        
        // Затримка перед запитом, якщо минуло менше MIN_REQUEST_INTERVAL
        const timeSinceLastRequest = Date.now() - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
        }
        
        lastRequestTime = Date.now();
        
        const response = await fetch(NOVA_POSHTA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: NOVA_POSHTA_API_KEY,
                modelName: 'Address',
                calledMethod: methodName,
                methodProperties: methodProperties,
            }),
        });

        const data = await response.json();
        
        if (data.success && data.data) {
            return data.data;
        }
        
        // Якщо помилка "To many requests", повертаємо пустий масив БЕЗ кешу
        if (data.errors && Array.isArray(data.errors) && data.errors.some(e => e.includes('many requests'))) {
            console.error('❌ Nova Poshta API: занадто багато запитів. Потрібно зачекати.');
            // НЕ повертаємо кеш, щоб не використовувати старі дані
            throw new Error('Too many requests');
        }
        
        console.error('Nova Poshta API error:', data.errors || data);
        return [];
    } catch (error) {
        console.error('Nova Poshta API request failed:', error);
        return [];
    }
}

/**
 * Пошук міст та населених пунктів
 */
export async function searchCities(query) {
    if (!query || query.length < 2) {
        return [];
    }
    
    const result = await novaPoshtaRequest('searchSettlements', {
        CityName: query,
        Limit: 20,
    });
    
    if (result && result.length > 0 && result[0].Addresses) {
        return result[0].Addresses.map(addr => ({
            ref: addr.DeliveryCity,
            name: addr.Present,
            area: addr.Area,
            region: addr.Region,
        }));
    }
    
    return [];
}

/**
 * Отримати відділення та поштомати по місту
 * @param {string} cityRef - REF міста
 * @param {string} cityName - Назва міста (альтернатива cityRef)
 * @param {string} warehouseType - Тип: '' (всі), 'Postomat' (тільки поштомати), '9a68df70-0267-11e3-8595-0050568002cf' (відділення)
 */
export async function getWarehouses(cityRef = null, cityName = null, warehouseType = '') {
    if (!cityRef && !cityName) {
        return [];
    }
    
    const methodProperties = {
        Limit: 1000, // Збільшений ліміт для отримання більше результатів
    };
    
    // Використовуємо CityRef якщо є, інакше CityName
    if (cityRef) {
        methodProperties.CityRef = cityRef;
    } else if (cityName) {
        methodProperties.CityName = cityName;
    }
    
    // Якщо вказано тип, додаємо фільтр
    if (warehouseType) {
        methodProperties.TypeOfWarehouse = warehouseType;
    }
    // Якщо тип не вказано, не передаємо TypeOfWarehouse - отримаємо всі
    
    const warehouses = await novaPoshtaRequest('getWarehouses', methodProperties);
    
    if (warehouses && warehouses.length > 0) {
        return warehouses.map(wh => ({
            ref: wh.Ref,
            number: wh.Number,
            name: wh.Description,
            shortAddress: wh.ShortAddress,
            city: wh.CityDescription,
            type: wh.TypeOfWarehouse,
        }));
    }
    
    return [];
}

// Кеш для збереження результатів
const warehousesCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин
let isRequestInProgress = false; // Флаг для уникнення паралельних запитів

/**
 * Отримати всі відділення (включаючи поштомати)
 * НОВИЙ АЛГОРИТМ: спочатку поштомати, потім відділення, з правильним обробкою помилок
 */
export async function getAllWarehouses(cityRef, cityName = null) {
    if (!cityRef && !cityName) {
        return [];
    }
    
    const cacheKey = `${cityRef || cityName}`;
    
    // Перевіряємо кеш ТІЛЬКИ якщо немає активного запиту
    if (!isRequestInProgress) {
        const cached = warehousesCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log('Використовуємо кешовані дані');
            return cached.data;
        }
    }
    
    // Блокуємо паралельні запити
    if (isRequestInProgress) {
        console.log('Запит вже виконується, чекаємо...');
        // Чекаємо поки попередній запит завершиться
        let attempts = 0;
        while (isRequestInProgress && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
            const cached = warehousesCache.get(cacheKey);
            if (cached) return cached.data;
        }
    }
    
    isRequestInProgress = true;
    
    try {
        let warehouses = [];
        let postomats = [];
        
        // КРОК 1: Спочатку завантажуємо поштомати (вони важливіші для пошуку)
        if (cityRef || cityName) {
            console.log('КРОК 1: Завантажуємо поштомати...');
            try {
                // Затримка перед першим запитом
                await new Promise(resolve => setTimeout(resolve, 300));
                
                postomats = await getWarehouses(cityRef, cityName, 'Postomat');
                
                if (postomats && postomats.length > 0) {
                    console.log(`✅ Завантажено ${postomats.length} поштоматів`);
                } else {
                    console.warn('⚠️ Поштомати не завантажені (порожній результат)');
                }
            } catch (error) {
                console.error('❌ Помилка завантаження поштоматів:', error);
            }
        }
        
        // КРОК 2: Потім завантажуємо відділення
        console.log('КРОК 2: Завантажуємо відділення...');
        try {
            // Затримка перед другим запитом
            await new Promise(resolve => setTimeout(resolve, 500));
            
            warehouses = await getWarehouses(cityRef, cityName, '9a68df70-0267-11e3-8595-0050568002cf');
            
            // Якщо не отримали відділення з фільтром, пробуємо без фільтра
            if (warehouses.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const allWarehouses = await getWarehouses(cityRef, cityName, '');
                // Фільтруємо тільки відділення (не поштомати)
                warehouses = allWarehouses.filter(w => w.type !== 'Postomat');
            }
            
            if (warehouses && warehouses.length > 0) {
                console.log(`✅ Завантажено ${warehouses.length} відділень`);
            }
        } catch (error) {
            console.error('❌ Помилка завантаження відділень:', error);
        }
        
        // КРОК 3: Об'єднуємо результати
        console.log(`До об'єднання: ${warehouses.length} відділень, ${postomats.length} поштоматів`);
        
        const allWarehouses = [...warehouses, ...postomats];
        console.log(`Після об'єднання: ${allWarehouses.length} всього`);
        
        // Видаляємо дублікати по REF
        const uniqueMap = new Map();
        allWarehouses.forEach(wh => {
            if (wh && wh.ref) {
                if (!uniqueMap.has(wh.ref)) {
                    uniqueMap.set(wh.ref, wh);
                } else {
                    // Якщо дублікат, перевіряємо чи не втратили тип
                    const existing = uniqueMap.get(wh.ref);
                    if (!existing.type && wh.type) {
                        uniqueMap.set(wh.ref, wh);
                    }
                }
            }
        });
        
        const unique = Array.from(uniqueMap.values());
        console.log(`Після видалення дублікатів: ${unique.length} унікальних`);
        
        // Детальна перевірка типів
        const warehousesInResult = unique.filter(w => w.type !== 'Postomat' && w.type !== 'Postomat');
        const postomatsInResult = unique.filter(w => w.type === 'Postomat');
        const unknownType = unique.filter(w => !w.type || (w.type !== 'Postomat' && w.type !== '9a68df70-0267-11e3-8595-0050568002cf'));
        
        console.log(`📦 ПІДСУМОК: ${warehousesInResult.length} відділень, ${postomatsInResult.length} поштоматів, ${unknownType.length} невідомих, всього: ${unique.length}`);
        
        if (unknownType.length > 0) {
            console.log('Невідомі типи:', unknownType.slice(0, 3).map(w => ({ type: w.type, number: w.number, name: w.name })));
        }
        
        // Перевіряємо чи поштомати втратили тип при об'єднанні
        if (postomats.length > 0 && postomatsInResult.length === 0) {
            console.error('❌ ПОМИЛКА: Поштомати втратилися при об\'єднанні!');
            console.log('Приклад поштоматів до об\'єднання:', postomats.slice(0, 3).map(p => ({ ref: p.ref, type: p.type, number: p.number })));
            console.log('Перевірка в унікальному списку:', unique.slice(0, 10).map(u => ({ ref: u.ref, type: u.type, number: u.number })));
        }
        
        // Перевірка поштомата 36511
        if (postomatsInResult.length > 0) {
            const test36511 = unique.find(w => 
                w.type === 'Postomat' && (
                    w.number === '36511' || 
                    w.number === '36511' ||
                    (w.name && (w.name.includes('36511') || w.name.includes('№36511')))
                )
            );
            if (test36511) {
                console.log('✅ Поштомат 36511 знайдено:', { number: test36511.number, name: test36511.name, type: test36511.type });
            } else {
                console.log('❌ Поштомат 36511 НЕ знайдено. Перевіряємо всі номери...');
                const allNumbers = postomatsInResult.map(w => w.number).filter(n => n).slice(0, 20);
                console.log('Приклад номерів поштоматів:', allNumbers);
            }
        } else {
            console.error('⚠️ КРИТИЧНО: Поштомати не завантажені або втратилися при об\'єднанні!');
            if (postomats.length > 0) {
                console.log('Поштомати були завантажені, але втратилися. Перевіряємо...');
                // Спробуємо знайти поштомати в унікальному списку без фільтра по типу
                const foundPostomats = unique.filter(w => {
                    const name = (w.name || '').toLowerCase();
                    return name.includes('поштомат') || name.includes('postomat') || (w.number && parseInt(w.number) > 30000);
                });
                console.log(`Знайдено ${foundPostomats.length} можливих поштоматів без фільтра по типу`);
            }
        }
        
        // Сортуємо: спочатку відділення, потім поштомати
        const sorted = unique.sort((a, b) => {
            if (a.type === 'Postomat' && b.type !== 'Postomat') return 1;
            if (a.type !== 'Postomat' && b.type === 'Postomat') return -1;
            if (a.number && b.number) {
                const numA = parseInt(a.number) || 0;
                const numB = parseInt(b.number) || 0;
                if (numA !== numB) return numA - numB;
            }
            return (a.name || '').localeCompare(b.name || '');
        });
        
        // Зберігаємо в кеш
        warehousesCache.set(cacheKey, {
            data: sorted,
            timestamp: Date.now()
        });
        
        isRequestInProgress = false;
        return sorted;
        
    } catch (error) {
        console.error('❌ КРИТИЧНА ПОМИЛКА завантаження відділень:', error);
        isRequestInProgress = false;
        
        // Повертаємо кешовані дані якщо є
        const cached = warehousesCache.get(cacheKey);
        if (cached) {
            console.log('Використовуємо старі кешовані дані через помилку');
            return cached.data;
        }
        return [];
    }
}

/**
 * Отримати тільки поштомати
 */
export async function getPostomats(cityRef, cityName = null) {
    return await getWarehouses(cityRef, cityName, 'Postomat');
}

/**
 * Пошук відділення або поштомата по номеру
 * Використовується для точного пошуку конкретного поштомата
 */
export async function searchWarehouseByNumber(cityRef, cityName, warehouseNumber) {
    if (!warehouseNumber) return null;
    
    // Запитуємо всі відділення та поштомати
    const all = await getAllWarehouses(cityRef, cityName);
    
    // Шукаємо по номеру (точне співпадіння або часткове)
    const found = all.find(wh => 
        wh.number === warehouseNumber || 
        wh.number === String(warehouseNumber) ||
        wh.name.includes(warehouseNumber) ||
        wh.name.includes(`№${warehouseNumber}`) ||
        wh.name.includes(`#${warehouseNumber}`)
    );
    
    return found || null;
}

