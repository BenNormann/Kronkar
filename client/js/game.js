class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.player = null;
        this.networkManager = null;
        this.uiManager = null;
        
        this.isPointerLocked = false;
        this.gameStarted = false;
        this.debugMode = true; // Set to true to see spawn point markers and debug info
        
        // Game objects
        this.remotePlayers = new Map();
        this.bullets = [];
        this.map = null;
        
        // Performance
        this.lastUpdateTime = 0;
        this.fps = 60;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        this.displayFps = 60;
        
        // Initialize the game
        this.init();
    }
    
    async init() {
        try {
            // Wait for Babylon.js to be fully loaded
            this.updateLoadingText('Loading Babylon.js...');
            if (typeof window.babylonReady !== 'undefined') {
                await window.babylonReady;
                console.log('Babylon.js ready, proceeding with initialization');
            }
            
            this.updateLoadingText('Creating Babylon.js engine...');
            await this.initBabylon();
            
            this.updateLoadingText('Creating game scene...');
            await this.createScene();
            
            this.updateLoadingText('Loading game systems...');
            this.initGameSystems();
            
            this.updateLoadingText('Connecting to server...');
            await this.initNetwork();
            
            this.updateLoadingText('Starting game...');
            this.startGame();
            
        } catch (error) {
            console.error('Game initialization failed:', error);
            this.updateLoadingText('Failed to start game: ' + error.message);
        }
    }
    
    updateLoadingText(text) {
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }
    
    async initBabylon() {
        // Create Babylon.js engine
        this.engine = new BABYLON.Engine(this.canvas, true, {
            stencil: true,
            antialias: true
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
        
        // Render loop
        this.engine.runRenderLoop(() => {
            if (this.scene) {
                this.update();
                this.scene.render();
            }
        });
    }
    
    async createScene() {
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
        this.scene.collisionsEnabled = true;
        
        // Enhanced lighting for complex maps
        const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.9; // Increased ambient light
        
        const directionalLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -1, -1), this.scene);
        directionalLight.position = new BABYLON.Vector3(20, 40, 20);
        directionalLight.intensity = 0.8; // Increased directional light
        
        // Add fill light for better visibility
        const fillLight = new BABYLON.DirectionalLight('fillLight', new BABYLON.Vector3(1, -0.5, 1), this.scene);
        fillLight.position = new BABYLON.Vector3(-20, 30, -20);
        fillLight.intensity = 0.4;
        
        // Initialize camera FIRST to avoid "No camera defined" error
        this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 2, 0), this.scene);
        this.camera.setTarget(BABYLON.Vector3.Zero());
        
        // Adjust clipping planes for FPS weapons - bring near plane much closer
        this.camera.minZ = 0.001; // Extremely close near clipping plane for weapon visibility
        this.camera.maxZ = 2000; // Increased for large maps
        
        // Set as active camera
        this.scene.activeCamera = this.camera;
        
        // Create default map AFTER camera setup
        await this.createDefaultMap();
        
        // Physics (optional - can be enabled later)
        // this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin());
    }
    
    async createDefaultMap() {
        console.log('Loading dust2 map...');
        
        try {
            // Initialize asset loader
            this.assetLoader = new AssetLoader(this.scene);
            
            // Load dust2 map
            await this.assetLoader.loadModel(
                'dust2', 
                'assets/maps/dust2/', 
                'scene.gltf'
            );
            
            // Get the loaded dust2 assets
            const dust2Assets = this.assetLoader.getAsset('dust2');
            if (dust2Assets && dust2Assets.meshes) {
                console.log(`Successfully loaded dust2 with ${dust2Assets.meshes.length} meshes`);
                
                // Create a parent container node and move EVERYTHING to it
                const mapContainer = new BABYLON.TransformNode("dust2Container", this.scene);
                mapContainer.position = new BABYLON.Vector3(0, -20, 0); // Raised up since we're scaling down
                mapContainer.rotation = new BABYLON.Vector3(-Math.PI, 0, 0); // Rotate -180 degrees around X-axis (opposite direction)
                mapContainer.scaling = new BABYLON.Vector3(0.3, 0.3, 0.3); // Scale down to 30% of original size
                
                // Make sure container doesn't interfere with collisions
                mapContainer.checkCollisions = false;
                mapContainer.isPickable = false;
                
                console.log("Setting up map container at position:", mapContainer.position.toString());
                console.log("Setting up map container rotation:", mapContainer.rotation.toString());
                
                // Parent ALL imported content to this container
                dust2Assets.meshes.forEach((mesh, index) => {
                    if (mesh) {
                        console.log(`Parenting mesh ${index}: ${mesh.name} to container`);
                        mesh.parent = mapContainer;
                        
                        // Configure collision based on mesh type
                        if (mesh.name === '__root__') {
                            // Root mesh should not interfere with physics or bullets
                            mesh.checkCollisions = false;
                            mesh.isPickable = false;
                            mesh.metadata = { type: 'root' };
                        } else {
                            // All other meshes should have proper collision
                            mesh.checkCollisions = true;  // For player physics
                            mesh.isPickable = true;       // For bullet collision
                            
                            // Set specific collision properties for different mesh types
                            if (mesh.name.toLowerCase().includes('ground') || 
                                mesh.name.toLowerCase().includes('floor')) {
                                mesh.metadata = { type: 'ground' };
                            } else if (mesh.name.toLowerCase().includes('wall') ||
                                       mesh.name.toLowerCase().includes('building')) {
                                mesh.metadata = { type: 'wall' };
                            } else {
                                mesh.metadata = { type: 'environment' };
                            }
                        }
                    }
                });
                
                // Also parent any transform nodes
                if (dust2Assets.transformNodes && dust2Assets.transformNodes.length > 0) {
                    dust2Assets.transformNodes.forEach((transformNode, index) => {
                        console.log(`Parenting transform node ${index}: ${transformNode.name} to container`);
                        transformNode.parent = mapContainer;
                    });
                }
                
                console.log("Dust2 map container setup complete - map should be moved down!");
                
                // Add invisible floor below the map for collision
                this.createInvisibleFloor();
                
                // Set up dust2-specific spawn points
                this.setupDust2SpawnPoints();
                
                this.map = 'dust2';
                console.log('dust2 map loaded successfully!');
            } else {
                throw new Error('Failed to get dust2 assets after loading');
            }
            
        } catch (error) {
            console.error('Failed to load dust2 map:', error);
            console.log('Falling back to simple backup map...');
            this.createSimpleBackupMap();
        }
    }
    
    createInvisibleFloor() {
        // Create a massive invisible floor below the dust2 map for collision
        const invisibleFloor = BABYLON.MeshBuilder.CreateGround('invisibleFloor', {
            width: 5000,  // Massive floor to cover entire area
            height: 5000
        }, this.scene);
        
        invisibleFloor.position.y = -100; // Much lower to avoid bullet interference
        invisibleFloor.checkCollisions = true;
        invisibleFloor.isPickable = false; // Don't let bullets hit the invisible floor
        
        // Make it invisible but still have collision for player
        invisibleFloor.visibility = 0; // Completely invisible
        
        // Add metadata to identify it as safety floor
        invisibleFloor.metadata = { type: 'invisibleFloor', isSafetyFloor: true };
        
        console.log('Created massive invisible safety floor for dust2 at Y=-100');
    }

    setupDust2SpawnPoints() {
        // dust2 spawn points based on actual map coordinates from bullet hits
        // All at Y=-40 to spawn above the map surface, one per distinct area
        this.spawnPoints = [
            // Area 1: Around coordinates (421, -47, -599)
            new BABYLON.Vector3(421, 40, -599),
            
            // Area 2: Around coordinates (442, -47, -630)
            new BABYLON.Vector3(442, 40, -630),
            
            // Area 3: Around coordinates (371, -47, -836)
            new BABYLON.Vector3(371, 40, -836),
            
            // Area 4: Around coordinates (198, -47, -323)
            new BABYLON.Vector3(198, 40, -323),
            
            // Area 6: Around coordinates (-529, -47, -40)
            new BABYLON.Vector3(-529, 40, -40),
            
            // Area 7: Around coordinates (-582, -47, -569)
            new BABYLON.Vector3(-582, 40, -569),
            
            // Area 8: Around coordinates (-597, -46, -409)
            new BABYLON.Vector3(-597, 37, -409),
            
            // Area 9: Around coordinates (-92, -48, -628)
            new BABYLON.Vector3(-92, 40, -628),
            
            // Area 11: Elevated position around (405, 20, -881)
            new BABYLON.Vector3(405, 40, -881)
        ];
        
        console.log(`Set up ${this.spawnPoints.length} spawn points for dust2 using real map coordinates`);
        
        // Optional: Add debug markers for spawn points if debug mode is enabled
        if (this.debugMode) {
            this.spawnPoints.forEach((spawnPoint, index) => {
                this.addDebugMarker(
                    spawnPoint, 
                    `spawn_${index}`, 
                    new BABYLON.Color3(0, 1, 0)
                );
            });
        }
    }
    
    createSimpleBackupMap() {
        console.log('Creating backup simple map...');
        
        // Create a simple test map as fallback
        const ground = BABYLON.MeshBuilder.CreateGround('ground', {
            width: 100,
            height: 100
        }, this.scene);
        
        ground.checkCollisions = true;
        
        // Ground material
        const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.2);
        groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        ground.material = groundMaterial;
        
        // Add some obstacles/cover
        this.createMapObstacles();
        
        // Add spawn points
        this.spawnPoints = [
            new BABYLON.Vector3(10, 2, 10),
            new BABYLON.Vector3(-10, 2, -10),
            new BABYLON.Vector3(10, 2, -10),
            new BABYLON.Vector3(-10, 2, 10),
            new BABYLON.Vector3(0, 2, 15),
            new BABYLON.Vector3(0, 2, -15)
        ];
    }
    
    createMapObstacles() {
        const obstacles = [
            { pos: [15, 2, 0], size: [2, 4, 8] },
            { pos: [-15, 2, 0], size: [2, 4, 8] },
            { pos: [0, 2, 20], size: [8, 4, 2] },
            { pos: [0, 2, -20], size: [8, 4, 2] },
            { pos: [25, 1, 25], size: [4, 2, 4] },
            { pos: [-25, 1, -25], size: [4, 2, 4] },
            { pos: [25, 1, -25], size: [4, 2, 4] },
            { pos: [-25, 1, 25], size: [4, 2, 4] }
        ];
        
        obstacles.forEach((obstacle, index) => {
            const box = BABYLON.MeshBuilder.CreateBox(`obstacle${index}`, {
                width: obstacle.size[0],
                height: obstacle.size[1],
                depth: obstacle.size[2]
            }, this.scene);
            
            box.position = new BABYLON.Vector3(...obstacle.pos);
            box.checkCollisions = true;
            
            // Material
            const material = new BABYLON.StandardMaterial(`obstacleMat${index}`, this.scene);
            material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
            material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
            box.material = material;
        });
    }
    
    initGameSystems() {
        // Initialize audio manager first for sound effects
        this.audioManager = new AudioManager();
        
        this.player = new Player(this);
        this.uiManager = new UIManager(this);
        
        // Setup input handling
        this.setupInputs();
        
        // Preload sounds for better performance
        this.audioManager.preloadSounds();
    }
    
    setupInputs() {
        // Setup weapon selection dropdown
        this.setupWeaponSelection();
        
        // Pointer lock for FPS controls - handle both canvas clicks
        const requestPointerLock = (event) => {
            if (!this.isPointerLocked && this.gameStarted) {
                this.canvas.requestPointerLock();
                // Prevent this click from triggering shooting
                event.preventDefault();
                event.stopPropagation();
            }
        };
        
        this.canvas.addEventListener('click', requestPointerLock);
    }
    
    setupWeaponSelection() {
        const weaponDropdown = document.getElementById('weaponDropdown');
        const weaponDescription = document.getElementById('weaponDescription');
        const startButton = document.getElementById('startButton');
        
        // Weapon configurations
        const weaponConfigs = {
            'bulldog': window.BulldogConfig,
            'l118a1': window.L118A1Config
        };
        
        // Update description when weapon changes
        if (weaponDropdown && weaponDescription) {
            weaponDropdown.addEventListener('change', (event) => {
                const selectedWeapon = event.target.value;
                const config = weaponConfigs[selectedWeapon];
                if (config) {
                    weaponDescription.textContent = config.description;
                }
                
                // Update selected weapon for new players
                this.selectedWeapon = selectedWeapon;
                
                // If player is already in game, switch weapon immediately
                if (this.player && this.gameStarted) {
                    this.player.switchWeapon(selectedWeapon);
                }
            });
        }
        
        // Handle start button click
        if (startButton) {
            startButton.addEventListener('click', (event) => {
                // Save username from input field
                if (this.uiManager) {
                    this.uiManager.saveUsername();
                }
                
                // Get selected weapon
                const selectedWeapon = weaponDropdown ? weaponDropdown.value : 'bulldog';
                this.selectedWeapon = selectedWeapon;
                
                // Start the game and request pointer lock
                if (!this.isPointerLocked) {
                    this.canvas.requestPointerLock();
                    event.preventDefault();
                    event.stopPropagation();
                }
            });
        }
        
        // Handle pointer lock change events (different browsers use different event names)
        const handlePointerLockChange = () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
            this.canvas.style.cursor = this.isPointerLocked ? 'none' : 'default';
            
            // Hide click to start message when pointer lock is gained, show when lost
            const clickToStart = document.getElementById('clickToStart');
            if (clickToStart) {
                if (this.isPointerLocked) {
                    clickToStart.style.display = 'none';
                } else if (this.gameStarted) {
                    // Only show the click to start if the game has started
                    clickToStart.style.display = 'block';
                }
            }
            
            // Notify player about pointer lock state change
            if (this.player) {
                this.player.onPointerLockChange(this.isPointerLocked);
            }
        };
        
        // Add event listeners for different browsers
        document.addEventListener('pointerlockchange', handlePointerLockChange);
        document.addEventListener('mozpointerlockchange', handlePointerLockChange);
        document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
        
        // F1 to toggle debug mode, number keys for weapon switching (ESC handled by UIManager)
        document.addEventListener('keydown', (event) => {
            if (event.code === 'F1') {
                this.debugMode = !this.debugMode;
                console.log('Debug mode:', this.debugMode ? 'ON' : 'OFF');
                event.preventDefault();
            } else if (event.code === 'Digit1' && this.player && this.gameStarted) {
                // Switch to Bulldog (weapon 1)
                this.selectedWeapon = 'bulldog';
                this.player.switchWeapon('bulldog');
                this.updateWeaponDropdown('bulldog');
                event.preventDefault();
            } else if (event.code === 'Digit2' && this.player && this.gameStarted) {
                // Switch to L118A1 Sniper (weapon 2)
                this.selectedWeapon = 'l118a1';
                this.player.switchWeapon('l118a1');
                this.updateWeaponDropdown('l118a1');
                event.preventDefault();
            }
        });
    }
    
    updateWeaponDropdown(weaponType) {
        const weaponDropdown = document.getElementById('weaponDropdown');
        const weaponDescription = document.getElementById('weaponDescription');
        
        if (weaponDropdown) {
            weaponDropdown.value = weaponType;
        }
        
        if (weaponDescription) {
            const weaponConfigs = {
                'bulldog': window.BulldogConfig,
                'l118a1': window.L118A1Config
            };
            const config = weaponConfigs[weaponType];
            if (config) {
                weaponDescription.textContent = config.description;
            }
        }
    }
    
    async initNetwork() {
        this.networkManager = new NetworkManager(this);
        await this.networkManager.connect();
    }
    
    startGame() {
        // Hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        // Show click to start message
        const clickToStart = document.getElementById('clickToStart');
        if (clickToStart) {
            clickToStart.style.display = 'block';
        }
        
        this.gameStarted = true;
        console.log('Kronkar FPS started!');
    }
    
    update() {
        const now = performance.now();
        let deltaTime = (now - this.lastUpdateTime) / 1000;
        
        // Initialize lastUpdateTime on first run
        if (this.lastUpdateTime === 0) {
            deltaTime = 1/60; // Assume 60fps for first frame
        }
        
        this.lastUpdateTime = now;
        
        // Cap deltaTime to prevent huge jumps
        deltaTime = Math.min(deltaTime, 1/30); // Max 30fps minimum
        
        // Update FPS counter (always run, regardless of game state)
        this.frameCount++;
        this.fpsUpdateTime += deltaTime;
        if (this.fpsUpdateTime >= 1.0) { // Update FPS display every second
            this.displayFps = Math.round(this.frameCount / this.fpsUpdateTime);
            this.frameCount = 0;
            this.fpsUpdateTime = 0;
            
            // Update FPS display in UI
            const fpsElement = document.getElementById('fpsCounter');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${this.displayFps}`;
                
                // Color code FPS: Green >50, Yellow 30-50, Red <30
                if (this.displayFps >= 50) {
                    fpsElement.style.color = '#00ff00';
                } else if (this.displayFps >= 30) {
                    fpsElement.style.color = '#ffff00';
                } else {
                    fpsElement.style.color = '#ff0000';
                }
            }
        }
        
        if (!this.gameStarted) return;
        
        // Update player
        if (this.player) {
            this.player.update(deltaTime);
        }
        
        // Update remote players
        this.remotePlayers.forEach(remotePlayer => {
            remotePlayer.update(deltaTime);
        });
        
        // Update bullets
        this.updateBullets(deltaTime);
        
        // Update UI
        if (this.uiManager) {
            this.uiManager.update(deltaTime);
        }
    }
    
    updateBullets(deltaTime) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.lifetime -= deltaTime;
            
            if (bullet.lifetime <= 0) {
                this.removeBullet(i);
                continue;
            }
            
            // Store previous position for collision detection
            const previousPosition = bullet.mesh.position.clone();
            
            // Apply gravity (for realistic ballistics)
            bullet.velocity.y += bullet.gravity * deltaTime;
            
            // Move bullet based on velocity
            const movement = bullet.velocity.scale(deltaTime);
            bullet.mesh.position.addInPlace(movement);
            
            // Check for collisions
            this.checkBulletCollision(bullet, previousPosition, i);
        }
    }
    
    // Method to create physics projectile
    createProjectile(origin, direction, shooterId) {
        // Get weapon config from player or default to bulldog
        let weaponConfig = window.BulldogConfig;
        if (this.player && this.player.currentWeaponConfig) {
            weaponConfig = this.player.currentWeaponConfig;
        }
        const projectileConfig = weaponConfig.projectile;
        
        const bullet = {
            id: Math.random().toString(36).substr(2, 9), // Unique ID
            mesh: BABYLON.MeshBuilder.CreateSphere('bullet', { 
                diameter: projectileConfig.diameter
            }, this.scene),
            velocity: direction.normalize().scale(projectileConfig.velocity),
            gravity: projectileConfig.gravity,
            damage: weaponConfig.damage,
            shooterId: shooterId,
            lifetime: projectileConfig.lifetime,
            hasHit: false
        };
        
        bullet.mesh.position = origin.clone();
        bullet.mesh.metadata = { isBullet: true, bulletData: bullet };
        
        // Bullet material using config color
        const material = new BABYLON.StandardMaterial('bulletMat', this.scene);
        const color = new BABYLON.Color3(projectileConfig.color.r, projectileConfig.color.g, projectileConfig.color.b);
        material.emissiveColor = color;
        material.diffuseColor = color;
        bullet.mesh.material = material;
        
        // Make bullet pickable for collision detection
        bullet.mesh.isPickable = false; // Don't let bullets hit each other
        
        this.bullets.push(bullet);
        
        return bullet;
    }
    
    // Check bullet collision with environment and players
    checkBulletCollision(bullet, previousPosition, bulletIndex) {
        if (bullet.hasHit) return;
        
        // Create ray from previous position to current position
        const direction = bullet.mesh.position.subtract(previousPosition).normalize();
        const distance = BABYLON.Vector3.Distance(previousPosition, bullet.mesh.position);
        const ray = new BABYLON.Ray(previousPosition, direction, distance);
        
        // Check collision with scene objects and player character meshes
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            // Filter out bullets, UI elements, weapon meshes, hit effects, safety floors
            if (mesh.name === 'bullet' || 
                mesh.name === 'hitEffect' ||
                mesh.name === 'invisibleFloor' ||
                mesh.name.startsWith('ui_') || 
                mesh.isPickable === false) {
                return false;
            }
            
            // Filter out shooter's own character meshes
            if (mesh.metadata && mesh.metadata.isPlayerMesh && mesh.metadata.playerId === bullet.shooterId) {
                return false;
            }
            
            // Filter out weapon/bullet/hit effect metadata
            if (mesh.metadata && (mesh.metadata.isWeapon || mesh.metadata.isBullet || mesh.metadata.isHitEffect || mesh.metadata.isSafetyFloor)) {
                return false;
            }
            
            return true;
        });
        
        if (hit.hit) {
            // Check if hit mesh is a player character mesh
            if (hit.pickedMesh && hit.pickedMesh.metadata && hit.pickedMesh.metadata.isPlayerMesh) {
                const hitPlayerId = hit.pickedMesh.metadata.playerId;
                
                // Don't hit self
                if (hitPlayerId === bullet.shooterId) {
                    return;
                }
                
                // Check if it's the local player
                if (hitPlayerId === (this.networkManager?.playerId || 'local')) {
                    this.handleLocalPlayerHit(bullet, bulletIndex);
                } else {
                    // It's a remote player
                    const remotePlayer = this.remotePlayers.get(hitPlayerId);
                    if (remotePlayer && remotePlayer.alive) {
                        this.handlePlayerHit(bullet, remotePlayer, hitPlayerId, bulletIndex);
                    }
                }
                return;
            } else {
                // It's an environment hit
                this.handleBulletHit(bullet, hit, bulletIndex);
                return;
            }
        }
        
        // Check collision with remote players
        this.remotePlayers.forEach((remotePlayer, playerId) => {
            if (playerId === bullet.shooterId || !remotePlayer.alive) return;
            
            const playerPosition = remotePlayer.position;
            const distanceToPlayer = BABYLON.Vector3.Distance(bullet.mesh.position, playerPosition);
            
            // Simple sphere collision (radius of 1 unit)
            if (distanceToPlayer <= 1.0) {
                this.handlePlayerHit(bullet, remotePlayer, playerId, bulletIndex);
            }
        });
        
        // Check collision with local player (if bullet is from remote player)
        if (bullet.shooterId !== (this.networkManager?.playerId || 'local') && this.player && this.player.alive) {
            const playerPosition = this.player.position;
            const distanceToPlayer = BABYLON.Vector3.Distance(bullet.mesh.position, playerPosition);
            
            if (distanceToPlayer <= 1.0) {
                this.handleLocalPlayerHit(bullet, bulletIndex);
            }
        }
    }
    
    // Handle bullet hitting environment
    handleBulletHit(bullet, hit, bulletIndex) {
        bullet.hasHit = true;
        
        // Create hit effect at impact point
        this.createHitEffect(hit.pickedPoint);
        
        // Remove bullet
        this.removeBullet(bulletIndex);
        
        console.log('Bullet hit environment at:', hit.pickedPoint);
    }
    
    // Handle bullet hitting remote player
    handlePlayerHit(bullet, remotePlayer, playerId, bulletIndex) {
        bullet.hasHit = true;
        
        // Create hit effect at player position
        this.createHitEffect(remotePlayer.position);
        
        // Play damage sound effect
        if (this.audioManager) {
            this.audioManager.playDamageSound();
        }
        
        // Send damage to server (server will validate)
        if (this.networkManager) {
            this.networkManager.socket.emit('bulletHit', {
                bulletId: bullet.id,
                targetPlayerId: playerId,
                damage: bullet.damage,
                shooterId: bullet.shooterId
            });
        }
        
        // Remove bullet
        this.removeBullet(bulletIndex);
        
        console.log(`Bullet hit player ${playerId}`);
    }
    
    // Handle bullet hitting local player
    handleLocalPlayerHit(bullet, bulletIndex) {
        bullet.hasHit = true;
        
        // Create hit effect
        this.createHitEffect(this.player.position);
        
        // Apply damage locally and send to server (takeDamage already plays sound)
        this.player.takeDamage(bullet.damage);
        
        if (this.networkManager) {
            this.networkManager.socket.emit('bulletHit', {
                bulletId: bullet.id,
                targetPlayerId: this.networkManager.playerId,
                damage: bullet.damage,
                shooterId: bullet.shooterId
            });
        }
        
        // Remove bullet
        this.removeBullet(bulletIndex);
        
        console.log('Local player hit by bullet');
    }
    
    // Clean up bullet
    removeBullet(index) {
        const bullet = this.bullets[index];
        if (bullet && bullet.mesh) {
            bullet.mesh.dispose();
        }
        this.bullets.splice(index, 1);
    }
    
    // Create hit effect (moved from player.js)
    createHitEffect(position) {
        // Create a simple hit effect
        const hitEffect = BABYLON.MeshBuilder.CreateSphere('hitEffect', {
            diameter: 2.0 // Doubled from 0.5 for better visibility
        }, this.scene);
        
        hitEffect.position = position;
        
        // Make hit effect non-interactable with projectiles
        hitEffect.isPickable = false;
        hitEffect.checkCollisions = false;
        hitEffect.metadata = { isHitEffect: true };
        
        // Hit effect material
        const material = new BABYLON.StandardMaterial('hitEffectMat', this.scene);
        material.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
        hitEffect.material = material;
        
        // Animate and dispose
        setTimeout(() => {
            hitEffect.dispose();
        }, 200);
    }
    
    // Method to add remote player
    addRemotePlayer(playerData) {
        const remotePlayer = new RemotePlayer(this, playerData);
        this.remotePlayers.set(playerData.id, remotePlayer);
        return remotePlayer;
    }
    
    // Method to remove remote player
    removeRemotePlayer(playerId) {
        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
            remotePlayer.dispose();
            this.remotePlayers.delete(playerId);
        }
    }
    
    // Method to get spawn position
    getSpawnPosition() {
        if (this.spawnPoints && this.spawnPoints.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.spawnPoints.length);
            return this.spawnPoints[randomIndex].clone();
        }
        return new BABYLON.Vector3(0, 2, 0);
    }
    
    addDebugMarker(position, label, color) {
        // Create a debug sphere to visualize positions
        const marker = BABYLON.MeshBuilder.CreateSphere(`debugMarker_${label}`, {
            diameter: 15 // Larger markers to be visible at map scale
        }, this.scene);
        
        marker.position = position.clone();
        
        // Bright material
        const material = new BABYLON.StandardMaterial(`debugMat_${label}`, this.scene);
        material.emissiveColor = color;
        material.diffuseColor = color;
        marker.material = material;
        
        // Add text label
        console.log(`DEBUG MARKER: ${label} at position ${position.toString()}`);
        
        // Make it non-collidable
        marker.isPickable = false;
        marker.checkCollisions = false;
        
        return marker;
    }

    dispose() {
        if (this.engine) {
            this.engine.dispose();
        }
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
}); 