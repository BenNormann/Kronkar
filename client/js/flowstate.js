class FlowstateManager {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.camera = game.camera;
        
        // Flowstate state
        this.isActive = false;
        this.killStreak = 0;
        this.maxKillStreak = 10;
        
        // Visual effects
        this.overlayElement = document.getElementById('flowstateOverlay');
        this.currentIntensity = 0;
        this.targetIntensity = 0;
        
        // Babylon.js scene effects as backup
        this.sceneOverlayPlane = null;
        this.sceneOverlayMaterial = null;
        
        // Audio
        this.backgroundMusic = null;
        this.currentVolume = 0;
        this.baseVolume = 0.3; // Base volume level for music
        
        // Player highlighting materials
        this.originalMaterials = new Map();
        this.highlightMaterials = new Map();
        
        // Animation state
        this.lastUpdateTime = 0;
        this.transitionSpeed = 2.0; // Speed of visual transitions
        
        console.log('FlowstateManager initialized');
    }
    
    // Called when player gets a kill
    onKill() {
        this.killStreak++;
        console.log('Flowstate: Kill streak now', this.killStreak);
        
        if (this.killStreak === 1) {
            // First kill - start Flowstate
            this.startFlowstate();
        } else if (this.killStreak === this.maxKillStreak) {
            // Max kill streak reached
            this.game.uiManager?.showFlowstateMessage('FLOWSTATE', 500);
        }
        
        // Update intensity and music volume
        this.updateFlowstateIntensity();
    }
    
    // Called when player dies
    onDeath() {
        console.log('Flowstate: Player died, resetting');
        this.stopFlowstate();
        this.killStreak = 0;
        this.currentIntensity = 0;
        this.targetIntensity = 0;
        this.currentVolume = 0;
    }
    
    // Called when a specific remote player dies during flowstate
    onRemotePlayerDeath(playerId) {
        if (!this.isActive || !this.game.remotePlayers) return;
        
        const remotePlayer = this.game.remotePlayers.get(playerId);
        if (!remotePlayer) return;
        
        console.log(`Flowstate: Immediately restoring materials for dying player ${playerId}`);
        
        // Immediately restore materials for this specific player to prevent white appearance
        try {
            // Restore main mesh
            if (remotePlayer.mesh) {
                const originalMaterial = this.originalMaterials.get(remotePlayer.mesh.uniqueId);
                if (originalMaterial) {
                    remotePlayer.mesh.material = originalMaterial;
                    this.originalMaterials.delete(remotePlayer.mesh.uniqueId);
                }
                // Remove outline
                if (remotePlayer.mesh.renderOutline !== undefined) {
                    remotePlayer.mesh.renderOutline = false;
                }
            }
            
            // Restore character meshes
            if (remotePlayer.characterMeshes && remotePlayer.characterMeshes.length > 0) {
                remotePlayer.characterMeshes.forEach(mesh => {
                    if (mesh) {
                        const originalMaterial = this.originalMaterials.get(mesh.uniqueId);
                        if (originalMaterial) {
                            mesh.material = originalMaterial;
                            this.originalMaterials.delete(mesh.uniqueId);
                        }
                        // Remove outline
                        if (mesh.renderOutline !== undefined) {
                            mesh.renderOutline = false;
                        }
                    }
                });
            }
            
            // Restore character container meshes
            if (remotePlayer.characterContainer) {
                const childMeshes = remotePlayer.characterContainer.getChildMeshes();
                childMeshes.forEach(mesh => {
                    if (mesh) {
                        const originalMaterial = this.originalMaterials.get(mesh.uniqueId);
                        if (originalMaterial) {
                            mesh.material = originalMaterial;
                            this.originalMaterials.delete(mesh.uniqueId);
                        }
                        // Remove outline
                        if (mesh.renderOutline !== undefined) {
                            mesh.renderOutline = false;
                        }
                    }
                });
            }
        } catch (error) {
            console.warn(`Flowstate: Error restoring materials for dying player ${playerId}:`, error);
        }
    }
    
    startFlowstate() {
        console.log('Flowstate: Starting Flowstate mode');
        this.isActive = true;
        
        // Show "Starting Flowstate" message
        this.game.uiManager?.showFlowstateMessage('Starting Flowstate', 500);
        
        // Start background music
        this.startBackgroundMusic();
        
        // Initialize visual effects
        this.initializeVisualEffects();
    }
    
    stopFlowstate() {
        console.log('Flowstate: Stopping Flowstate mode');
        this.isActive = false;
        
        // Stop background music
        this.stopBackgroundMusic();
        
        // Reset visual effects
        this.resetVisualEffects();
        
        // Reset player highlighting
        this.resetPlayerHighlighting();
    }
    
    updateFlowstateIntensity() {
        if (!this.isActive) return;
        
        // Calculate intensity based on kill streak (10% per kill, max 100%)
        const intensityPercent = Math.min(this.killStreak / this.maxKillStreak, 1.0);
        this.targetIntensity = intensityPercent;
        
        // Calculate music volume (10% per kill, max baseVolume)
        const volumePercent = Math.min(this.killStreak / this.maxKillStreak, 1.0);
        const targetVolume = this.baseVolume * volumePercent;
        
        console.log(`Flowstate: Kill ${this.killStreak} - Intensity: ${intensityPercent * 100}%, Volume: ${volumePercent * 100}%, Red Glow: ${(intensityPercent * intensityPercent * 100)}%`);
        
        // Update music volume
        this.updateMusicVolume(targetVolume);
        
        // Update player highlighting intensity
        this.updatePlayerHighlighting();
    }
    
    async startBackgroundMusic() {
        if (!this.game.uiManager || !this.game.audioManager) return;
        
        const selectedMusic = this.game.uiManager.getSelectedMusic();
        const musicPath = `assets/sounds/songs/${selectedMusic}`;
        
        console.log('Flowstate: Starting background music:', musicPath);
        
        try {
            // Stop any existing music
            this.stopBackgroundMusic();
            
            // Start new music at low volume, looping
            this.backgroundMusic = await this.game.audioManager.playSound(musicPath, 0.01, true);
            if (this.backgroundMusic) {
                console.log('Flowstate: Background music started successfully');
                // Set initial volume based on current kill streak
                this.updateMusicVolume(this.baseVolume * Math.min(this.killStreak / this.maxKillStreak, 1.0));
            } else {
                console.warn('Flowstate: Failed to start background music');
            }
        } catch (error) {
            console.error('Flowstate: Error starting background music:', error);
        }
    }
    
    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            console.log('Flowstate: Stopping background music');
            if (this.backgroundMusic.pause) {
                this.backgroundMusic.pause();
            }
            if (this.backgroundMusic.remove) {
                this.backgroundMusic.remove();
            }
            this.backgroundMusic = null;
        }
    }
    
    updateMusicVolume(targetVolume) {
        if (!this.backgroundMusic) return;
        
        // Smooth volume transition
        const volumeDifference = targetVolume - this.currentVolume;
        if (Math.abs(volumeDifference) > 0.01) {
            this.currentVolume += volumeDifference * 0.1; // Smooth transition
            this.backgroundMusic.volume = Math.max(0, Math.min(1, this.currentVolume));
        }
    }
    
    initializeVisualEffects() {
        console.log('Flowstate: Initializing visual effects');
        
        console.log('Flowstate: Skipping global overlay - using selective darkening instead');
        
        // Store original materials for environment darkening
        this.originalEnvironmentMaterials = new Map();
        
        // Dim the scene lighting and darken environment only
        this.dimSceneLighting();
        this.darkenEnvironmentMaterials();
    }
    
    createSceneOverlay() {
        if (!this.scene || this.sceneOverlayPlane) return;
        
        try {
            // Create fullscreen overlay plane
            this.sceneOverlayPlane = BABYLON.MeshBuilder.CreatePlane('flowstateOverlay', {
                size: 20 // Smaller, closer to camera
            }, this.scene);
            
            // Position it very close to camera
            this.sceneOverlayPlane.position = new BABYLON.Vector3(0, 0, 5);
            this.sceneOverlayPlane.renderingGroupId = 3; // Render on top
            this.sceneOverlayPlane.isPickable = false;
            
            // Create semi-transparent material
            this.sceneOverlayMaterial = new BABYLON.StandardMaterial('flowstateOverlayMat', this.scene);
            this.sceneOverlayMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
            this.sceneOverlayMaterial.alpha = 0;
            this.sceneOverlayMaterial.disableLighting = true;
            
            this.sceneOverlayPlane.material = this.sceneOverlayMaterial;
            this.sceneOverlayPlane.parent = this.camera; // Follow camera
            
            console.log('Flowstate: Babylon.js scene overlay created');
        } catch (error) {
            console.error('Flowstate: Error creating scene overlay:', error);
        }
    }
    
    dimSceneLighting() {
        if (!this.scene) return;
        
        // Store original lighting values
        this.originalLightIntensities = new Map();
        
        // Dim all lights in the scene
        this.scene.lights.forEach(light => {
            this.originalLightIntensities.set(light.uniqueId, light.intensity);
        });
        
        console.log('Flowstate: Scene lighting dimmed');
    }
    
    darkenEnvironmentMaterials() {
        if (!this.scene) return;
        
        console.log('Flowstate: Darkening environment materials');
        
        // Get all meshes in the scene except players
        this.scene.meshes.forEach(mesh => {
            // Skip player meshes, weapon meshes, hit effects, etc.
            if (mesh.metadata && (
                mesh.metadata.isPlayerMesh || 
                mesh.metadata.isWeapon || 
                mesh.metadata.isHitEffect ||
                mesh.metadata.isBullet
            )) {
                return;
            }
            
            // Skip name tag meshes - they should stay bright and visible
            if (mesh.name && mesh.name.includes('nameTag')) {
                return;
            }
            
            // Skip meshes that are part of character models
            if (mesh.name && (
                mesh.name.includes('character_') ||
                mesh.name.includes('Object_') ||
                mesh.name.includes('Cylinder.')
            )) {
                return;
            }
            
            // Store original material and darken it
            if (mesh.material && !this.originalEnvironmentMaterials.has(mesh.uniqueId)) {
                this.originalEnvironmentMaterials.set(mesh.uniqueId, mesh.material);
                
                // Create darkened version of the material
                const darkenedMaterial = mesh.material.clone(`darkened_${mesh.material.name}`);
                
                // Darken the material colors
                if (darkenedMaterial.diffuseColor) {
                    darkenedMaterial.diffuseColor = darkenedMaterial.diffuseColor.scale(0.3); // Much darker
                }
                if (darkenedMaterial.emissiveColor) {
                    darkenedMaterial.emissiveColor = darkenedMaterial.emissiveColor.scale(0.2); // Very dim
                }
                
                mesh.material = darkenedMaterial;
            }
        });
        
        console.log(`Flowstate: Darkened ${this.originalEnvironmentMaterials.size} environment materials`);
    }

    resetVisualEffects() {
        console.log('Flowstate: Resetting visual effects');
        
        // Reset scene lighting
        if (this.originalLightIntensities && this.scene) {
            this.scene.lights.forEach(light => {
                const originalIntensity = this.originalLightIntensities.get(light.uniqueId);
                if (originalIntensity !== undefined) {
                    light.intensity = originalIntensity;
                }
            });
        }
        
        // Restore environment materials
        if (this.originalEnvironmentMaterials && this.scene) {
            this.scene.meshes.forEach(mesh => {
                const originalMaterial = this.originalEnvironmentMaterials.get(mesh.uniqueId);
                if (originalMaterial) {
                    mesh.material = originalMaterial;
                }
            });
            this.originalEnvironmentMaterials.clear();
        }
        
        console.log('Flowstate: Environment materials restored');
    }
    
    updatePlayerHighlighting() {
        if (!this.isActive || !this.game.remotePlayers) {
            return;
        }
        
        // Highlight all remote players with red effect
        this.game.remotePlayers.forEach((remotePlayer, playerId) => {
            if (remotePlayer.alive) {
                // Ensure name tag stays visible and unaffected
                if (remotePlayer.nameTag) {
                    remotePlayer.nameTag.setEnabled(true);
                    // Preserve name tag material from any changes
                    if (remotePlayer.nameTag.material && !this.originalMaterials.has(remotePlayer.nameTag.uniqueId)) {
                        this.originalMaterials.set(remotePlayer.nameTag.uniqueId, remotePlayer.nameTag.material);
                    }
                }
                
                // Apply to main mesh
                if (remotePlayer.mesh) {
                    this.applyPlayerHighlight(remotePlayer.mesh, this.targetIntensity);
                }
                
                // Apply to character meshes if they exist
                if (remotePlayer.characterMeshes && remotePlayer.characterMeshes.length > 0) {
                    remotePlayer.characterMeshes.forEach(mesh => {
                        if (mesh) {
                            this.applyPlayerHighlight(mesh, this.targetIntensity);
                        }
                    });
                }
                
                // Apply to character container if it exists
                if (remotePlayer.characterContainer) {
                    const childMeshes = remotePlayer.characterContainer.getChildMeshes();
                    childMeshes.forEach(mesh => {
                        // Skip name tag meshes
                        if (mesh && mesh.material && (!mesh.name || !mesh.name.includes('nameTag'))) {
                            this.applyPlayerHighlight(mesh, this.targetIntensity);
                        }
                    });
                }
            }
        });
    }
    
    applyPlayerHighlight(mesh, intensity) {
        if (!mesh || !this.scene) return;
        
        // Skip name tag meshes - they should remain unaffected
        if (mesh.name && mesh.name.includes('nameTag')) {
            return;
        }
        
        try {
            // Create or get highlight material
            let highlightMaterial = this.highlightMaterials.get(mesh.uniqueId);
            if (!highlightMaterial) {
                // Store original material with safety checks
                if (mesh.material && !this.originalMaterials.has(mesh.uniqueId)) {
                    // Only store materials that seem valid (not disposed or corrupted)
                    if (mesh.material.name && !mesh.material.name.includes('flowstate_highlight')) {
                        this.originalMaterials.set(mesh.uniqueId, mesh.material);
                        console.log(`Flowstate: Stored original material for mesh ${mesh.name || mesh.uniqueId}`);
                    } else {
                        console.warn(`Flowstate: Skipping invalid material storage for mesh ${mesh.name || mesh.uniqueId}`);
                    }
                }
                
                // Create bright red highlight material
                highlightMaterial = new BABYLON.StandardMaterial(`flowstate_highlight_${mesh.uniqueId}`, this.scene);
                
                // Enable lighting but make emissive VERY bright
                highlightMaterial.disableLighting = false;
                highlightMaterial.useEmissiveAsIllumination = true;
                
                this.highlightMaterials.set(mesh.uniqueId, highlightMaterial);
            }
            
            // Calculate red glow scaling - brighter initial red
            const glowIntensity = intensity * intensity; // Quadratic scaling like original
            const brightRed = Math.min(1.0, 0.4 + (glowIntensity * 0.6));
            
            // Update material with stable red glow (brighter initial)
            if (highlightMaterial) {
                // Brighter initial red scaling
                highlightMaterial.emissiveColor = new BABYLON.Color3(brightRed * 0.6, 0.05 * (1 - intensity), 0.05 * (1 - intensity));
                highlightMaterial.diffuseColor = new BABYLON.Color3(brightRed, 0.15 * (1 - intensity * 0.9), 0.15 * (1 - intensity * 0.9));
                
                // Conservative specular
                highlightMaterial.specularColor = new BABYLON.Color3(brightRed * 0.6, 0.05, 0.05);
                highlightMaterial.specularPower = 32;
                
                // At medium intensity, boost the red
                if (intensity >= 0.5) {
                    highlightMaterial.emissiveColor = new BABYLON.Color3(brightRed * 0.6, 0.03, 0.03);
                    highlightMaterial.diffuseColor = new BABYLON.Color3(brightRed, 0.1 * (1 - intensity), 0.1 * (1 - intensity));
                }
                
                // At max intensity, bright red but not pure white
                if (intensity >= 0.9) {
                    highlightMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.02, 0.02); // Slightly less than pure to avoid white
                    highlightMaterial.diffuseColor = new BABYLON.Color3(1.0, 0.05, 0.05);
                    highlightMaterial.specularColor = new BABYLON.Color3(0.8, 0.1, 0.1);
                }
            }
            
            // Apply material to the mesh with safety check
            if (mesh.material !== highlightMaterial) {
                mesh.material = highlightMaterial;
            }
            
            // Add outline rendering as backup for extra visibility - start subtle
            if (mesh.renderOutline !== undefined) {
                mesh.renderOutline = intensity > 0.3; // Only show outline after 30% intensity
                mesh.outlineColor = new BABYLON.Color3(1.0, 0, 0);
                mesh.outlineWidth = 0.02 + (0.08 * glowIntensity); // Start thin, build up
            }
            
            // Also apply to child meshes for complete player highlighting
            if (mesh.getChildMeshes) {
                mesh.getChildMeshes().forEach(childMesh => {
                    // Skip name tag meshes in child meshes too
                    if (childMesh && childMesh.material && (!childMesh.name || !childMesh.name.includes('nameTag'))) {
                        // Store original material for child mesh too
                        if (childMesh.material && !this.originalMaterials.has(childMesh.uniqueId)) {
                            if (childMesh.material.name && !childMesh.material.name.includes('flowstate_highlight')) {
                                this.originalMaterials.set(childMesh.uniqueId, childMesh.material);
                            }
                        }
                        
                        childMesh.material = highlightMaterial;
                        
                        // Add outline to child meshes too - start subtle
                        if (childMesh.renderOutline !== undefined) {
                            childMesh.renderOutline = intensity > 0.3; // Only show outline after 30% intensity
                            childMesh.outlineColor = new BABYLON.Color3(1.0, 0, 0);
                            childMesh.outlineWidth = 0.02 + (0.08 * glowIntensity); // Start thin, build up
                        }
                    }
                });
            }
            
        } catch (error) {
            console.warn('Flowstate: Error applying player highlight:', error);
        }
    }
    
    resetPlayerHighlighting() {
        if (!this.game.remotePlayers) return;
        
        console.log('Flowstate: Resetting player highlighting');
        
        // Restore original materials for all player meshes
        this.game.remotePlayers.forEach((remotePlayer, playerId) => {
            // Skip players that are dead or in death animation - they shouldn't be highlighted anyway
            if (!remotePlayer.alive || remotePlayer.deathAnimationPlaying) {
                console.log(`Flowstate: Skipping material restoration for dead player ${playerId}`);
                return;
            }
            
            // Restore main mesh
            if (remotePlayer.mesh) {
                const originalMaterial = this.originalMaterials.get(remotePlayer.mesh.uniqueId);
                if (originalMaterial) {
                    try {
                        remotePlayer.mesh.material = originalMaterial;
                        console.log(`Flowstate: Restored main mesh material for player ${playerId}`);
                    } catch (error) {
                        console.warn(`Flowstate: Failed to restore main mesh material for player ${playerId}:`, error);
                    }
                }
                // Remove outline
                if (remotePlayer.mesh.renderOutline !== undefined) {
                    remotePlayer.mesh.renderOutline = false;
                }
            }
            
            // Restore character meshes
            if (remotePlayer.characterMeshes && remotePlayer.characterMeshes.length > 0) {
                remotePlayer.characterMeshes.forEach((mesh, index) => {
                    if (mesh && mesh.material) {
                        const originalMaterial = this.originalMaterials.get(mesh.uniqueId);
                        if (originalMaterial) {
                            try {
                                mesh.material = originalMaterial;
                                console.log(`Flowstate: Restored character mesh ${index} material for player ${playerId}`);
                            } catch (error) {
                                console.warn(`Flowstate: Failed to restore character mesh ${index} material for player ${playerId}:`, error);
                                // If restoration fails, try to recreate the mesh's original material
                                this.attemptMaterialRecreation(mesh, playerId, index);
                            }
                        } else {
                            console.warn(`Flowstate: No original material found for character mesh ${index} of player ${playerId}`);
                            // Try to recreate based on the mesh name or other properties
                            this.attemptMaterialRecreation(mesh, playerId, index);
                        }
                        
                        // Remove outline
                        if (mesh.renderOutline !== undefined) {
                            mesh.renderOutline = false;
                        }
                    }
                });
            }
            
            // Restore character container meshes
            if (remotePlayer.characterContainer) {
                const childMeshes = remotePlayer.characterContainer.getChildMeshes();
                childMeshes.forEach((mesh, index) => {
                    if (mesh && mesh.material) {
                        const originalMaterial = this.originalMaterials.get(mesh.uniqueId);
                        if (originalMaterial) {
                            try {
                                mesh.material = originalMaterial;
                                console.log(`Flowstate: Restored container mesh ${index} material for player ${playerId}`);
                            } catch (error) {
                                console.warn(`Flowstate: Failed to restore container mesh ${index} material for player ${playerId}:`, error);
                                this.attemptMaterialRecreation(mesh, playerId, index);
                            }
                        } else {
                            console.warn(`Flowstate: No original material found for container mesh ${index} of player ${playerId}`);
                            this.attemptMaterialRecreation(mesh, playerId, index);
                        }
                        
                        // Remove outline
                        if (mesh.renderOutline !== undefined) {
                            mesh.renderOutline = false;
                        }
                    }
                });
            }
        });
        
        // Clean up highlight materials
        this.highlightMaterials.forEach((material, meshId) => {
            if (material && material.dispose) {
                try {
                    material.dispose();
                } catch (error) {
                    console.warn('Flowstate: Error disposing highlight material:', error);
                }
            }
        });
        
        this.highlightMaterials.clear();
        this.originalMaterials.clear();
        
        console.log('Flowstate: Player highlighting reset complete');
    }
    
    // Helper method to attempt material recreation when restoration fails
    attemptMaterialRecreation(mesh, playerId, meshIndex) {
        if (!mesh || !mesh.scene) return;
        
        try {
            console.log(`Flowstate: Attempting to recreate material for mesh ${meshIndex} of player ${playerId}`);
            
            // Create a new standard material with reasonable defaults
            const newMaterial = new BABYLON.StandardMaterial(`recreated_${playerId}_${meshIndex}`, mesh.scene);
            
            // Try to determine if this is a character mesh and apply appropriate colors
            if (mesh.name && (mesh.name.includes('Object_') || mesh.name.includes('Cylinder'))) {
                // This looks like a character mesh, give it character-like colors
                newMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.6); // Skin-like color
                newMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                newMaterial.roughness = 0.8;
            } else {
                // Generic mesh, use a neutral color
                newMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
                newMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            }
            
            // Apply good lighting properties
            newMaterial.backFaceCulling = true;
            newMaterial.twoSidedLighting = false;
            
            mesh.material = newMaterial;
            console.log(`Flowstate: Successfully recreated material for mesh ${meshIndex} of player ${playerId}`);
            
        } catch (error) {
            console.error(`Flowstate: Failed to recreate material for mesh ${meshIndex} of player ${playerId}:`, error);
        }
    }
    
    // Update method called from game loop
    update(deltaTime) {
        if (!this.isActive) {
            return;
        }
        
        // Update visual overlay opacity
        this.updateVisualOverlay(deltaTime);
        
        // Update player highlighting
        this.updatePlayerHighlighting();
        
        // Update music volume smoothly
        if (this.backgroundMusic) {
            const targetVolume = this.baseVolume * Math.min(this.killStreak / this.maxKillStreak, 1.0);
            this.updateMusicVolume(targetVolume);
        }
    }
    
    updateVisualOverlay(deltaTime) {
        if (!this.isActive) return;
        
        // Smooth transition to target intensity
        const intensityDifference = this.targetIntensity - this.currentIntensity;
        if (Math.abs(intensityDifference) > 0.01) {
            this.currentIntensity += intensityDifference * this.transitionSpeed * deltaTime;
            
            // Calculate darkening factor using square root for dramatic early impact
            const sqrtIntensity = Math.sqrt(this.currentIntensity); // Square root scaling
            const darkeningFactor = sqrtIntensity * 0.9; // Max 90% darkening, but front-loaded
            
            // Dim scene lighting progressively
            if (this.originalLightIntensities && this.scene) {
                this.scene.lights.forEach(light => {
                    const originalIntensity = this.originalLightIntensities.get(light.uniqueId);
                    if (originalIntensity !== undefined) {
                        light.intensity = originalIntensity * (1 - darkeningFactor * 0.7); // Dim by up to 70%
                    }
                });
            }
            
            // Update environment material darkness progressively
            if (this.originalEnvironmentMaterials && this.scene) {
                this.scene.meshes.forEach(mesh => {
                    // Skip name tag meshes - they should never be darkened
                    if (mesh.name && mesh.name.includes('nameTag')) {
                        return;
                    }
                    
                    const originalMaterial = this.originalEnvironmentMaterials.get(mesh.uniqueId);
                    if (originalMaterial && mesh.material && mesh.material.name.includes('darkened_')) {
                        // Update darkened material intensity with dramatic early scaling
                        const darkenedMaterial = mesh.material;
                        if (darkenedMaterial.diffuseColor && originalMaterial.diffuseColor) {
                            const darkenAmount = 0.05 + (darkeningFactor * 0.7); // Scale from 5% to 75% darkness (more dramatic)
                            darkenedMaterial.diffuseColor = originalMaterial.diffuseColor.scale(darkenAmount);
                        }
                        if (darkenedMaterial.emissiveColor && originalMaterial.emissiveColor) {
                            const darkenAmount = 0.02 + (darkeningFactor * 0.5); // Scale from 2% to 52% brightness (more dramatic)
                            darkenedMaterial.emissiveColor = originalMaterial.emissiveColor.scale(darkenAmount);
                        }
                    }
                });
            }
            

        }
    }
    
    // DEBUG: Toggle max Flowstate for testing
    debugToggleMaxFlowstate() {
        if (this.isActive && this.killStreak >= this.maxKillStreak) {
            // Turn off debug mode
            console.log('Flowstate DEBUG: Turning off max Flowstate');
            this.stopFlowstate();
            this.killStreak = 0;
            this.currentIntensity = 0;
            this.targetIntensity = 0;
            this.currentVolume = 0;
        } else {
            // Turn on max Flowstate
            console.log('Flowstate DEBUG: Activating max Flowstate (level 10)');
            this.killStreak = this.maxKillStreak;
            this.startFlowstate();
            
            // CRITICAL: Update intensity for debug mode
            this.updateFlowstateIntensity();
            
            this.game.uiManager?.showFlowstateMessage('DEBUG: MAX FLOWSTATE', 1000);
        }
    }

    // Cleanup method
    dispose() {
        console.log('Flowstate: Disposing FlowstateManager');
        this.stopFlowstate();
        
        // Clean up scene overlay
        if (this.sceneOverlayPlane) {
            this.sceneOverlayPlane.dispose();
            this.sceneOverlayPlane = null;
        }
        if (this.sceneOverlayMaterial) {
            this.sceneOverlayMaterial.dispose();
            this.sceneOverlayMaterial = null;
        }
        
        // Clean up materials
        this.highlightMaterials.forEach((material, meshId) => {
            if (material && material.dispose) {
                material.dispose();
            }
        });
        
        this.highlightMaterials.clear();
        this.originalMaterials.clear();
    }
} 