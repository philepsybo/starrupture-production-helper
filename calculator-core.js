// calculator-core.js
// Core calculation logic for requirements, allocations, and facility counts
import { productsData } from './data.js';
import { getFacilityName } from './utils.js';

export function calculateRequirements(productId, quantity, timeAvailable, visited = new Set()) {
    const product = productsData.find(p => p.id === productId);
    if (!product) {
        throw new Error(`Product ${productId} not found`);
    }
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
    product.producedIn?.forEach(facility => {
        const cycles = timeAvailable / facility.takesTime;
        const amountPerCycle = facility.amountProduced || 1;
        const unitsPerFacility = cycles * amountPerCycle;
        if (unitsPerFacility <= 0) {
            isFeasible = false;
        }
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
    let chosenFacility = null;
    if (product.producedIn && product.producedIn.length > 1 && facilitiesNeeded.length > 0) {
        const best = facilitiesNeeded.reduce((prev, curr) => curr.facilitiesNeeded < prev.facilitiesNeeded ? curr : prev);
        chosenFacility = product.producedIn.find(f => f.id === best.id);
    } else if (product.producedIn && product.producedIn.length === 1) {
        chosenFacility = product.producedIn[0];
    }
    if (chosenFacility && chosenFacility.requires) {
        chosenFacility.requires.forEach(req => {
            const amountPerCycle = chosenFacility.amountProduced || 1;
            const recipesNeeded = Math.ceil(quantity / amountPerCycle);
            const totalNeeded = req.quantity * recipesNeeded;
            if (!dependenciesMap[req.productId]) {
                dependenciesMap[req.productId] = {
                    quantity: 0,
                    facilities: []
                };
            }
            dependenciesMap[req.productId].quantity = totalNeeded;
        });
    }
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
// Additional allocation and facility calculation functions can be added here
