import cds from '@sap/cds';

const LOG = cds.log('fakestore-client');

export interface FakeStoreProduct {
    id: number;
    title: string;
    price: number;
    description: string;
    category: string;
    image: string;
    rating?: {
        rate: number;
        count: number;
    };
}

const FAKESTORE_API_URL = 'https://fakestoreapi.com/products';
const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute in-memory cache

let cachedProducts: FakeStoreProduct[] | null = null;
let cacheExpiryTime = 0;

/**
 * Resets the in-memory cache (useful for testing or cache invalidation).
 */
export function resetFakeStoreCache(): void {
    cachedProducts = null;
    cacheExpiryTime = 0;
}

/**
 * Fetches products list with in-memory caching to optimize network performance.
 */
async function getCachedProducts(): Promise<FakeStoreProduct[] | null> {
    const now = Date.now();
    if (cachedProducts && now < cacheExpiryTime) {
        LOG.debug('Serving FakeStore products from in-memory cache.');
        return cachedProducts;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(FAKESTORE_API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            LOG.warn(`FakeStoreAPI responded with HTTP status ${response.status}: ${response.statusText}`);
            return null;
        }

        const data = (await response.json()) as FakeStoreProduct[];
        if (Array.isArray(data) && data.length > 0) {
            cachedProducts = data;
            cacheExpiryTime = now + CACHE_TTL_MS;
            LOG.info(`Successfully cached ${data.length} products from FakeStoreAPI.`);
            return cachedProducts;
        }

        return null;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            LOG.warn(`Request to FakeStoreAPI timed out after ${REQUEST_TIMEOUT_MS}ms.`);
        } else {
            LOG.warn(`Failed to retrieve external products from FakeStoreAPI: ${error.message || error}`);
        }
        return null;
    }
}

/**
 * Fetches products from FakeStoreAPI and finds a rating matching the given category.
 * 
 * @param category - Category name of the product being created
 * @returns Rating rate (number) if matched, or null if no match or error occurs
 */
export async function fetchExternalRatingByCategory(category?: string): Promise<number | null> {
    if (!category || typeof category !== 'string' || !category.trim()) {
        LOG.info('No category provided for external rating lookup.');
        return null;
    }

    const normalizedTargetCategory = category.trim().toLowerCase();
    LOG.info(`Looking up external rating for category: "${category}"`);

    try {
        const products = await getCachedProducts();

        if (!products || products.length === 0) {
            LOG.info(`No product data available from external API for category: "${category}"`);
            return null;
        }

        // 1. Exact match (case-insensitive)
        let matchedProduct = products.find(
            (p) => p.category && p.category.trim().toLowerCase() === normalizedTargetCategory
        );

        // 2. Partial/fuzzy match if exact match not found (e.g. "clothing" matching "men's clothing")
        if (!matchedProduct) {
            matchedProduct = products.find((p) => {
                if (!p.category) return false;
                const cat = p.category.trim().toLowerCase();
                return cat.includes(normalizedTargetCategory) || normalizedTargetCategory.includes(cat);
            });
        }

        if (matchedProduct && matchedProduct.rating && typeof matchedProduct.rating.rate === 'number') {
            const externalRating = matchedProduct.rating.rate;
            LOG.info(`Successfully matched category "${category}" to product "${matchedProduct.title}" with rating ${externalRating}`);
            return externalRating;
        }

        LOG.info(`No matching product or rating found in FakeStoreAPI for category: "${category}"`);
        return null;
    } catch (error: any) {
        LOG.warn(`Error during external rating resolution: ${error?.message || error}`);
        return null;
    }
}