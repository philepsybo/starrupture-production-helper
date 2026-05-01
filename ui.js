// Populate the product dropdown and setup search
export function populateProductDropdown() {
    const select = document.getElementById('product');
    const searchInput = document.getElementById('productSearch');
    // Sort products alphabetically by name and populate hidden select
    const sortedProducts = [...productsData].sort((a, b) => a.name.localeCompare(b.name));
    sortedProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        select.appendChild(option);
    });
    // Store sorted products for search filtering
    window.sortedProducts = sortedProducts;
}
// Scroll to a card by product name
export function scrollToCard(productName) {
    const cards = document.querySelectorAll('.allocation-card');
    for (let card of cards) {
        const productHeader = card.querySelector('.allocation-product');
        if (productHeader && productHeader.textContent === productName) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }
}

function highlightDropdownItem(index) {
    const items = document.querySelectorAll('.dropdown-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('highlighted');
        }
    });
}

function selectProductFromDropdown(productId, productName) {
    const searchInput = document.getElementById('productSearch');
    const dropdown = document.getElementById('productDropdown');
    const select = document.getElementById('product');
    searchInput.value = productName;
    select.value = productId;
    dropdown.style.display = 'none';
    window.highlightedIndex = -1;
}

function filterProductDropdown() {
    const searchInput = document.getElementById('productSearch');
    const dropdown = document.getElementById('productDropdown');
    const searchTerm = searchInput.value.toLowerCase().trim();
    let productsToShow;
    if (searchTerm === '') {
        productsToShow = window.sortedProducts;
    } else {
        productsToShow = window.sortedProducts.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.id.toLowerCase().includes(searchTerm)
        );
    }
    if (productsToShow.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">No products found</div>';
    } else {
        dropdown.innerHTML = productsToShow.map(product =>
            `<div class="dropdown-item" data-product-id="${product.id}" data-product-name="${product.name}">
                ${product.name}
            </div>`
        ).join('');
    }
    dropdown.style.display = 'block';
    window.currentFilteredProducts = productsToShow;
    window.highlightedIndex = -1;
}

export function setupEventListeners() {
    document.getElementById('calculatorForm').addEventListener('submit', e => {
        e.preventDefault();
        const productId = document.getElementById('product').value;
        const quantity = parseInt(document.getElementById('quantity').value);
        const timeAvailable = parseInt(document.getElementById('time').value);
        if (!productId) {
            showError('Please select a product');
            return;
        }
        try {
            const result = calculateRequirements(productId, quantity, timeAvailable);
            displayResults(result, productId);
        } catch (error) {
            showError(error.message);
        }
    });
    const searchInput = document.getElementById('productSearch');
    const dropdown = document.getElementById('productDropdown');
    searchInput.addEventListener('input', filterProductDropdown);
    searchInput.addEventListener('keydown', (e) => {
        if (!window.currentFilteredProducts || window.currentFilteredProducts.length === 0) {
            return;
        }
        const maxIndex = window.currentFilteredProducts.length - 1;
        let currentIndex = typeof window.highlightedIndex !== 'undefined' ? window.highlightedIndex : -1;
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, maxIndex);
                window.highlightedIndex = currentIndex;
                highlightDropdownItem(currentIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, -1);
                window.highlightedIndex = currentIndex;
                if (currentIndex === -1) {
                    document.querySelectorAll('.dropdown-item').forEach(item => {
                        item.classList.remove('highlighted');
                    });
                } else {
                    highlightDropdownItem(currentIndex);
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (currentIndex >= 0 && window.currentFilteredProducts[currentIndex]) {
                    const product = window.currentFilteredProducts[currentIndex];
                    selectProductFromDropdown(product.id, product.name);
                }
                break;
            case 'Escape':
                dropdown.style.display = 'none';
                window.highlightedIndex = -1;
                break;
        }
    });
    document.addEventListener('click', (e) => {
        if (e.target !== searchInput && e.target !== dropdown) {
            dropdown.style.display = 'none';
        }
    });
    searchInput.addEventListener('focus', () => {
        filterProductDropdown();
    });
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('dropdown-item') && e.target.dataset.productId) {
            selectProductFromDropdown(e.target.dataset.productId, e.target.dataset.productName);
        }
    });
}
// ui.js
// UI logic: dropdowns, event listeners, DOM updates, error handling
import { productsData, facilitiesData, loadFacilities, loadProducts } from './data.js';
import { calculateRequirements } from './calculator-core.js';
import { displayResults } from './display.js';

export function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMsg = document.getElementById('errorMessage');
    errorMsg.textContent = message;
    errorDiv.style.display = 'block';
}
