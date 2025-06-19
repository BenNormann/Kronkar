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
        
        // Game objects
        this.remotePlayers = new Map();
        this.bullets = [];
        this.map = null;
        
        // Performance
        this.lastUpdateTime = 0;
        this.fps = 60;
        
        // Initialize the game
        this.init();
    }
    
    async init() {
        try {
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
        
        // Lighting
        const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;
        
        const directionalLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -1, -1), this.scene);
        directionalLight.position = new BABYLON.Vector3(20, 40, 20);
        directionalLight.intensity = 0.5;
        
        // Create default map
        await this.createDefaultMap();
        
        // Initialize camera (will be controlled by player)
        this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 2, 0), this.scene);
        this.camera.setTarget(BABYLON.Vector3.Zero());
        
        // Set as active camera
        this.scene.activeCamera = this.camera;
        
        // Physics (optional - can be enabled later)
        // this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin());
    }
    
    async createDefaultMap() {
        // Create a simple test map
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
        this.player = new Player(this);
        this.uiManager = new UIManager(this);
        
        // Setup input handling
        this.setupInputs();
    }
    
    setupInputs() {
        // Pointer lock for FPS controls - handle both canvas and welcome overlay clicks
        const requestPointerLock = (event) => {
            if (!this.isPointerLocked && this.gameStarted) {
                this.canvas.requestPointerLock();
                // Prevent this click from triggering shooting
                event.preventDefault();
                event.stopPropagation();
            }
        };
        
        this.canvas.addEventListener('click', requestPointerLock);
        
        // Also handle clicks on the welcome overlay
        const clickToStart = document.getElementById('clickToStart');
        if (clickToStart) {
            clickToStart.addEventListener('click', requestPointerLock);
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
        
        // ESC to release pointer lock
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Escape' && this.isPointerLocked) {
                document.exitPointerLock();
            }
        });
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
                bullet.mesh.dispose();
                this.bullets.splice(i, 1);
            } else {
                // Move bullet
                bullet.mesh.position.addInPlace(
                    bullet.direction.scale(bullet.speed * deltaTime)
                );
            }
        }
    }
    
    // Method to create visual bullet trail
    createBulletTrail(origin, direction) {
        const bullet = {
            mesh: BABYLON.MeshBuilder.CreateSphere('bullet', { 
                diameter: 0.1 
            }, this.scene),
            direction: direction.normalize(),
            speed: 100,
            lifetime: 2.0
        };
        
        bullet.mesh.position = origin.clone();
        
        // Bullet material
        const material = new BABYLON.StandardMaterial('bulletMat', this.scene);
        material.emissiveColor = new BABYLON.Color3(1, 1, 0);
        bullet.mesh.material = material;
        
        this.bullets.push(bullet);
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