// L118A1 Sniper Rifle Configuration - Reimplemented from scratch
const L118A1Config = {
    // Basic Info
    name: "L118A1 Sniper",
    type: "sniper_rifle",
    description: "High-precision long-range sniper rifle with devastating one-shot capability",
    
    // Visual Properties - Complete rewrite for proper orientation
    model: {
        folder: "assets/weapons/L118A1 Sniper/",
        file: "scene.gltf",
        scale: { x: 0.8, y: 0.8, z: 0.8 }, // Larger scale for better visibility
        position: { x: 0.6, y: -0.2, z: 0.5 }, // Positioned right and slightly below camera center
        rotation: { x: 0, y: -1.5708, z: 0 } // 90 degrees counter-clockwise on Y-axis to face forward
    },
    
    // Firing Properties - Sniper characteristics
    fireRate: 45, // Very slow - about 1 shot every 1.3 seconds
    fireMode: "semi", // Semi-automatic only
    damage: 120, // High damage - one-shot kill potential
    
    // Ballistics - Long range precision
    projectile: {
        velocity: 4000, // Very high velocity for flat trajectory
        gravity: -3, // Minimal gravity drop for long-range accuracy
        diameter: 0.25, // Small, precise bullet
        lifetime: 10.0, // Very long range
        color: { r: 1, g: 0.9, b: 0.2 } // Bright golden tracer
    },
    
    // Barrel Configuration - Long barrel for accuracy
    barrel: {
        offset: { x: 0.0, y: 0.0, z: 1.0 }, // Reasonable barrel position for accurate shooting
        rayOffset: 1.2 // Reasonable forward offset to clear weapon geometry
    },
    
    // Recoil Properties - Strong but manageable
    recoil: {
        intensity: { x: 0.25, y: 0.03, z: 0.08 }, // Strong upward kick with slight side movement
        duration: 35, // Longer recoil animation
        recovery: 0.95 // Strong recovery for follow-up shots
    },
    
    // Animation Timings
    animations: {
        recoilFrames: 40, // Extended recoil animation
        muzzleFlashDuration: 0.2 // Longer, more dramatic muzzle flash
    },
    
    // Audio Configuration
    audio: {
        fireSound: "assets/sounds/Sniper.m4a",
        reloadSound: "assets/sounds/Reload.m4a",
        volume: 1.2 // Louder than other weapons
    }
};

// Export for use in game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = L118A1Config;
} else {
    window.L118A1Config = L118A1Config;
} 