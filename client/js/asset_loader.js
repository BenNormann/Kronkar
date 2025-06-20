class AssetLoader {
    constructor(scene) {
        this.scene = scene;
        this.loadedAssets = new Map();
    }

    // Load a glTF/glb model
    async loadModel(name, folder, filename) {
        try {
            console.log(`Loading model ${name} from ${folder}${filename}`);
            
            // Check what's available
            console.log('BABYLON.SceneLoader available:', typeof BABYLON.SceneLoader !== 'undefined');
            console.log('BABYLON.SceneLoader.ImportMeshAsync available:', typeof BABYLON.SceneLoader?.ImportMeshAsync !== 'undefined');
            console.log('BABYLON.SceneLoader.ImportMesh available:', typeof BABYLON.SceneLoader?.ImportMesh !== 'undefined');
            
            // Try the modern async API first
            if (BABYLON.SceneLoader && typeof BABYLON.SceneLoader.ImportMeshAsync === 'function') {
                console.log('Using ImportMeshAsync...');
                const result = await BABYLON.SceneLoader.ImportMeshAsync("", folder, filename, this.scene);
                
                console.log(`Loaded model: ${name}`, result);
                this.loadedAssets.set(name, {
                    meshes: result.meshes,
                    particleSystems: result.particleSystems,
                    skeletons: result.skeletons
                });
                
                return {
                    meshes: result.meshes,
                    particleSystems: result.particleSystems,
                    skeletons: result.skeletons
                };
            }
            // Fallback to callback-based API
            else if (BABYLON.SceneLoader && typeof BABYLON.SceneLoader.ImportMesh === 'function') {
                console.log('Using ImportMesh callback...');
                return new Promise((resolve, reject) => {
                    BABYLON.SceneLoader.ImportMesh("", folder, filename, this.scene, 
                        (meshes, particleSystems, skeletons) => {
                            console.log(`Loaded model: ${name}`);
                            this.loadedAssets.set(name, {
                                meshes: meshes,
                                particleSystems: particleSystems,
                                skeletons: skeletons
                            });
                            resolve({ meshes, particleSystems, skeletons });
                        },
                        (progress) => {
                            console.log(`Loading ${name}: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
                        },
                        (error) => {
                            console.error(`Failed to load ${name}:`, error);
                            reject(error);
                        }
                    );
                });
            } else {
                throw new Error('BABYLON.SceneLoader is not available. Make sure Babylon.js loaders are properly loaded.');
            }
        } catch (error) {
            console.error(`Failed to load model ${name}:`, error);
            throw error;
        }
    }

    // Load multiple assets
    async loadAssets(assetList) {
        const promises = assetList.map(asset => 
            this.loadModel(asset.name, asset.folder, asset.filename)
        );
        
        try {
            const results = await Promise.all(promises);
            console.log('All assets loaded successfully');
            return results;
        } catch (error) {
            console.error('Failed to load some assets:', error);
            throw error;
        }
    }

    // Get a loaded asset
    getAsset(name) {
        return this.loadedAssets.get(name);
    }

    // Clone a loaded model for reuse
    cloneModel(name, newName) {
        const asset = this.getAsset(name);
        if (!asset) {
            console.error(`Asset ${name} not found`);
            return null;
        }

        const clonedMeshes = asset.meshes.map(mesh => mesh.clone(newName + '_' + mesh.name));
        return clonedMeshes;
    }

    // Example usage for FPS weapons
    async loadWeapons() {
        const weapons = [
            { name: 'ak47', folder: 'assets/weapons/', filename: 'ak47.glb' },
            { name: 'pistol', folder: 'assets/weapons/', filename: 'pistol.gltf' },
            { name: 'sniper', folder: 'assets/weapons/', filename: 'sniper.glb' }
        ];

        try {
            await this.loadAssets(weapons);
            console.log('All weapons loaded');
        } catch (error) {
            console.error('Failed to load weapons:', error);
        }
    }

    // Example usage for map props
    async loadMapProps() {
        const props = [
            { name: 'crate', folder: 'assets/props/', filename: 'crate.glb' },
            { name: 'barrel', folder: 'assets/props/', filename: 'barrel.glb' },
            { name: 'wall_section', folder: 'assets/props/', filename: 'wall.gltf' }
        ];

        try {
            await this.loadAssets(props);
            console.log('All map props loaded');
        } catch (error) {
            console.error('Failed to load map props:', error);
        }
    }
}

// Usage example:
// const assetLoader = new AssetLoader(scene);
// await assetLoader.loadWeapons();
// const ak47Meshes = assetLoader.cloneModel('ak47', 'player_weapon'); 