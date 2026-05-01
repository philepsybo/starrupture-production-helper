// main.js
// App entry point: bootstraps everything and wires modules together
import { loadFacilities, loadProducts } from './data.js';
import { setupEventListeners, populateProductDropdown, scrollToCard } from './ui.js';

window.scrollToCard = scrollToCard;

document.addEventListener('DOMContentLoaded', async () => {
    await loadFacilities();
    await loadProducts();
    populateProductDropdown();
    setupEventListeners();
});
