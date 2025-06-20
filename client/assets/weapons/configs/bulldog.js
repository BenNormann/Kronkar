// Bulldog Weapon Configuration
const BulldogConfig = {
    // Basic Info
    name: "Bulldog",
    type: "assault_rifle",
    description: "Fully automatic assault rifle with balanced stats",
    
    // Visual Properties
    model: {
        folder: "assets/weapons/bulldog/",
        file: "scene.gltf",
        scale: { x: 0.3, y: 0.3, z: 0.3 },
        position: { x: 0.2, y: -0.3, z: 1.0 }, // Moved left by 0.3 total (0.1 more)
        rotation: { x: 0, y: 0, z: 0 }
    },
    
    // Firing Properties
    fireRate: 600, // Rounds per minute (decreased from previous)
    fireMode: "automatic", // automatic, semi, burst
    damage: 34,
    
    // Ballistics
    projectile: {
        velocity: 2500, // units/second (increased from 150)
        gravity: -10,
        diameter: 0.5, // Much larger bullets for visibility and collision
        lifetime: 5.0, // seconds
        color: { r: 1, g: 1, b: 0 } // Yellow bullets
    },
    
    // Accuracy and Movement Error Configuration
    accuracy: {
        baseSpread: 0.005, // Base spread when stationary (radians)
        movementMultiplier: 0.008, // How much movement affects accuracy (higher = more inaccurate when moving)
        maxMovementPenalty: 0.05, // Maximum additional spread from movement (radians)
        sprintPenalty: 1.5, // Additional penalty multiplier when sprinting
        movementThreshold: 10 // Movement speed threshold before penalty kicks in
    },
    
    // Barrel Configuration
    barrel: {
        offset: { x: 0.0, y: 0.0, z: 0.8 }, // Centered barrel position for accurate shooting
        rayOffset: 1.0 // Distance to move ray origin forward (much further to clear weapon geometry)
    },
    
    // Recoil Properties
    recoil: {
        intensity: { x: 0.03, y: 0.015, z: 0.03 },
        duration: 6, // frames (much shorter - 0.1 seconds at 60fps)
        recovery: 0.8 // How much recoil to apply (0-1)
    },
    
    // Animation Timings
    animations: {
        recoilFrames: 15,
        muzzleFlashDuration: 0.1
    },
    
    // Audio Configuration
    audio: {
        fireSound: "assets/sounds/Bulldog.m4a",
        reloadSound: "assets/sounds/Reload.m4a",
        volume: 0.8
    }
};

// Export for use in game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BulldogConfig;
} else {
    window.BulldogConfig = BulldogConfig;
} 