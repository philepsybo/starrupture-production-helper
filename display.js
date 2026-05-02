// display.js
// Handles rendering of calculation results

import { productsData, facilitiesData } from './data.js';
import { displayMaterialFlowGraph } from './graph.js';
import { buildProductAllocations, calculateFacilitiesFromAllocations, calculateFacilityCost } from './display-helpers.js';
import { getFacilityName } from './utils.js';

export function displayResults(result, productId) {
    const resultsSection = document.getElementById('results');
    const statusDiv = document.getElementById('resultStatus');
    const facilitiesDiv = document.getElementById('facilitiesNeeded');
    const allocationsDiv = document.getElementById('productAllocations');
    const costDiv = document.getElementById('facilityCost');

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

    // Build allocations and facilities summary
    const allocations = buildProductAllocations(result);
    const facilities = calculateFacilitiesFromAllocations(allocations, result.timeAvailable, result);
    const facilityCost = calculateFacilityCost(facilities);

    // First pass: build a map of product name -> chosen {facilityName, count}
    const producedByMap = {};
    Object.entries(allocations).forEach(([productName, alloc]) => {
        const product = productsData.find(p => p.name === productName);
        let producingFacilities = [];
        if (product && product.producedIn) {
            if (product.producedIn.length > 1) {
                const alternatives = product.producedIn.map(facility => {
                    const cycles = result.timeAvailable / facility.takesTime;
                    const amountPerCycle = facility.amountProduced || 1;
                    const unitsPerFacility = cycles * amountPerCycle;
                    const facilitiesNeeded = unitsPerFacility > 0 ? Math.ceil(alloc.totalQuantity / unitsPerFacility) : 0;
                    return {
                        id: facility.id,
                        name: getFacilityName(facility.id),
                        count: facilitiesNeeded
                    };
                });
                const best = alternatives.reduce((prev, curr) => curr.count < prev.count ? curr : prev);
                producingFacilities = [best];
            } else {
                product.producedIn.forEach(facility => {
                    const cycles = result.timeAvailable / facility.takesTime;
                    const amountPerCycle = facility.amountProduced || 1;
                    const unitsPerFacility = cycles * amountPerCycle;
                    const facilitiesNeeded = unitsPerFacility > 0 ? Math.ceil(alloc.totalQuantity / unitsPerFacility) : 0;
                    producingFacilities.push({
                        id: facility.id,
                        name: getFacilityName(facility.id),
                        count: facilitiesNeeded
                    });
                });
            }
        }
        producedByMap[productName] = producingFacilities;
    });    

    // Facilities summary as a compact list
    let facilitiesHTML = '<h3>Facilities Needed</h3>';
    facilitiesHTML += '<ul class="facilities-list-compact">';
    Object.values(facilities).forEach(fac => {
        if (fac.isAlternative) {
            facilitiesHTML += `<li class="facility-list-item"><span class="facility-name">${fac.name}</span> <span class="alternative-badge">Alternative</span> <span class="facility-produces">Choose one of: ${fac.alternatives.map(alt => `${alt.name} (×${alt.needed})`).join(', ')}</span></li>`;
        } else {
            facilitiesHTML += `<li class="facility-list-item"><span class="facility-name">${fac.name}</span> <span class="facility-count-badge">×${fac.totalCount}</span> <span class="facility-produces">for ${fac.products.join(', ')}</span></li>`;
        }
    });
    facilitiesHTML += '</ul>';
    facilitiesDiv.innerHTML = facilitiesHTML;

    // Product allocations (flow/distribution, sorted by depth, with facility counts)
    // Calculate depth for each product (distance from raw materials)
    const depthCache = {};
    function calculateDepth(productName) {
        if (depthCache[productName] !== undefined) return depthCache[productName];
        const product = productsData.find(p => p.name === productName);
        if (!product || !product.producedIn || product.producedIn.length === 0) {
            depthCache[productName] = 0;
            return 0;
        }
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
    Object.keys(allocations).forEach(productName => {
        allocations[productName].depth = calculateDepth(productName);
    });
    let allocationsHTML = '<h3>Product Flow & Distribution</h3>';
    allocationsHTML += '<div class="allocation-container">';
    // Sort by depth (raw materials first), then by quantity
    const sortedAllocations = Object.entries(allocations)
        .sort((a, b) => {
            if (a[1].depth !== b[1].depth) {
                return a[1].depth - b[1].depth;
            }
            return b[1].totalQuantity - a[1].totalQuantity;
        });
    sortedAllocations.forEach(([productName, alloc]) => {
        allocationsHTML += `<div class="allocation-card">`;
        allocationsHTML += `<div class="allocation-header">`;
        allocationsHTML += `<div class="product-info">`;
        allocationsHTML += `<span class="allocation-product">${productName}</span>`;
        // Show input materials for the actual chosen facility
        const product = productsData.find(p => p.name === productName);
        let inputMaterials = [];
        let chosenFacilityId = null;
        if (producedByMap[productName] && producedByMap[productName].length > 0) {
            chosenFacilityId = producedByMap[productName][0].id;
        }
        let chosenFacility = null;
        if (product && product.producedIn && product.producedIn.length > 0) {
            if (chosenFacilityId) {
                chosenFacility = product.producedIn.find(fac => fac.id === chosenFacilityId) || product.producedIn[0];
            } else {
                chosenFacility = product.producedIn[0];
            }
            if (chosenFacility && chosenFacility.requires && chosenFacility.amountProduced) {
                // Calculate how many cycles are needed to produce alloc.totalQuantity
                const cyclesNeeded = alloc.totalQuantity / chosenFacility.amountProduced;
                chosenFacility.requires.forEach(req => {
                    const inputProduct = productsData.find(p => p.id === req.productId);
                    if (inputProduct) {
                        // Total required = per-cycle quantity * cycles needed
                        const totalRequired = req.quantity * cyclesNeeded;
                        inputMaterials.push({
                            name: inputProduct.name,
                            quantity: req.quantity,
                            totalRequired: totalRequired
                        });
                    }
                });
            }
        }
        if (inputMaterials.length > 0) {
            inputMaterials.sort((a, b) => a.name.localeCompare(b.name));
            const inputList = inputMaterials
                .map(mat => `<a class="material-link" onclick="scrollToCard('${mat.name.replace(/'/g, "\\'")}'); return false;" href="#${mat.name.replace(/[^a-zA-Z0-9]/g, '_')}">${mat.name}</a> ×${mat.totalRequired % 1 === 0 ? mat.totalRequired : mat.totalRequired.toFixed(2)}`)
                .join(', ');
            allocationsHTML += `<div class="input-materials">Requires: ${inputList}</div>`;
        }
        allocationsHTML += `<span class="allocation-total">${alloc.totalQuantity.toFixed(1)} units</span>`;
        allocationsHTML += `</div>`; // close product-info
        allocationsHTML += `</div>`; // close allocation-header
        // Show producers with per-product counts
        allocationsHTML += `<div class="allocation-producers"><span class="allocation-label">Produced by:</span> `;
        // Find the best (fewest) facility count for this product
        let producingFacilities = [];
        if (product && product.producedIn) {
            if (product.producedIn.length > 1) {
                const alternatives = product.producedIn.map(facility => {
                    const cycles = result.timeAvailable / facility.takesTime;
                    const amountPerCycle = facility.amountProduced || 1;
                    const unitsPerFacility = cycles * amountPerCycle;
                    const facilitiesNeeded = unitsPerFacility > 0 ? Math.ceil(alloc.totalQuantity / unitsPerFacility) : 0;
                    return {
                        id: facility.id,
                        name: getFacilityName(facility.id),
                        count: facilitiesNeeded
                    };
                });
                const best = alternatives.reduce((prev, curr) => curr.count < prev.count ? curr : prev);
                producingFacilities = [best];
            } else {
                product.producedIn.forEach(facility => {
                    const cycles = result.timeAvailable / facility.takesTime;
                    const amountPerCycle = facility.amountProduced || 1;
                    const unitsPerFacility = cycles * amountPerCycle;
                    const facilitiesNeeded = unitsPerFacility > 0 ? Math.ceil(alloc.totalQuantity / unitsPerFacility) : 0;
                    producingFacilities.push({
                        id: facility.id,
                        name: getFacilityName(facility.id),
                        count: facilitiesNeeded
                    });
                });
            }
        }
        allocationsHTML += producingFacilities.map(fac => `<span class="facility-badge">${fac.name} ×${fac.count}</span>`).join('') || '<span class="facility-badge">No facilities found</span>';
        allocationsHTML += `</div>`;
        // Show distribution to consumers
        allocationsHTML += `<div class="allocation-distribution"><span class="allocation-label">Distributed to:</span><div class="consumer-breakdown">`;
        Object.entries(alloc.consumers).forEach(([consumer, consumerData]) => {
            const pct = ((consumerData.amount / alloc.totalQuantity) * 100).toFixed(1);
            allocationsHTML += `<div class="consumer-item">`;
            allocationsHTML += `<div class="consumer-info">`;
            allocationsHTML += `<a class="material-link consumer-name" onclick="scrollToCard('${consumer.replace(/'/g, "\\'")}'); return false;" href="#${consumer.replace(/[^a-zA-Z0-9]/g, '_')}">${consumer}</a>`;
            allocationsHTML += `<span class="consumer-amount">${consumerData.amount.toFixed(1)} units (${pct}%)</span>`;
            // Always use the facility count from producedByMap for the consumer product
            let consumerFacilityBadges = '';
            if (producedByMap[consumer] && producedByMap[consumer].length > 0) {
                producedByMap[consumer].forEach(facility => {
                    consumerFacilityBadges += `<span class="consumer-facility-badge">${facility.name} (×${facility.count})</span>`;
                });
            }
            allocationsHTML += consumerFacilityBadges;
            allocationsHTML += `</div>`;
            allocationsHTML += `</div>`;
        });
        allocationsHTML += `</div></div>`;
        // Initialize checklistState for each card
        let checklistState = {fac: false, sto: false, inb: false, out: false};
        try {
            const saved = localStorage.getItem(`starrupture_card_checkboxes_${productName}`);
            if (saved) checklistState = JSON.parse(saved);
        } catch {}
        allocationsHTML += `<ul class="card-progress" data-product="${productName}">
            <span class="progress-title">Progress Checklist</span>
            <div class="checkbox-group">
                <div class="checkbox-item">
                    <input type="checkbox" class="card-checkbox" data-type="fac" id="fac-${productName}" ${checklistState && checklistState.fac ? 'checked' : ''}/>
                    <label for="fac-${productName}">build facilities</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" class="card-checkbox" data-type="sto" id="sto-${productName}" ${checklistState && checklistState.sto ? 'checked' : ''}/>
                    <label for="sto-${productName}">build storage</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" class="card-checkbox" data-type="inb" id="inb-${productName}" ${checklistState && checklistState.inb ? 'checked' : ''}/>
                    <label for="inb-${productName}">build inbound transportation</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" class="card-checkbox" data-type="out" id="out-${productName}" ${checklistState && checklistState.out ? 'checked' : ''}/>
                    <label for="out-${productName}">build outbound transportation</label>
                </div>
            </div>
        </ul>`;
        allocationsHTML += `</div>`;
    });

    allocationsHTML += '</div>';
    if (allocationsDiv) allocationsDiv.innerHTML = allocationsHTML;

    // Checklist logic: fade card when all checkboxes are checked
    document.querySelectorAll('.allocation-card').forEach(card => {
        const checkboxes = card.querySelectorAll('.card-checkbox');
        function updateCardVisual() {
            if (checkboxes.length === 0) return;
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            if (allChecked) {
                card.classList.add('allocation-card-complete');
            } else {
                card.classList.remove('allocation-card-complete');
            }
        }
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                updateCardVisual();
            });
        });
        updateCardVisual();
    });

    // Add CSS for completed effect if not present
    if (!document.getElementById('allocation-checklist-style')) {
        const style = document.createElement('style');
        style.id = 'allocation-checklist-style';
        style.textContent = `
        .allocation-card-complete {
            opacity: 0.45 !important;
            filter: grayscale(0.85) !important;
            transition: opacity 0.2s, filter 0.2s;
        }
        `;
        document.head.appendChild(style);
    }

    // Facility cost summary (modern compact style)
    if (costDiv) {
        costDiv.innerHTML = `<h3>Facility Construction Cost</h3>
            <div class="cost-summary-compact">
                <div class="cost-item-simple"><span class="cost-item-label">Basic Building Material</span><span class="cost-item-value">${facilityCost.basicBuildingMaterial}</span></div>
                <div class="cost-item-simple"><span class="cost-item-label">Intermediate Building Material</span><span class="cost-item-value">${facilityCost.intermediateBuildingMaterial}</span></div>
                <div class="cost-item-simple"><span class="cost-item-label">Total</span><span class="cost-item-value">${facilityCost.total}</span></div>
            </div>`;
    }

    // Show results section
    resultsSection.style.display = 'block';
}
