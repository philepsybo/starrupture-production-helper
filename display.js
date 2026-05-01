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
        allocationsHTML += `<div class="allocation-header"><span class="allocation-product">${productName}</span> <span class="allocation-total">${alloc.totalQuantity.toFixed(1)} units</span></div>`;
        // Show producers with per-product counts
        allocationsHTML += `<div class="allocation-producers"><span class="allocation-label">Produced by:</span> `;
        // Find the best (fewest) facility count for this product
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
        allocationsHTML += producingFacilities.map(fac => `<span class="facility-badge">${fac.name} ×${fac.count}</span>`).join('') || '<span class="facility-badge">No facilities found</span>';
        allocationsHTML += `</div>`;
        // Show distribution to consumers
        allocationsHTML += `<div class="allocation-distribution"><span class="allocation-label">Distributed to:</span><div class="consumer-breakdown">`;
        Object.entries(alloc.consumers).forEach(([consumer, consumerData]) => {
            allocationsHTML += `<div class="consumer-item"><span class="consumer-name">${consumer}</span> <span class="consumer-amount">${consumerData.amount.toFixed(1)} units</span>`;
            if (consumerData.facilities.length > 0) {
                allocationsHTML += consumerData.facilities.map(fac => `<span class="consumer-facility-badge">${fac.name} (×${fac.count})</span>`).join('');
            }
            allocationsHTML += `</div>`;
        });
        allocationsHTML += `</div></div></div>`;
    });
    allocationsHTML += '</div>';
    if (allocationsDiv) allocationsDiv.innerHTML = allocationsHTML;

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
