// data.js
// Handles loading and validation of products and facilities data

export let productsData = [];
export let facilitiesData = [];

export async function loadFacilities() {
    try {
        const response = await fetch('facilities.json');
        facilitiesData = await response.json();
    } catch (error) {
        throw new Error('Failed to load facilities.json: ' + error.message);
    }
}

export async function loadProducts() {
    try {
        const response = await fetch('products.json');
        productsData = await response.json();
        validateProducts();
    } catch (error) {
        throw new Error('Failed to load products.json: ' + error.message);
    }
}

export function validateProducts() {
    const facilityIds = new Set(facilitiesData.map(f => f.id));
    productsData.forEach(product => {
        product.producedIn?.forEach(facility => {
            if (!facilityIds.has(facility.id)) {
                throw new Error(`Invalid facility ID "${facility.id}" in product "${product.id}". Valid IDs are: ${Array.from(facilityIds).join(', ')}`);
            }
        });
    });
}
