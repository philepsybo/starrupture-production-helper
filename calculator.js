// Global products and facilities data
let productsData = [];
let facilitiesData = [];

// Scroll to a card by product name
function scrollToCard(productName) {
    // Find the card with the matching product name
    const cards = document.querySelectorAll('.allocation-card');
    for (let card of cards) {
        const productHeader = card.querySelector('.allocation-product');
        if (productHeader && productHeader.textContent === productName) {
            // Scroll the card into view
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }
}

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
    
    // Determine which products to show
    let productsToShow;
    if (searchTerm === '') {
        // Show all products alphabetically sorted when search is empty
        productsToShow = window.sortedProducts;
    } else {
        // Filter products based on search term
        productsToShow = window.sortedProducts.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.id.toLowerCase().includes(searchTerm)
        );
    }
    
    // Build dropdown HTML
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
        filterProductDropdown();
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

// Generate material flow graph data and provide link to open in new tab
function displayMaterialFlowGraph(result, container) {
    let nodeCounter = 0;
    const nodeMap = new Map(); // Map product names to node IDs for deduplication
    const edgesAdded = new Set(); // Track edges to avoid duplicates
    let mermaidCode = 'graph TD\n';
    
    const nodeId = (name, quantity) => {
        const key = `${name}_${quantity}`;
        if (!nodeMap.has(key)) {
            nodeMap.set(key, `N${nodeCounter++}`);
        }
        return nodeMap.get(key);
    };
    
    // Recursively build the mermaid graph
    function traverseResult(node) {
        const nId = nodeId(node.productName, node.requestedQuantity);
        mermaidCode += `    ${nId}["${node.productName}<br/>${node.requestedQuantity} units"]\n`;
        
        if (node.dependencies && Object.keys(node.dependencies).length > 0) {
            Object.entries(node.dependencies).forEach(([depId, dep]) => {
                if (dep.result) {
                    const depNodeId = nodeId(dep.result.productName, dep.quantity);
                    mermaidCode += `    ${depNodeId}["${dep.result.productName}<br/>${dep.quantity} units"]\n`;
                    
                    // Create unique edge key to avoid duplicates
                    const edgeKey = `${nId}-->${depNodeId}`;
                    if (!edgesAdded.has(edgeKey)) {
                        mermaidCode += `    ${nId} -->|uses| ${depNodeId}\n`;
                        edgesAdded.add(edgeKey);
                    }
                    
                    traverseResult(dep.result);
                }
            });
        }
    }
    
    traverseResult(result);
    
    // Render the mermaid diagram
    mermaidCode += '    classDef product fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff\n';
    
    // Display simple button to open graph
    container.innerHTML = `
        <div class="graph-link-section">
            <button class="graph-open-btn" id="openGraphButton" title="Open Material Flow Diagram in New Tab">
                📊 View Material Flow Diagram
            </button>
        </div>
    `;
    
    // Set up click handler
    document.getElementById('openGraphButton')?.addEventListener('click', () => {
        openGraphFullscreen(mermaidCode);
    });
}

// Open graph in a maximized view
function openGraphFullscreen(mermaidCode) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Material Flow Graph</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.min.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #f9f9f9;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .fullscreen-container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .fullscreen-controls {
            background: white;
            padding: 12px;
            border-bottom: 1px solid #ddd;
            display: flex;
            gap: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .fullscreen-btn {
            padding: 8px 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s ease;
        }
        .fullscreen-btn:hover {
            background: #764ba2;
        }
        .graph-wrapper {
            flex: 1;
            overflow: hidden;
            position: relative;
        }
        .graph-wrapper svg {
            width: 100%;
            height: 100%;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div class="fullscreen-container">
        <div class="fullscreen-controls">
            <button class="fullscreen-btn" onclick="zoomIn()">🔍+ Zoom In</button>
            <button class="fullscreen-btn" onclick="zoomOut()">🔍− Zoom Out</button>
            <button class="fullscreen-btn" onclick="resetZoom()">⟲ Reset</button>
            <button class="fullscreen-btn" onclick="window.close()">✕ Close</button>
        </div>
        <div class="graph-wrapper">
            <div class="mermaid">${mermaidCode}</div>
        </div>
    </div>
    <script>
        let zoom = 1;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let startX = 0;
        let startY = 0;
        
        mermaid.contentLoaded();
        
        setTimeout(() => {
            const svg = document.querySelector('svg');
            const g = svg?.querySelector('g');
            if (g) {
                g.setAttribute('data-transformable', 'true');
                
                const updateTransform = () => {
                    g.setAttribute('transform', \`translate(\${panX}, \${panY}) scale(\${zoom})\`);
                };
                
                window.zoomIn = () => {
                    zoom = Math.min(zoom + 0.2, 3);
                    updateTransform();
                };
                
                window.zoomOut = () => {
                    zoom = Math.max(zoom - 0.2, 0.5);
                    updateTransform();
                };
                
                window.resetZoom = () => {
                    zoom = 1;
                    panX = 0;
                    panY = 0;
                    updateTransform();
                };
                
                const wrapper = document.querySelector('.graph-wrapper');
                wrapper.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
                    zoom = Math.min(Math.max(zoom + zoomDelta, 0.5), 3);
                    updateTransform();
                }, { passive: false });
                
                svg.addEventListener('mousedown', (e) => {
                    isPanning = true;
                    startX = e.clientX - panX;
                    startY = e.clientY - panY;
                    svg.style.cursor = 'grabbing';
                });
                
                document.addEventListener('mousemove', (e) => {
                    if (isPanning) {
                        panX = e.clientX - startX;
                        panY = e.clientY - startY;
                        updateTransform();
                    }
                });
                
                document.addEventListener('mouseup', () => {
                    isPanning = false;
                    svg.style.cursor = 'grab';
                });
                
                svg.style.cursor = 'grab';
            }
        }, 500);
    </script>
</body>
</html>
    `;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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

    // Display material flow graph
    const graphDiv = document.getElementById('materialFlowGraph');
    displayMaterialFlowGraph(result, graphDiv);

    // Build allocation view first (has properly aggregated quantities)
    const allocations = buildProductAllocations(result);
    const allFacilities = calculateFacilitiesFromAllocations(allocations, result.timeAvailable, result);
    
    // Debug: Log facility calculation results
    const totalFacilitiesCount = Object.values(allFacilities).reduce((sum, fac) => sum + fac.totalCount, 0);
    console.log(`calculateFacilitiesFromAllocations found ${totalFacilitiesCount} facilities`);
    
    // Calculate total facility construction cost
    const facilityCost = calculateFacilityCost(allFacilities);
    
    // Derive facilities summary from properly aggregated allocations
    const allocationHTML = buildProductAllocationView(result, allocations);
    
    // Facilities summary
    
    let facilitiesHTML = '<h3>Building Materials Required</h3>';
    facilitiesHTML += '<div class="cost-summary-compact">';
    facilitiesHTML += `<div class="cost-item-simple">`;
    facilitiesHTML += `<span class="cost-item-label">Basic Building Material:</span>`;
    facilitiesHTML += `<span class="cost-item-value">${facilityCost.basicBuildingMaterial}</span>`;
    facilitiesHTML += `</div>`;
    facilitiesHTML += `<div class="cost-item-simple">`;
    facilitiesHTML += `<span class="cost-item-label">Intermediate Building Material:</span>`;
    facilitiesHTML += `<span class="cost-item-value">${facilityCost.intermediateBuildingMaterial}</span>`;
    facilitiesHTML += `</div>`;
    facilitiesHTML += `<p class="cost-note">⚠️ Additional materials for transportation and storage may be needed.</p>`;
    facilitiesHTML += '</div>';
    
    facilitiesHTML += '<h3>Total Facilities Summary</h3>';
    facilitiesHTML += '<div class="facilities-list-compact">';
    Object.values(allFacilities).forEach(fac => {
        if (fac.isAlternative) {
            // Show as alternatives in list format
            facilitiesHTML += `<div class="facility-list-item">`;
            facilitiesHTML += `<span class="facility-name">${fac.name}:</span>`;
            fac.alternatives.forEach((alt, idx) => {
                facilitiesHTML += ` <span class="alternative-badge">${String.fromCharCode(65 + idx)}: ${alt.name} (${alt.needed}×)</span>`;
            });
            facilitiesHTML += `</div>`;
        } else {
            // Show as standard facility in list format
            const producesText = fac.products.join(', ');
            facilitiesHTML += `<div class="facility-list-item">`;
            facilitiesHTML += `<span class="facility-name-count">${fac.name}:</span> `;
            facilitiesHTML += `<span class="facility-count-badge">${fac.totalCount}×</span> `;
            facilitiesHTML += `<span class="facility-produces">produces: ${producesText}</span>`;
            facilitiesHTML += `</div>`;
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
    const productToFacility = {}; // Map of productName → chosen facilityId
    
    // First pass: map which facility produces each product  
    function mapChosenFacilities(node) {
        if (node && node.productName && node.chosenFacility) {
            productToFacility[node.productName] = node.chosenFacility.id;
        }
        if (node && node.dependencies) {
            Object.values(node.dependencies).forEach(dep => {
                if (dep.result) mapChosenFacilities(dep.result);
            });
        }
    }
    
    mapChosenFacilities(result);
    
    // Second pass: build allocations with proper consumer-to-facility mapping
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
            
            collectAllocations(dep.result);
        });
    }
    
    collectAllocations(result);
    
    // Second pass: Pre-calculate facility counts per consumer (not per product)
    // This ensures all ingredients going to the same consumer show the same facility count
    const facilityCountPerConsumer = {}; // "ConsumerName|FacilityId" -> count
    
    Object.entries(allocations).forEach(([productName, alloc]) => {
        Object.entries(alloc.consumers).forEach(([consumer, consumerData]) => {
            const consumerFacilityId = productToFacility[consumer];
            const cacheKey = `${consumer}|${consumerFacilityId}`;
            
            // Only calculate once per consumer/facility combo
            if (consumerFacilityId && !facilityCountPerConsumer[cacheKey]) {
                const consumerFacility = productsData.flatMap(p => p.producedIn || [])
                    .find(f => f.id === consumerFacilityId);
                
                if (consumerFacility) {
                    const cycles = result.timeAvailable / consumerFacility.takesTime;
                    const amountPerCycle = consumerFacility.amountProduced || 1;
                    const productionPerFacility = cycles * amountPerCycle;
                    
                    // Get total amount of consumer being produced
                    // For intermediate products, sum what all ingredients deliver to this consumer
                    let consumerTotal = 0;
                    
                    if (consumer === result.productName) {
                        // Target product
                        consumerTotal = result.requestedQuantity;
                    } else {
                        // Intermediate product - sum amounts from all ingredients going to it
                        Object.entries(allocations).forEach(([ingredientName, ingredientAlloc]) => {
                            if (ingredientAlloc.consumers[consumer]) {
                                consumerTotal += ingredientAlloc.consumers[consumer].amount;
                            }
                        });
                    }
                    
                    const facilitiesNeeded = productionPerFacility > 0
                        ? Math.ceil(consumerTotal / productionPerFacility)
                        : 0;
                    
                    facilityCountPerConsumer[cacheKey] = facilitiesNeeded;
                }
            }
        });
    });
    
    // Third pass: Add facilities to each product/consumer using cached counts
    Object.entries(allocations).forEach(([productName, alloc]) => {
        Object.entries(alloc.consumers).forEach(([consumer, consumerData]) => {
            const consumerFacilityId = productToFacility[consumer];
            const cacheKey = `${consumer}|${consumerFacilityId}`;
            
            if (consumerFacilityId && !consumerData.facilities.find(f => f.id === consumerFacilityId)) {
                const facilitiesNeeded = facilityCountPerConsumer[cacheKey] || 0;
                
                consumerData.facilities.push({
                    id: consumerFacilityId,
                    name: getFacilityName(consumerFacilityId),
                    count: facilitiesNeeded
                });
            }
        });
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
        html += `<div class="product-info">`;
        html += `<span class="allocation-product">${productName}</span>`;
        
        // Get input materials ONLY from the chosen facility
        const inputMaterials = new Set();
        
        if (product && product.producedIn && producingFacilitiesForThisProduct.length > 0) {
            // Get the ID of the chosen facility
            const chosenFacilityId = producingFacilitiesForThisProduct[0].id;
            
            // Find that facility and get only its requirements
            const chosenFacility = product.producedIn.find(f => f.id === chosenFacilityId);
            
            if (chosenFacility && chosenFacility.requires) {
                chosenFacility.requires.forEach(req => {
                    const inputProductName = productsData.find(p => p.id === req.productId)?.name;
                    if (inputProductName) {
                        inputMaterials.add(inputProductName);
                    }
                });
            }
        }
        
        // Display input materials if any
        if (inputMaterials.size > 0) {
            const inputList = Array.from(inputMaterials).sort()
                .map(mat => `<a class="material-link" onclick="scrollToCard('${mat.replace(/'/g, "\\'")}'); return false;" href="#${mat.replace(/[^a-zA-Z0-9]/g, '_')}">${mat}</a>`)
                .join(', ');
            html += `<div class="input-materials">Requires: ${inputList}</div>`;
        }
        
        html += `</div>`;
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
                html += `<a class="material-link consumer-name" onclick="scrollToCard('${consumer.replace(/'/g, "\\'")}'); return false;" href="#${consumer.replace(/[^a-zA-Z0-9]/g, '_')}">${consumer}</a>`;
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
        html += `<span class="progress-title">Progress:</span>`;
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

// Calculate total cost for facility construction
function calculateFacilityCost(allFacilities) {
    let basicBuildingMaterial = 0;
    let intermediateBuildingMaterial = 0;
    
    Object.values(allFacilities).forEach(fac => {
        if (fac.isAlternative) {
            // For alternatives, we only pick one (the best/first one shown)
            // but since alternatives aren't really "built", this shouldn't happen in the final result
            return;
        }
        
        const facilityData = facilitiesData.find(f => f.id === fac.id);
        if (facilityData && facilityData.cost) {
            const unitsNeeded = fac.totalCount;
            basicBuildingMaterial += (facilityData.cost.basicBuildingMaterial || 0) * unitsNeeded;
            intermediateBuildingMaterial += (facilityData.cost.intermediateBuildingMaterial || 0) * unitsNeeded;
        }
    });
    
    return {
        basicBuildingMaterial: basicBuildingMaterial,
        intermediateBuildingMaterial: intermediateBuildingMaterial,
        total: basicBuildingMaterial + intermediateBuildingMaterial
    };
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
