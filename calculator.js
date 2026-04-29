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

// Populate the product dropdown
function populateProductDropdown() {
    const select = document.getElementById('product');
    // Sort products alphabetically by name
    const sortedProducts = [...productsData].sort((a, b) => a.name.localeCompare(b.name));
    sortedProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        select.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('calculatorForm').addEventListener('submit', handleCalculate);
    document.getElementById('toggleTree').addEventListener('click', toggleTree);
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
    // Don't separate per facility - all alternatives produce the same output
    product.producedIn?.forEach(facility => {
        facility.requires?.forEach(req => {
            // Total quantity needed is the same regardless of which facility option we choose
            // (they all produce the requested quantity)
            const totalNeeded = req.quantity * quantity; // Based on the PRODUCT, not per facility
            
            if (!dependenciesMap[req.productId]) {
                dependenciesMap[req.productId] = {
                    quantity: 0,
                    facilities: []
                };
            }
            dependenciesMap[req.productId].quantity = Math.max(
                dependenciesMap[req.productId].quantity, 
                totalNeeded
            );
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

    // Aggregate all facilities needed throughout the chain
    const allFacilities = aggregateFacilities(result);
    
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

    // Build dependency tree
    buildDependencyTree(result);

    // Show results section
    resultsSection.style.display = 'block';
    document.getElementById('toggleTree').style.display = result.dependencies && Object.keys(result.dependencies).length > 0 ? 'block' : 'none';
}

// Aggregate facilities from the entire dependency tree, multiplying counts properly
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
    
    // Recursively aggregate from dependencies
    // Dependencies are calculated based on total quantity needs, not facility counts
    // So we don't multiply downstream - the quantity is already correct
    Object.values(result.dependencies).forEach(dep => {
        if (dep.result) {
            aggregateFacilities(dep.result, facilities, 1);
        }
    });
    
    return facilities;
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
