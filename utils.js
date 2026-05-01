// utils.js
// Shared utility functions
import { facilitiesData } from './data.js';

export function getFacilityName(facilityId) {
    const facility = facilitiesData.find(f => f.id === facilityId);
    return facility ? facility.name : facilityId;
}
