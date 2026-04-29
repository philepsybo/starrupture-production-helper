// Global products and facilities data
let productsData = [];
let facilitiesData = [];

// Initialize the calculator
document.addEventListener('DOMContentLoaded', async () => {
    await loadFacilities();
    await loadProducts();
    setupEventListeners();
});

// Load facilities from JSON file
async function loadFacilities() {
    try {
        const response = await fetch('facilities.json');
        facilitiesData = await response.json();
    } catch (error) {
        showError('Failed to load facilities.json: ' + error.message);
    }
}

// Load products from JSON file
async function loadProducts() {
    try {
        const response = await fetch('products.json');
        productsData = await response.json();
        validateProducts();
        populateProductDropdown();
    } catch (error) {
        showError('Failed to load products.json: ' + error.message);
    }
}

// Validate that all facility IDs in products exist in facilities
function validateProducts() {
    const facilityIds = new Set(facilitiesData.map(f => f.id));
    
    productsData.forEach(product => {
        product.producedIn?.forEach((facility, idx) => {
            if (!facilityIds.has(facility.id)) {
                throw new Error(`Invalid facility ID "${facility.id}" in product "${product.id}". Valid IDs are: ${Array.from(facilityIds).join(', ')}`);
            }
        });
    });
}

// Populate the product dropdown and setup search
function populateProductDropdown() {
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

// Filter and display product dropdown based on search
function filterProductDropdown() {
    const searchInput = document.getElementById('productSearch');
    const dropdown = document.getElementById('productDropdown');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        dropdown.style.display = 'none';
        return;
    }
    
    // Filter products based on search term
    const filtered = window.sortedProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.id.toLowerCase().includes(searchTerm)
    );
    
    // Build dropdown HTML
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">No products found</div>';
    } else {
        dropdown.innerHTML = filtered.map(product =>
            `<div class="dropdown-item" data-product-id="${product.id}" data-product-name="${product.name}">
                ${product.name}
            </div>`
        ).join('');
    }
    
    dropdown.style.display = 'block';
    window.currentFilteredProducts = filtered;
    window.highlightedIndex = -1;
}

// Handle product selection from dropdown
function selectProductFromDropdown(productId, productName) {
    const searchInput = document.getElementById('productSearch');
    const dropdown = document.getElementById('productDropdown');
    const select = document.getElementById('product');
    
    searchInput.value = productName;
    select.value = productId;
    dropdown.style.display = 'none';
    window.highlightedIndex = -1;
}

// Highlight dropdown item
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

// Setup event listeners
function setupEventListeners() {
    document.getElementById('calculatorForm').addEventListener('submit', handleCalculate);
    document.getElementById('toggleTree').addEventListener('click', toggleTree);
    
    // Search input handlers
    const searchInput = document.getElementById('productSearch');
    const dropdown = document.getElementById('productDropdown');
    
    searchInput.addEventListener('input', filterProductDropdown);
    
    // Keyboard navigation
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
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target !== searchInput && e.target !== dropdown) {
            dropdown.style.display = 'none';
        }
    });
    
    // Open dropdown on focus
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim() !== '') {
            filterProductDropdown();
        }
    });
    
    // Handle dropdown item clicks
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('dropdown-item') && e.target.dataset.productId) {
            selectProductFromDropdown(e.target.dataset.productId, e.target.dataset.productName);
        }
    });
}

// Handle form submission
function handleCalculate(e) {
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
        document.getElementById('error').style.display = 'none';
    } catch (error) {
        showError(error.message);
    }
}

// Main calculation logic
function calculateRequirements(productId, quantity, timeAvailable, visited = new Set()) {
    const product = productsData.find(p => p.id === productId);
    
    if (!product) {
        throw new Error(`Product ${productId} not found`);
    }

    // Prevent infinite loops
    if (visited.has(productId)) {
        return {
            facilities: [],
            feasible: true,
            dependencies: {},
            productName: product.name
        };
    }
    visited.add(productId);

    const facilitiesNeeded = [];
    const dependenciesMap = {};
    let isFeasible = true;

    // Calculate for each production facility
    product.producedIn?.forEach(facility => {
        // How many production cycles can this facility do in the available time?
        // (allows fractional cycles)
        const cycles = timeAvailable / facility.takesTime;
        
        // How many units can this facility produce in the available time?
        // (cycles × amountProduced per cycle)
        const amountPerCycle = product.amountProduced || 1;
        const unitsPerFacility = cycles * amountPerCycle;
        
        if (unitsPerFacility <= 0) {
            isFeasible = false;
        }

        // How many of this facility do we need?
        const facilitiesCount = unitsPerFacility > 0 ? Math.ceil(quantity / unitsPerFacility) : quantity;
        
        const facilityCost = {
            id: facility.id,
            name: getFacilityName(facility.id),
            takesTime: facility.takesTime,
            amountPerCycle: amountPerCycle,
            unitsPerFacility: unitsPerFacility,
            facilitiesNeeded: facilitiesCount,
            requirements: facility.requires || [],
            producesProduct: product.id
        };

        facilitiesNeeded.push(facilityCost);
    });

    // Calculate dependencies once, based on total quantity needed
    // All facility alternatives produce the same product, so sum their requirements
    product.producedIn?.forEach(facility => {
        facility.requires?.forEach(req => {
            // Account for amountProduced: if we need 200 powder but each cycle makes 3,
            // we only need ceil(200/3) amounts of the input, not 200
            const amountPerCycle = product.amountProduced || 1;
            const recipesNeeded = Math.ceil(quantity / amountPerCycle);
            const totalNeeded = req.quantity * recipesNeeded;
            
            if (!dependenciesMap[req.productId]) {
                dependenciesMap[req.productId] = {
                    quantity: 0,
                    facilities: []
                };
            }
            // Sum requirements across all facility alternatives
            dependenciesMap[req.productId].quantity += totalNeeded;
        });
    });

    // Recursively calculate dependencies
    Object.keys(dependenciesMap).forEach(depProductId => {
        const depQuantity = dependenciesMap[depProductId].quantity;
        const depResult = calculateRequirements(depProductId, depQuantity, timeAvailable, new Set(visited));
        dependenciesMap[depProductId].result = depResult;
    });

    return {
        productId: productId,
        productName: product.name,
        requestedQuantity: quantity,
        timeAvailable: timeAvailable,
        facilities: facilitiesNeeded,
        dependencies: dependenciesMap,
        feasible: isFeasible && product.producedIn?.length > 0
    };
}

// Display calculation results
function displayResults(result, productId) {
    const resultsSection = document.getElementById('results');
    const statusDiv = document.getElementById('resultStatus');
    const facilitiesDiv = document.getElementById('facilitiesNeeded');

    // Status message
    const product = productsData.find(p => p.id === productId);
    let statusHTML = `<h3>${product.name}</h3>`;
    
    if (!result.feasible) {
        statusHTML += '<p class="status-warning">⚠️ <strong>Warning:</strong> It may not be possible to produce the requested quantity in the given time with available facilities.</p>';
    } else {
        statusHTML += '<p class="status-success">✓ Production plan is feasible.</p>';
    }
    
    statusHTML += `<p class="status-details">Target: <strong>${result.requestedQuantity} units</strong> in <strong>${result.timeAvailable} time units</strong></p>`;
    statusDiv.innerHTML = statusHTML;

    // Build allocation view first (has properly aggregated quantities)
    const allocations = buildProductAllocations(result);
    const allFacilities = calculateFacilitiesFromAllocations(allocations, result.timeAvailable, result);
    
    // Derive facilities summary from properly aggregated allocations
    const allocationHTML = buildProductAllocationView(result, allocations);
    
    // Facilities summary
    let facilitiesHTML = '<h3>Total Facilities Summary</h3>';
    facilitiesHTML += '<div class="facilities-summary">';
    Object.values(allFacilities).forEach(fac => {
        if (fac.isAlternative) {
            // Show as alternatives
            facilitiesHTML += `
                <div class="facility-summary-card facility-summary-alternatives">
                    <div class="facility-summary-header">
                        <strong>${fac.name}</strong>
                    </div>
                    <div class="facility-summary-alternatives-list">
            `;
            fac.alternatives.forEach((alt, idx) => {
                facilitiesHTML += `
                    <div class="alternative-option">
                        <span class="alternative-letter">${String.fromCharCode(65 + idx)}</span>
                        <span class="alternative-name">${alt.name}</span>
                        <span class="alternative-count">${alt.needed} needed</span>
                    </div>
                `;
            });
            facilitiesHTML += `
                    </div>
                </div>
            `;
        } else {
            // Show as standard facility
            facilitiesHTML += `
                <div class="facility-summary-card">
                    <div class="facility-summary-header">
                        <strong>${fac.name}</strong> <span class="facility-id">(${fac.id})</span>
                    </div>
                    <div class="facility-summary-count">
                        <span class="count-number">${fac.totalCount}</span> facilities needed
                    </div>
                    <div class="facility-summary-products">
                        <small>Produces: ${fac.products.join(', ')}</small>
                    </div>
                </div>
            `;
        }
    });
    facilitiesHTML += '</div>';
    
    // Facilities breakdown by product
    facilitiesHTML += '<h3>Facilities by Product</h3>';
    facilitiesHTML += '<div class="facilities-list">';
    result.facilities.forEach(facility => {
        const facilityDef = facilitiesData.find(f => f.id === facility.id);
        const facilityName = facilityDef ? facilityDef.name : facility.name;
        facilitiesHTML += `
            <div class="facility-card">
                <h4>${facilityName} <span class="facility-id">(${facility.id})</span></h4>
                <div class="facility-details">
                    <p><strong>Facilities Needed for ${productsData.find(p => p.id === facility.producesProduct)?.name}:</strong> ${facility.facilitiesNeeded}</p>
                    <p><strong>Production Time per Cycle:</strong> ${facility.takesTime} time units</p>
                    <p><strong>Amount per Cycle:</strong> ${facility.amountPerCycle} units</p>
                    <p><strong>Cycles per Facility:</strong> ${(result.timeAvailable / facility.takesTime).toFixed(2)}</p>
                    <p><strong>Units per Facility:</strong> ${facility.unitsPerFacility.toFixed(2)} units</p>
                    <p><strong>Total Output:</strong> ${(facility.unitsPerFacility * facility.facilitiesNeeded).toFixed(2)} units</p>
                </div>
                ${facility.requirements.length > 0 ? `
                    <div class="requirements">
                        <strong>Requires per unit:</strong>
                        ${facility.requirements.map(req => `<span class="requirement-badge">${req.quantity}x ${req.productId}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });
    facilitiesHTML += '</div>';
    facilitiesDiv.innerHTML = facilitiesHTML;

    // Add product allocation view
    if (allocationHTML) {
        facilitiesDiv.innerHTML += allocationHTML;
    }

    // Build dependency tree
    buildDependencyTree(result);

    // Show results section
    resultsSection.style.display = 'block';
    document.getElementById('toggleTree').style.display = result.dependencies && Object.keys(result.dependencies).length > 0 ? 'block' : 'none';
}

// Build product allocations data structure (helper for displayResults)
function buildProductAllocations(result) {
    const allocations = {};
    
    function collectAllocations(node) {
        Object.entries(node.dependencies || {}).forEach(([depId, dep]) => {
            const productName = dep.result.productName;
            const quantity = dep.quantity;
            const consumer = node.productName;
            
            if (!allocations[productName]) {
                allocations[productName] = {
                    totalQuantity: 0,
                    producers: dep.result.facilities,
                    consumers: {}
                };
            }
            
            allocations[productName].totalQuantity += quantity;
            
            if (!allocations[productName].consumers[consumer]) {
                allocations[productName].consumers[consumer] = {
                    amount: 0,
                    facilities: []
                };
            }
            allocations[productName].consumers[consumer].amount += quantity;
            
            // Find which facilities consume this product
            node.facilities.forEach(facility => {
                facility.requirements?.forEach(req => {
                    if (req.productId === depId) {
                        const facilityInfo = {
                            id: facility.id,
                            name: getFacilityName(facility.id),
                            count: facility.facilitiesNeeded
                        };
                        
                        const existing = allocations[productName].consumers[consumer].facilities.find(f => f.id === facility.id);
                        if (!existing) {
                            allocations[productName].consumers[consumer].facilities.push(facilityInfo);
                        }
                    }
                });
            });
            
            collectAllocations(dep.result);
        });
    }
    
    collectAllocations(result);
    return allocations;
}

// Calculate facility requirements from properly aggregated allocations
function calculateFacilitiesFromAllocations(allocations, timeAvailable, result) {
    const facilities = {};
    
    // First, include the top-level product's facilities
    if (result && result.facilities) {
        result.facilities.forEach(facility => {
            const facilityId = facility.id;
            if (!facilities[facilityId]) {
                facilities[facilityId] = {
                    id: facilityId,
                    name: getFacilityName(facilityId),
                    totalCount: 0,
                    products: [],
                    isAlternative: false
                };
            }
            facilities[facilityId].totalCount += facility.facilitiesNeeded;
            const topProduct = productsData.find(p => p.id === result.productId);
            if (topProduct && !facilities[facilityId].products.includes(topProduct.name)) {
                facilities[facilityId].products.push(topProduct.name);
            }
        });
    }
    
    // For each product in allocations, calculate what facilities are needed
    Object.entries(allocations).forEach(([productName, alloc]) => {
        const product = productsData.find(p => p.name === productName);
        if (!product) return;
        
        // If this product has multiple facility options, pick the best one
        if (product.producedIn && product.producedIn.length > 1) {
            // Calculate facility count for each alternative
            const alternatives = product.producedIn.map(facility => {
                const cycles = timeAvailable / facility.takesTime;
                const amountPerCycle = product.amountProduced || 1;
                const unitsPerFacility = cycles * amountPerCycle;
                const facilitiesNeeded = unitsPerFacility > 0 ? Math.ceil(alloc.totalQuantity / unitsPerFacility) : 0;
                
                return {
                    facility: facility,
                    facilityId: facility.id,
                    facilitiesNeeded: facilitiesNeeded,
                    unitsPerFacility: unitsPerFacility
                };
            });
            
            // Pick the most efficient option (fewest facilities needed)
            const best = alternatives.reduce((prev, curr) => 
                curr.facilitiesNeeded < prev.facilitiesNeeded ? curr : prev
            );
            
            const facilityId = best.facilityId;
            const facilityName = getFacilityName(facilityId);
            
            if (!facilities[facilityId]) {
                facilities[facilityId] = {
                    id: facilityId,
                    name: facilityName,
                    totalCount: 0,
                    products: [],
                    isAlternative: false
                };
            }
            
            facilities[facilityId].totalCount += best.facilitiesNeeded;
            if (!facilities[facilityId].products.includes(productName)) {
                facilities[facilityId].products.push(productName);
            }
        } else {
            // Single facility option - no alternatives
            product.producedIn?.forEach(facility => {
                const facilityId = facility.id;
                const facilityName = getFacilityName(facilityId);
                
                const cycles = timeAvailable / facility.takesTime;
                const amountPerCycle = product.amountProduced || 1;
                const unitsPerFacility = cycles * amountPerCycle;
                const facilitiesNeeded = unitsPerFacility > 0 ? Math.ceil(alloc.totalQuantity / unitsPerFacility) : 0;
                
                if (!facilities[facilityId]) {
                    facilities[facilityId] = {
                        id: facilityId,
                        name: facilityName,
                        totalCount: 0,
                        products: [],
                        isAlternative: false
                    };
                }
                
                facilities[facilityId].totalCount += facilitiesNeeded;
                if (!facilities[facilityId].products.includes(productName)) {
                    facilities[facilityId].products.push(productName);
                }
            });
        }
    });
    
    return facilities;
}


// Aggregate facilities from result tree (used by dependency calculations)
function aggregateFacilities(result, facilities = {}, parentMultiplier = 1) {
    // Group facilities by what they produce (alternatives for the same product)
    const facilityByProduct = {};
    
    result.facilities.forEach(fac => {
        const key = fac.producesProduct;
        if (!facilityByProduct[key]) {
            facilityByProduct[key] = [];
        }
        facilityByProduct[key].push(fac);
    });
    
    // Process each product's facilities (which may be alternatives)
    Object.entries(facilityByProduct).forEach(([product, facs]) => {
        if (facs.length > 1) {
            // These are alternatives for the same product
            const groupKey = `alternatives_${product}`;
            
            const alternatives = facs.map(fac => ({
                id: fac.id,
                name: getFacilityName(fac.id),
                needed: fac.facilitiesNeeded * parentMultiplier,
            }));
            
            if (!facilities[groupKey]) {
                facilities[groupKey] = {
                    id: groupKey,
                    name: `${result.productName} (Choose ONE)`,
                    isAlternative: true,
                    alternatives: alternatives,
                    products: [result.productName]
                };
            }
        } else if (facs.length === 1) {
            // Single facility option
            const fac = facs[0];
            const facId = fac.id;
            const totalFacilitiesNeeded = fac.facilitiesNeeded * parentMultiplier;
            
            if (!facilities[facId]) {
                facilities[facId] = {
                    id: facId,
                    name: getFacilityName(facId),
                    totalCount: 0,
                    products: [],
                    isAlternative: false
                };
            }
            facilities[facId].totalCount += totalFacilitiesNeeded;
            if (!facilities[facId].products.includes(result.productName)) {
                facilities[facId].products.push(result.productName);
            }
        }
    });
    
    
    return facilities;
}

// Build product allocation view (bottom-up perspective with properly aggregated data)
function buildProductAllocationView(result, allocations) {
    if (Object.keys(allocations).length === 0) {
        return '';
    }
    
    // Calculate depth for each product (distance from raw materials)
    const depthCache = {};
    function calculateDepth(productName) {
        if (depthCache[productName] !== undefined) {
            return depthCache[productName];
        }
        
        const product = productsData.find(p => p.name === productName);
        
        // If no dependencies, it's a raw material (depth 0)
        if (!product || !product.producedIn || product.producedIn.length === 0) {
            depthCache[productName] = 0;
            return 0;
        }
        
        // Check if any facility has requires
        let hasRequires = false;
        let maxDepDependencyDepth = -1;
        
        product.producedIn?.forEach(facility => {
            facility.requires?.forEach(req => {
                hasRequires = true;
                const depProductName = productsData.find(p => p.id === req.productId)?.name;
                if (depProductName && allocations[depProductName]) {
                    const depDepth = calculateDepth(depProductName);
                    maxDepDependencyDepth = Math.max(maxDepDependencyDepth, depDepth);
                }
            });
        });
        
        const depth = !hasRequires ? 0 : (maxDepDependencyDepth === -1 ? 0 : maxDepDependencyDepth + 1);
        depthCache[productName] = depth;
        return depth;
    }
    
    // Calculate depth for all products
    Object.keys(allocations).forEach(productName => {
        allocations[productName].depth = calculateDepth(productName);
    });
    
    let html = '<h3>Product Flow & Distribution</h3>';
    html += '<p class="allocation-description">How intermediate products flow through the production chain</p>';
    html += '<div class="allocation-container">';
    
    // Sort by depth (ascending - raw materials first), then by quantity
    const sortedAllocations = Object.entries(allocations)
        .sort((a, b) => {
            if (a[1].depth !== b[1].depth) {
                return a[1].depth - b[1].depth;  // Raw materials (lower depth) first
            }
            return b[1].totalQuantity - a[1].totalQuantity;  // Then by quantity
        });
    
    sortedAllocations.forEach(([productName, alloc]) => {
        const percent = (amount, total) => ((amount / total) * 100).toFixed(1);
        
        // Calculate facility count for THIS SPECIFIC PRODUCT only
        const product = productsData.find(p => p.name === productName);
        let producingFacilitiesForThisProduct = [];
        
        if (product && product.producedIn) {
            // If multiple options, pick the best one (fewest needed)
            if (product.producedIn.length > 1) {
                const alternatives = product.producedIn.map(facility => {
                    const cycles = result.timeAvailable / facility.takesTime;
                    const amountPerCycle = product.amountProduced || 1;
                    const unitsPerFacility = cycles * amountPerCycle;
                    const facilitiesNeeded = unitsPerFacility > 0 ? Math.ceil(alloc.totalQuantity / unitsPerFacility) : 0;
                    
                    return {
                        facility: facility,
                        facilityId: facility.id,
                        facilitiesNeeded: facilitiesNeeded,
                        unitsPerFacility: unitsPerFacility
                    };
                });
                
                // Pick the most efficient option
                const best = alternatives.reduce((prev, curr) => 
                    curr.facilitiesNeeded < prev.facilitiesNeeded ? curr : prev
                );
                
                producingFacilitiesForThisProduct = [{
                    id: best.facilityId,
                    name: getFacilityName(best.facilityId),
                    count: best.facilitiesNeeded
                }];
            } else {
                // Single facility option
                product.producedIn.forEach(facility => {
                    const cycles = result.timeAvailable / facility.takesTime;
                    const amountPerCycle = product.amountProduced || 1;
                    const unitsPerFacility = cycles * amountPerCycle;
                    const facilitiesNeeded = unitsPerFacility > 0 ? Math.ceil(alloc.totalQuantity / unitsPerFacility) : 0;
                    
                    producingFacilitiesForThisProduct.push({
                        id: facility.id,
                        name: getFacilityName(facility.id),
                        count: facilitiesNeeded
                    });
                });
            }
        }
        
        html += `<div class="allocation-card">`;
        html += `<div class="allocation-header">`;
        html += `<span class="allocation-product">${productName}</span>`;
        html += `<span class="allocation-total">${alloc.totalQuantity.toFixed(1)} units total</span>`;
        html += `</div>`;
        
        // Show producers with per-product counts
        html += `<div class="allocation-producers">`;
        html += `<span class="allocation-label">Produced by:</span>`;
        const producerText = producingFacilitiesForThisProduct.map(fac => {
            return `<span class="facility-badge">${fac.name} ×${fac.count}</span>`;
        }).join('');
        html += producerText || '<span class="facility-badge">No facilities found</span>';
        html += `</div>`;
        
        // Show distribution to consumers
        html += `<div class="allocation-distribution">`;
        html += `<span class="allocation-label">Distributed to:</span>`;
        html += `<div class="consumer-breakdown">`;
        
        Object.entries(alloc.consumers)
            .sort((a, b) => b[1].amount - a[1].amount)
            .forEach(([consumer, consumerData]) => {
                const pct = percent(consumerData.amount, alloc.totalQuantity);
                html += `<div class="consumer-item">`;
                html += `<div class="consumer-info">`;
                html += `<span class="consumer-name">${consumer}</span>`;
                html += `<span class="consumer-amount">${consumerData.amount.toFixed(1)} units (${pct}%)</span>`;
                
                // Show which facilities consume this product
                if (consumerData.facilities.length > 0) {
                    html += `<div class="consumer-facilities">`;
                    consumerData.facilities.forEach(fac => {
                        html += `<span class="consumer-facility-badge">${fac.name} (×${fac.count})</span>`;
                    });
                    html += `</div>`;
                }
                html += `</div>`;
                html += `<div class="consumer-bar">`;
                html += `<div class="consumer-bar-fill" style="width: ${pct}%"></div>`;
                html += `</div>`;
                html += `</div>`;
            });
        
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
    });
    
    html += '</div>';
    return html;
}

// Helper function to get facility name from ID
function getFacilityName(facilityId) {
    const facility = facilitiesData.find(f => f.id === facilityId);
    return facility ? facility.name : facilityId;
}

// Build and display dependency tree
function buildDependencyTree(result) {
    const treeDiv = document.getElementById('dependencyTree');
    let treeHTML = '<h3>Dependency Chain</h3>';
    
    if (!result.dependencies || Object.keys(result.dependencies).length === 0) {
        treeHTML += '<p>This product has no dependencies.</p>';
        treeDiv.innerHTML = treeHTML;
        return;
    }

    treeHTML += '<div class="tree-container">';
    treeHTML += buildTreeNode(result, 0);
    treeHTML += '</div>';
    
    treeDiv.innerHTML = treeHTML;
}

// Recursively build tree nodes
function buildTreeNode(result, depth) {
    let html = '';
    
    html += `<div class="tree-node" data-depth="${depth}">`;
    html += `<div class="tree-node-header">`;
    html += `<span class="tree-product">${result.productName}</span>`;
    html += `<span class="tree-quantity">(${result.requestedQuantity.toFixed(1)} units)</span>`;
    html += `</div>`;
    
    if (result.dependencies && Object.keys(result.dependencies).length > 0) {
        html += '<div class="tree-dependencies">';
        Object.entries(result.dependencies).forEach(([depId, dep]) => {
            html += `<div class="tree-child">`;
            html += `<div class="tree-requirement">`;
            html += `<span class="tree-dep">${dep.result.productName}</span>`;
            html += `<span class="tree-quantity">(${dep.quantity.toFixed(1)} units needed)</span>`;
            html += `</div>`;
            
            // Show facilities as options if there are multiple alternatives
            html += `<div class="tree-facilities">`;
            if (dep.result.facilities.length > 1) {
                html += `<div class="tree-facility-label">Choose ONE of:</div>`;
                dep.result.facilities.forEach((fac, idx) => {
                    const facilityName = getFacilityName(fac.id);
                    html += `<div class="tree-facility tree-facility-option">
                        <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
                        <span class="option-text">${facilityName} <span class="facility-id">(${fac.id})</span> ×${fac.facilitiesNeeded}</span>
                    </div>`;
                });
            } else {
                dep.result.facilities.forEach(fac => {
                    const facilityName = getFacilityName(fac.id);
                    html += `<div class="tree-facility">${facilityName} <span class="facility-id">(${fac.id})</span> ×${fac.facilitiesNeeded}</div>`;
                });
            }
            html += `</div>`;
            
            if (dep.result.dependencies && Object.keys(dep.result.dependencies).length > 0) {
                html += buildTreeNode(dep.result, depth + 1);
            }
            html += `</div>`;
        });
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

// Toggle tree visibility
function toggleTree() {
    const treeDiv = document.getElementById('dependencyTree');
    const button = document.getElementById('toggleTree');
    
    if (treeDiv.style.display === 'none') {
        treeDiv.style.display = 'block';
        button.textContent = 'Hide Dependency Tree';
    } else {
        treeDiv.style.display = 'none';
        button.textContent = 'Show Dependency Tree';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMsg = document.getElementById('errorMessage');
    errorMsg.textContent = message;
    errorDiv.style.display = 'block';
}
