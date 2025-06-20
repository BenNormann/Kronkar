// Rupol Character Configuration
const RupolCharacterConfig = {
    // Basic Info
    name: "Rupol",
    type: "police",
    description: "Police combat character",
    
    // Visual Properties
    model: {
        folder: "assets/characters/rupol/",
        file: "scene.gltf",
        scale: { x: 0.25, y: 0.25, z: 0.25 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
    },
    
    // Character Properties
    height: 2.0, // Character height for scaling and positioning
    radius: 0.5, // Character radius for collision
    
    // Animation Properties (for future use)
    animations: {
        idle: "idle",
        walk: "walk",
        run: "run",
        shoot: "shoot"
    },
    
    // Visual Properties
    nameTagOffset: { x: 0, y: 2.5, z: 0 } // Position of name tag above character
};

// Export for use in game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RupolCharacterConfig;
} else {
    window.RupolCharacterConfig = RupolCharacterConfig;
} 