// display-helpers.js
import { productsData, facilitiesData } from './data.js';
import { getFacilityName } from './utils.js';

export function buildProductAllocations(result) {
    const allocations = {};
    const productToFacility = {};
    const productToRequestedQuantity = {};
    const productFacilityMap = {};
    function extractProductFacilities(node) {
        if (node && node.productName && node.facilities && node.facilities.length > 0) {
            const chosenFacility = node.facilities.find(f => f.id === node.chosenFacility?.id) || node.facilities[0];
            productFacilityMap[node.productName] = {
                facilityId: chosenFacility.id,
                count: chosenFacility.facilitiesNeeded
            };
        }
        if (node && node.productName && node.chosenFacility) {
            productToFacility[node.productName] = node.chosenFacility.id;
        }
        if (node && node.productName && node.requestedQuantity) {
            productToRequestedQuantity[node.productName] = node.requestedQuantity;
        }
        if (node && node.dependencies) {
            Object.values(node.dependencies).forEach(dep => {
                if (dep.result) extractProductFacilities(dep.result);
            });
        }
    }
    extractProductFacilities(result);
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
    Object.entries(allocations).forEach(([productName, alloc]) => {
        Object.entries(alloc.consumers).forEach(([consumer, consumerData]) => {
            if (productFacilityMap[consumer]) {
                const facilityInfo = productFacilityMap[consumer];
                if (!consumerData.facilities.find(f => f.id === facilityInfo.facilityId)) {
                    consumerData.facilities.push({
                        id: facilityInfo.facilityId,
                        name: getFacilityName(facilityInfo.facilityId),
                        count: facilityInfo.count
                    });
                }
            }
        });
    });
    return allocations;
}

export function calculateFacilitiesFromAllocations(allocations, timeAvailable, result) {
    const facilities = {};
    if (result && result.facilities && result.facilities.length > 0) {
        let facilitiesToAdd = result.facilities;
        if (result.facilities.length > 1) {
            const best = result.facilities.reduce((prev, curr) => curr.facilitiesNeeded < prev.facilitiesNeeded ? curr : prev);
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
    Object.entries(allocations).forEach(([productName, alloc]) => {
        const product = productsData.find(p => p.name === productName);
        if (!product) return;
        if (product.producedIn && product.producedIn.length > 1) {
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
            const best = alternatives.reduce((prev, curr) => curr.facilitiesNeeded < prev.facilitiesNeeded ? curr : prev);
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

export function calculateFacilityCost(allFacilities) {
    let basicBuildingMaterial = 0;
    let intermediateBuildingMaterial = 0;
    Object.values(allFacilities).forEach(fac => {
        if (fac.isAlternative) {
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
