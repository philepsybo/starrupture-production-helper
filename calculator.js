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
        const amountPerCycle = facility.amountProduced || 1;
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

    // If multiple facility options exist, pick the best one (fewest facilities needed)
    // and calculate dependencies based only on that option, not all of them
    let chosenFacility = null;
    
    if (product.producedIn && product.producedIn.length > 1 && facilitiesNeeded.length > 0) {
        // Find the facility option that needs the fewest facilities
        const best = facilitiesNeeded.reduce((prev, curr) => 
            curr.facilitiesNeeded < prev.facilitiesNeeded ? curr : prev
        );
        chosenFacility = product.producedIn.find(f => f.id === best.id);
    } else if (product.producedIn && product.producedIn.length === 1) {
        // Single option, use it
        chosenFacility = product.producedIn[0];
    }

    // Calculate dependencies based on the chosen facility (not all alternatives)
    if (chosenFacility && chosenFacility.requires) {
        chosenFacility.requires.forEach(req => {
            // Account for amountProduced: if we need 200 powder but each cycle makes 3,
            // we only need ceil(200/3) amounts of the input, not 200
            const amountPerCycle = chosenFacility.amountProduced || 1;
            const recipesNeeded = Math.ceil(quantity / amountPerCycle);
            const totalNeeded = req.quantity * recipesNeeded;
            
            if (!dependenciesMap[req.productId]) {
                dependenciesMap[req.productId] = {
                    quantity: 0,
                    facilities: []
                };
            }
            // Use only the chosen facility's requirements
            dependenciesMap[req.productId].quantity = totalNeeded;
        });
    }

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
        chosenFacility: chosenFacility,
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
    facilitiesHTML += '<h3>Final stage facilities</h3>';
    facilitiesHTML += '<div class="facilities-list">';
    
    // Filter to show only the best facility option (fewest needed) when there are alternatives
    const facilitiesToDisplay = result.facilities.length > 1 
        ? [result.facilities.reduce((prev, curr) => 
            curr.facilitiesNeeded < prev.facilitiesNeeded ? curr : prev
        )]
        : result.facilities;
    
    facilitiesToDisplay.forEach(facility => {
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

    // Show results section
    resultsSection.style.display = 'block';
    
    // Initialize checkbox listeners
    initializeCheckboxListeners();
}

// Build product allocations data structure (helper for displayResults)
function buildProductAllocations(result) {
    const allocations = {};
    const facilityMap = {}; // Track facility requirements for later calculation
    
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
            
            // Find which facilities consume this product - record them for later count calculation
            node.facilities.forEach(facility => {
                facility.requirements?.forEach(req => {
                    if (req.productId === depId) {
                        // Record facility relationship for later calculation when all amounts are known
                        const key = `${productName}|${consumer}|${facility.id}`;
                        if (!facilityMap[key]) {
                            facilityMap[key] = {
                                productName: productName,
                                consumer: consumer,
                                facility: facility,
                                req: req
                            };
                        }
                    }
                });
            });
            
            collectAllocations(dep.result);
        });
    }
    
    collectAllocations(result);
    
    // Second pass: Calculate facility counts based on final accumulated amounts
    Object.entries(facilityMap).forEach(([, data]) => {
        const consumerAmount = allocations[data.productName].consumers[data.consumer].amount;
        
        // Recalculate unitsPerFacility for this facility
        // This is how much output (consumer product) one facility can make in the time window
        const cycles = result.timeAvailable / data.facility.takesTime;
        const amountPerCycle = data.facility.amountProduced || 1;
        const outputPerFacility = cycles * amountPerCycle;
        
        // Input needed per unit of output
        const inputPerOutputUnit = data.req.quantity;
        
        // Total input capacity per facility
        const inputCapacityPerFacility = outputPerFacility * inputPerOutputUnit;
        
        // How many of this facility needed to satisfy the input amount
        const facilitiesNeededForThisInput = inputCapacityPerFacility > 0 
            ? Math.ceil(consumerAmount / inputCapacityPerFacility)
            : 0;
        
        const facilityInfo = {
            id: data.facility.id,
            name: getFacilityName(data.facility.id),
            count: facilitiesNeededForThisInput
        };
        
        allocations[data.productName].consumers[data.consumer].facilities.push(facilityInfo);
    });
    
    return allocations;
}

// Calculate facility requirements from properly aggregated allocations
function calculateFacilitiesFromAllocations(allocations, timeAvailable, result) {
    const facilities = {};
    
    // For the top-level product, if it has multiple facility options, pick the best one
    if (result && result.facilities && result.facilities.length > 0) {
        let facilitiesToAdd = result.facilities;
        
        // If multiple options exist, pick the one needing fewest facilities
        if (result.facilities.length > 1) {
            const best = result.facilities.reduce((prev, curr) => 
                curr.facilitiesNeeded < prev.facilitiesNeeded ? curr : prev
            );
            facilitiesToAdd = [best];
        }
        
        facilitiesToAdd.forEach(facility => {
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
                const amountPerCycle = facility.amountProduced || 1;
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
                const amountPerCycle = facility.amountProduced || 1;
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
                    const amountPerCycle = facility.amountProduced || 1;
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
                    const amountPerCycle = facility.amountProduced || 1;
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
        
        html += `</div>`;  // close consumer-breakdown
        html += `</div>`;  // close allocation-distribution
        
        // Add progress checkboxes
        const safeId = productName.replace(/[^a-zA-Z0-9]/g, '_');
        html += `<div class="card-progress">`;
        html += `<span class="progress-title">Production Progress:</span>`;
        html += `<div class="checkbox-group">`;
        html += `<div class="checkbox-item">`;
        html += `<input type="checkbox" id="build-${safeId}" class="progress-checkbox">`;
        html += `<label for="build-${safeId}">Build facilities</label>`;
        html += `</div>`;
        html += `<div class="checkbox-item">`;
        html += `<input type="checkbox" id="storage-${safeId}" class="progress-checkbox">`;
        html += `<label for="storage-${safeId}">Build storage/intermediate storage</label>`;
        html += `</div>`;
        html += `<div class="checkbox-item">`;
        html += `<input type="checkbox" id="transport-${safeId}" class="progress-checkbox">`;
        html += `<label for="transport-${safeId}">Set up transportation</label>`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
        
        html += `</div>`;  // close allocation-card
    });
    
    html += '</div>';
    return html;
}

// Helper function to get facility name from ID
function getFacilityName(facilityId) {
    const facility = facilitiesData.find(f => f.id === facilityId);
    return facility ? facility.name : facilityId;
}

// Initialize checkbox listeners for card completion effect
function initializeCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.progress-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Find the parent card
            const card = checkbox.closest('.allocation-card');
            if (!card) return;
            
            // Check if all checkboxes in this card are checked
            const cardCheckboxes = card.querySelectorAll('.progress-checkbox');
            const allChecked = Array.from(cardCheckboxes).every(cb => cb.checked);
            
            // Add or remove completed class
            if (allChecked) {
                card.classList.add('card-completed');
            } else {
                card.classList.remove('card-completed');
            }
        });
    });
}

// Build and display dependency tree


// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMsg = document.getElementById('errorMessage');
    errorMsg.textContent = message;
    errorDiv.style.display = 'block';
}
