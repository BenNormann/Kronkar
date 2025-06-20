class Player {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.camera = game.camera;
        
        // Player state - get spawn position from game
        this.position = game.getSpawnPosition();
        this.rotation = new BABYLON.Vector3(0, 0, 0);
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.health = 100;
        this.alive = true;
        
        // Player height offset for proper human scale
        this.eyeHeight = 16; // Camera height above player position for proper human scale (doubled)
        
        // Update camera position to match spawn position with proper height
        this.camera.position = this.position.clone();
        this.camera.position.y += this.eyeHeight;
        
                  // Movement settings - increased for large dust2 map
          this.speed = 150;  // Fast enough for large map but not breaking collision
          this.horizontalSpeed = 75; // Half speed for left/right strafe movement
          this.sprintSpeed = 225; // 1.5x normal speed when sprinting
          this.jumpForce = 70; // Higher jump for better map navigation (doubled)
        this.mouseSensitivity = 0.003;
        this.isGrounded = false;
          this.gravity = -200; // Stronger gravity but not breaking collision
        
        // Camera smoothing
        this.cameraRotationTarget = new BABYLON.Vector3(0, 0, 0);
        this.cameraRotationSpeed = 50; // Smoothing factor - higher = more responsive
        
        // Shooting
        this.canShoot = true;
        this.lastShotTime = 0;
        this.semiAutoLock = false; // For semi-automatic weapons
        
        // Pointer lock state
        this.isPointerLocked = false;
        this.justGainedPointerLock = false;
        
        // Weapon system
        this.weapon = null;
        this.weaponMeshes = [];
        this.assetLoader = null;
        this.weaponRestPosition = null; // Store the weapon's rest position
        this.weaponRestRotation = null; // Store the weapon's rest rotation
        this.currentWeaponConfig = null; // Current weapon configuration
        
        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            shoot: false,
            sprint: false
        };
        
        this.mouseMovement = { x: 0, y: 0 };
        this.mouseAccumulation = { x: 0, y: 0 };
        
        // Walking sound
        this.isMoving = false;
        this.wasMoving = false;
        
        // Debug player position
        console.log(`PLAYER SPAWNED at position: ${this.position.toString()}`);
        
        this.setupControls();
        this.initWeapon();
    }
    
    async initWeapon() {
        try {
            // Get selected weapon from game, default to bulldog
            const selectedWeapon = this.game.selectedWeapon || 'bulldog';
            
            // Set current weapon config based on selection
            if (selectedWeapon === 'l118a1' && window.L118A1Config) {
                this.currentWeaponConfig = window.L118A1Config;
            } else {
            this.currentWeaponConfig = window.BulldogConfig;
            }
            
            console.log('Loading weapon:', this.currentWeaponConfig.name);
            
            // Initialize asset loader
            this.assetLoader = new AssetLoader(this.scene);
            
            // Load weapon using config
            const result = await this.assetLoader.loadModel(
                this.currentWeaponConfig.name.toLowerCase(), 
                this.currentWeaponConfig.model.folder, 
                this.currentWeaponConfig.model.file
            );
            
            if (result.meshes && result.meshes.length > 0) {
                this.weaponMeshes = result.meshes;
                this.attachWeaponToCamera();
                console.log(`${this.currentWeaponConfig.name} weapon loaded and attached`);
            } else {
                console.error('No meshes found in the weapon model');
            }
        } catch (error) {
            console.error('Failed to load weapon:', error);
        }
    }
    
    attachWeaponToCamera() {
        if (this.weaponMeshes.length === 0 || !this.currentWeaponConfig) {
            console.error('No weapon meshes to attach or no weapon config');
            return;
        }
        
        console.log(`Attaching ${this.currentWeaponConfig.name} to camera...`);
        console.log(`Found ${this.weaponMeshes.length} weapon meshes to attach`);
        
        // Create weapon parent for positioning
        this.weapon = new BABYLON.TransformNode('weaponParent', this.scene);
        
        // Attach all weapon meshes to the weapon parent
        this.weaponMeshes.forEach((mesh, index) => {
            console.log(`=== MESH ${index} ===`);
            console.log(`Name: "${mesh.name}"`);
            console.log(`Original position: ${mesh.position.toString()}`);
            console.log(`Original rotation: ${mesh.rotation.toString()}`);
            console.log(`Original scaling: ${mesh.scaling.toString()}`);
            console.log(`Has parent: ${mesh.parent ? mesh.parent.name : 'none'}`);
            
            mesh.parent = this.weapon;
            mesh.setEnabled(true);
            mesh.isVisible = true; // Explicitly set visible
            
            console.log(`After parenting - position: ${mesh.position.toString()}`);
            console.log(`After parenting - world position: ${mesh.getAbsolutePosition().toString()}`);
        });
        
        // Position weapon using config
        const config = this.currentWeaponConfig.model;
        
        // Apply transformations uniformly to all weapons
        this.weapon.position = new BABYLON.Vector3(config.position.x, config.position.y, config.position.z);
        this.weapon.rotation = new BABYLON.Vector3(config.rotation.x, config.rotation.y, config.rotation.z);
        this.weapon.scaling = new BABYLON.Vector3(config.scale.x, config.scale.y, config.scale.z);
        
        // Log mesh information after transformations are applied
        console.log(`=== WEAPON MESH DETAILS ===`);
        this.weaponMeshes.forEach((mesh, index) => {
            console.log(`Mesh ${index}: "${mesh.name}" - Position: ${mesh.position.toString()}`);
        });
        
        console.log(`Weapon positioned at: ${this.weapon.position.toString()}`);
        console.log(`Weapon rotation: ${this.weapon.rotation.toString()}`);
        console.log(`Weapon scaling: ${this.weapon.scaling.toString()}`);
        
        // Store the rest position and rotation for recoil animations
        this.weaponRestPosition = this.weapon.position.clone();
        this.weaponRestRotation = this.weapon.rotation.clone();
        
        // Parent weapon to camera so it follows camera movement
        this.weapon.parent = this.camera;
        console.log(`Weapon parented to camera: ${this.camera.name}`);
        
        // Optimize weapon rendering and disable unnecessary features
        this.weaponMeshes.forEach((mesh, index) => {
            mesh.renderingGroupId = 1; // Render after scene
            mesh.isPickable = false; // Don't interfere with shooting raycasts
            mesh.checkCollisions = false; // Also disable physics collisions
            mesh.metadata = { isWeapon: true }; // Add weapon tag for filtering
            
            // Performance optimizations for weapon meshes (but don't freeze world matrix!)
            mesh.alwaysSelectAsActiveMesh = true; // Skip frustum culling for weapons
            mesh.doNotSyncBoundingInfo = true; // Skip bounding info updates
            // DON'T freeze world matrix - weapons need to move with camera
            
            console.log(`Mesh ${index} final setup: renderingGroup=${mesh.renderingGroupId}, visible=${mesh.isVisible}, enabled=${mesh.isEnabled()}`);
        });
        
        console.log(`${this.currentWeaponConfig.name} attachment complete`);
    }
    
    // Method to switch weapons during gameplay
    async switchWeapon(weaponType) {
        console.log(`Switching to weapon: ${weaponType}`);
        
        // Dispose of current weapon
        if (this.weapon) {
            this.weapon.dispose();
            this.weapon = null;
        }
        

        
        // Clear weapon meshes
        this.weaponMeshes.forEach(mesh => {
            if (mesh) mesh.dispose();
        });
        this.weaponMeshes = [];
        
        // Set new weapon config
        if (weaponType === 'l118a1' && window.L118A1Config) {
            this.currentWeaponConfig = window.L118A1Config;
        } else {
            this.currentWeaponConfig = window.BulldogConfig;
        }
        
        // Load new weapon
        try {
            const result = await this.assetLoader.loadModel(
                this.currentWeaponConfig.name.toLowerCase(), 
                this.currentWeaponConfig.model.folder, 
                this.currentWeaponConfig.model.file
            );
            
            if (result.meshes && result.meshes.length > 0) {
                this.weaponMeshes = result.meshes;
                this.attachWeaponToCamera();
                console.log(`Switched to ${this.currentWeaponConfig.name}`);
            } else {
                console.error('No meshes found in the new weapon model');
            }
        } catch (error) {
            console.error('Failed to switch weapon:', error);
        }
    }
    
    setupControls() {
        // Keyboard input
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'KeyW':
                    this.keys.forward = true;
                    break;
                case 'KeyS':
                    this.keys.backward = true;
                    break;
                case 'KeyA':
                    this.keys.left = true;
                    break;
                case 'KeyD':
                    this.keys.right = true;
                    break;
                case 'Space':
                    this.keys.jump = true;
                    event.preventDefault();
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.keys.sprint = true;
                    break;
            }
            
            // Alternative check using event.key for better compatibility
            if (event.key === 'Shift') {
                this.keys.sprint = true;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'KeyW':
                    this.keys.forward = false;
                    break;
                case 'KeyS':
                    this.keys.backward = false;
                    break;
                case 'KeyA':
                    this.keys.left = false;
                    break;
                case 'KeyD':
                    this.keys.right = false;
                    break;
                case 'Space':
                    this.keys.jump = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.keys.sprint = false;
                    break;
            }
            
            // Alternative check using event.key for better compatibility
            if (event.key === 'Shift') {
                this.keys.sprint = false;
            }
        });
        
        // Mouse input
        document.addEventListener('mousemove', (event) => {
            if (this.isPointerLocked) {
                const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
                const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
                
                // Accumulate mouse movement for smoother input
                this.mouseAccumulation.x += movementX;
                this.mouseAccumulation.y += movementY;
            }
        });
        
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0 && this.isPointerLocked && !this.justGainedPointerLock) { // Left click
                this.keys.shoot = true;
            }
        });
        
        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) { // Left click
                this.keys.shoot = false;
            }
        });
    }
    
    update(deltaTime) {
        if (!this.alive) return;
        
        this.updateMovement(deltaTime);
        this.updateCamera(deltaTime);
        this.updateShooting(deltaTime);
        this.updateWalkingSound();
        this.updateNetworking();
    }
    
    updateMovement(deltaTime) {
        let moveVector = new BABYLON.Vector3(0, 0, 0);
        
        // Calculate movement direction based on camera rotation
        const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
        const right = this.camera.getDirection(BABYLON.Vector3.Right());
        
        // Flatten forward and right vectors (remove Y component for ground movement)
        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();
        
        // Apply movement inputs with separate speeds for forward/backward vs left/right
        let forwardBackwardVector = new BABYLON.Vector3(0, 0, 0);
        let leftRightVector = new BABYLON.Vector3(0, 0, 0);
        
        // Handle forward/backward movement
        if (this.keys.forward) {
            forwardBackwardVector.addInPlace(forward);
        }
        if (this.keys.backward) {
            forwardBackwardVector.subtractInPlace(forward);
        }
        
        // Handle left/right movement
        if (this.keys.left) {
            leftRightVector.subtractInPlace(right);
        }
        if (this.keys.right) {
            leftRightVector.addInPlace(right);
        }
        
        // Apply different speeds to each movement type
        if (forwardBackwardVector.length() > 0) {
            const baseSpeed = this.keys.sprint ? this.sprintSpeed : this.speed;
            forwardBackwardVector.normalize();
            forwardBackwardVector.scaleInPlace(baseSpeed);
        }
        
        if (leftRightVector.length() > 0) {
            const horizontalBaseSpeed = this.keys.sprint ? this.sprintSpeed * 0.5 : this.horizontalSpeed;
            leftRightVector.normalize();
            leftRightVector.scaleInPlace(horizontalBaseSpeed);
        }
        
        // Combine movement vectors
        moveVector = forwardBackwardVector.add(leftRightVector);
        
        // Apply diagonal movement reduction if moving in both directions
        if (forwardBackwardVector.length() > 0 && leftRightVector.length() > 0) {
            moveVector.scaleInPlace(2/3); // Reduce diagonal movement speed
        }
        
        // Apply horizontal velocity
        this.velocity.x = moveVector.x;
        this.velocity.z = moveVector.z;
        
        // Handle jumping
        if (this.keys.jump && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }
        
        // Apply gravity
        this.velocity.y += this.gravity * deltaTime;
        
        // Calculate movement step by step to prevent collision issues
        const moveDistance = this.velocity.scale(deltaTime);
        let newPosition = this.position.clone();
        
        // Step 1: Handle horizontal movement with wall collision
        const horizontalDistance = Math.sqrt(moveDistance.x * moveDistance.x + moveDistance.z * moveDistance.z);
        if (horizontalDistance > 0.01) { // Only check if there's meaningful horizontal movement
            const horizontalMove = new BABYLON.Vector3(moveDistance.x, 0, moveDistance.z);
            const horizontalDir = horizontalMove.normalize();
            let canMoveHorizontally = true;
            
            // For high-speed movement (sprinting), use multiple collision checks along the path
            const isHighSpeed = horizontalDistance > 3.0; // Detect sprinting or fast movement
            const checkSteps = isHighSpeed ? 3 : 1; // More checks for high speed
            const safetyDistance = isHighSpeed ? 4.0 : 2.5; // Larger safety margin for high speed
            
            for (let step = 0; step < checkSteps && canMoveHorizontally; step++) {
                const stepRatio = (step + 1) / checkSteps;
                const checkPosition = this.position.add(horizontalMove.scale(stepRatio));
                
                // Cast rays at different heights to check for wall collision
                const rayHeights = [1, 3, 5, 7, 9]; // More height checks including head level
                for (let height of rayHeights) {
                    const rayOrigin = checkPosition.add(new BABYLON.Vector3(0, height, 0));
                    const horizontalRay = new BABYLON.Ray(rayOrigin, horizontalDir);
                    const wallHit = this.scene.pickWithRay(horizontalRay, (mesh) => {
                        return mesh.checkCollisions && mesh.name !== 'bullet' && mesh.name !== 'hitEffect' && 
                               !mesh.name.startsWith('ui_') && (!mesh.metadata || !mesh.metadata.isWeapon);
                    });
                    
                    // If we would hit a wall within safety distance
                    if (wallHit.hit && wallHit.distance < safetyDistance) {
                        canMoveHorizontally = false;
                        break;
                    }
                    
                    // Also check for collision in a wider arc for sprinting
                    if (isHighSpeed) {
                        const sideAngles = [-0.3, 0.3]; // Check slightly left and right
                        for (let angle of sideAngles) {
                            const sideDir = new BABYLON.Vector3(
                                horizontalDir.x * Math.cos(angle) - horizontalDir.z * Math.sin(angle),
                                0,
                                horizontalDir.x * Math.sin(angle) + horizontalDir.z * Math.cos(angle)
                            );
                            const sideRay = new BABYLON.Ray(rayOrigin, sideDir);
                            const sideHit = this.scene.pickWithRay(sideRay, (mesh) => {
                                return mesh.checkCollisions && mesh.name !== 'bullet' && mesh.name !== 'hitEffect' && 
                                       !mesh.name.startsWith('ui_') && (!mesh.metadata || !mesh.metadata.isWeapon);
                            });
                            
                            if (sideHit.hit && sideHit.distance < safetyDistance * 0.8) {
                                canMoveHorizontally = false;
                                break;
                            }
                        }
                        if (!canMoveHorizontally) break;
                    }
                }
                if (!canMoveHorizontally) break;
            }
            
            // Apply horizontal movement if not blocked
            if (canMoveHorizontally) {
                newPosition.x = this.position.x + moveDistance.x;
                newPosition.z = this.position.z + moveDistance.z;
            }
        }
        
        // Step 2: Handle vertical movement and ground detection
        newPosition.y = this.position.y + moveDistance.y;
        
        // Ground check - always cast from slightly above the new position
        const groundCheckOrigin = new BABYLON.Vector3(newPosition.x, newPosition.y + 1, newPosition.z);
        const groundRay = new BABYLON.Ray(groundCheckOrigin, new BABYLON.Vector3(0, -1, 0));
        const groundHit = this.scene.pickWithRay(groundRay, (mesh) => {
            return mesh.checkCollisions && mesh.name !== 'bullet' && mesh.name !== 'hitEffect' && 
                   !mesh.name.startsWith('ui_') && (!mesh.metadata || !mesh.metadata.isWeapon);
        });
        
        // Apply ground collision
        if (groundHit.hit && groundHit.distance < 12.0) {
            const groundY = groundHit.pickedPoint.y + 2.0; // Stand on ground with offset
            if (newPosition.y <= groundY) {
                newPosition.y = groundY;
                this.velocity.y = Math.max(0, this.velocity.y); // Stop falling
            this.isGrounded = true;
            } else {
                this.isGrounded = false;
            }
        } else {
            this.isGrounded = false;
        }
        
        // Update positions
        this.position = newPosition;
        this.camera.position = this.position.clone();
        this.camera.position.y += this.eyeHeight; // Maintain proper eye height
        
        // Update rotation for networking
        this.rotation.x = this.camera.rotation.x;
        this.rotation.y = this.camera.rotation.y;
        this.rotation.z = this.camera.rotation.z;
        
        // Track movement for walking sound
        this.isMoving = (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) && 
                       this.isGrounded && horizontalDistance > 0.01;
    }
    
    updateCamera(deltaTime) {
        if (this.isPointerLocked) {
            // Update target rotation based on accumulated mouse movement
            this.cameraRotationTarget.y += this.mouseAccumulation.x * this.mouseSensitivity;
            this.cameraRotationTarget.x += this.mouseAccumulation.y * this.mouseSensitivity;
            
            // Clamp vertical rotation target
            this.cameraRotationTarget.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotationTarget.x));
            
            // Smoothly interpolate camera rotation towards target using deltaTime
            const lerpFactor = Math.min(1.0, this.cameraRotationSpeed * deltaTime);
            
            this.camera.rotation.x = this.lerp(this.camera.rotation.x, this.cameraRotationTarget.x, lerpFactor);
            this.camera.rotation.y = this.lerp(this.camera.rotation.y, this.cameraRotationTarget.y, lerpFactor);
            
            // Reset accumulated mouse movement
            this.mouseAccumulation.x = 0;
            this.mouseAccumulation.y = 0;
        }
    }
    
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }
    
    updateWalkingSound() {
        // Handle walking sound based on movement state
        if (this.isMoving && !this.wasMoving) {
            // Just started moving - play walking sound
            if (this.game.audioManager) {
                this.game.audioManager.playWalkingSound();
            }
        } else if (!this.isMoving && this.wasMoving) {
            // Just stopped moving - stop walking sound
            if (this.game.audioManager) {
                this.game.audioManager.stopWalkingSound();
            }
        }
        
        // Update previous movement state
        this.wasMoving = this.isMoving;
    }
    
    updateShooting(deltaTime) {
        if (!this.currentWeaponConfig) return;
        
        const currentTime = Date.now() / 1000;
        const cooldownTime = 60 / this.currentWeaponConfig.fireRate; // Convert RPM to seconds
        
        // Handle different fire modes
        if (this.currentWeaponConfig.fireMode === 'semi') {
            // Semi-automatic: only shoot on key press, not hold
            if (this.keys.shoot && this.canShoot && this.isPointerLocked && !this.justGainedPointerLock && (currentTime - this.lastShotTime) >= cooldownTime && !this.semiAutoLock) {
                this.shoot();
                this.lastShotTime = currentTime;
                this.semiAutoLock = true; // Prevent continuous fire
            }
            
            // Reset semi-auto lock when key is released
            if (!this.keys.shoot) {
                this.semiAutoLock = false;
            }
        } else {
            // Automatic mode: shoot while holding
        if (this.keys.shoot && this.canShoot && this.isPointerLocked && !this.justGainedPointerLock && (currentTime - this.lastShotTime) >= cooldownTime) {
            this.shoot();
            this.lastShotTime = currentTime;
            }
        }
    }
    
    shoot() {
        // Calculate barrel position and direction
        const { origin, direction } = this.getBarrelPositionAndDirection();
        
        // Play weapon fire sound
        if (this.game.audioManager && this.currentWeaponConfig) {
            this.game.audioManager.playWeaponSound(this.currentWeaponConfig);
        }
        
        // Add weapon recoil animation
        this.addWeaponRecoil();
        
        // Create physics projectile from barrel
        this.game.createProjectile(origin, direction, this.game.networkManager?.playerId || 'local');
        
        // Send shoot event to server with barrel position and direction
        if (this.game.networkManager) {
            this.game.networkManager.sendShoot(origin, direction);
        }
    }
    
    getBarrelPositionAndDirection() {
        // Default to camera if no weapon is available
        if (!this.weapon || !this.currentWeaponConfig) {
            return {
                origin: this.camera.position.clone(),
                direction: this.camera.getDirection(BABYLON.Vector3.Forward())
            };
        }
        
        // Calculate barrel position using weapon config
        const config = this.currentWeaponConfig.barrel;
        const barrelOffset = new BABYLON.Vector3(
            config.offset.x,  // Right/left offset
            config.offset.y,  // Up/down offset
            config.offset.z   // Forward/back offset
        );
        
        // Transform the barrel offset by the weapon's world matrix
        const weaponMatrix = this.weapon.getWorldMatrix();
        const barrelWorldPosition = BABYLON.Vector3.TransformCoordinates(barrelOffset, weaponMatrix);
        
        // Get camera direction for aiming (where the player is looking)
        const aimDirection = this.camera.getDirection(BABYLON.Vector3.Forward());
        
        // Move the origin slightly forward along the aim direction to ensure it's outside weapon geometry
        const rayOrigin = barrelWorldPosition.add(aimDirection.scale(config.rayOffset));
        
        // Optional: Create a small visual indicator at barrel position for debugging
        // Temporarily enable debug indicator to troubleshoot bullet issues
            this.createBarrelDebugIndicator(rayOrigin);
        
        return {
            origin: rayOrigin,
            direction: aimDirection
        };
    }
    
    createBarrelDebugIndicator(position) {
        // Check if this is a sniper rifle for enhanced muzzle flash
        const isSniper = this.currentWeaponConfig && this.currentWeaponConfig.type === 'sniper_rifle';
        
        if (isSniper) {
            this.createSniperMuzzleFlash(position);
        } else {
            this.createStandardMuzzleFlash(position);
        }
    }
    
    createSniperMuzzleFlash(position) {
        // Create dramatic sniper muzzle flash with multiple elements
        const muzzleFlashGroup = new BABYLON.TransformNode('sniperMuzzleFlash', this.scene);
        
        // Main bright flash (larger and brighter than standard)
        const mainFlash = BABYLON.MeshBuilder.CreateSphere('mainFlash', {
            diameter: 1.8 // Much larger for sniper
        }, this.scene);
        mainFlash.parent = muzzleFlashGroup;
        
        // Secondary expanding ring flash
        const ringFlash = BABYLON.MeshBuilder.CreateTorus('ringFlash', {
            diameter: 2.2,
            thickness: 0.3
        }, this.scene);
        ringFlash.parent = muzzleFlashGroup;
        
        // Forward blast cone
        const blastCone = BABYLON.MeshBuilder.CreateCylinder('blastCone', {
            height: 1.5,
            diameterTop: 1.2,
            diameterBottom: 0.3
        }, this.scene);
        blastCone.parent = muzzleFlashGroup;
        blastCone.position.z = 0.75; // Forward from center
        blastCone.rotation.x = Math.PI / 2; // Point forward
        
        // Position relative to weapon so it moves with the weapon
        if (this.weapon && this.currentWeaponConfig) {
            muzzleFlashGroup.parent = this.weapon;
            const config = this.currentWeaponConfig.barrel;
            
            // Use the same method as standard weapons - convert world position to local weapon space
            const weaponMatrix = this.weapon.getWorldMatrix();
            const localPosition = BABYLON.Vector3.TransformCoordinates(position, weaponMatrix.invert());
            
            // For sniper, adjust the local position to move flash to the right side
            if (this.currentWeaponConfig.type === 'sniper_rifle') {
                // Add offset to move flash forward and to the right from player's perspective
                localPosition.x += 2; // Move forward
                localPosition.z -= 1.3; // Move to right
            }
            
            muzzleFlashGroup.position = localPosition;
        } else {
            // Fallback to world position if no weapon
            muzzleFlashGroup.position = position;
        }
        
        // Create materials for each element
        const mainMaterial = new BABYLON.StandardMaterial('sniperMainFlash', this.scene);
        mainMaterial.emissiveColor = new BABYLON.Color3(1, 0.9, 0.6); // Bright white-yellow
        mainMaterial.diffuseColor = new BABYLON.Color3(1, 0.8, 0.3);
        mainMaterial.emissiveIntensity = 3.5; // Very bright
        mainFlash.material = mainMaterial;
        
        const ringMaterial = new BABYLON.StandardMaterial('sniperRingFlash', this.scene);
        ringMaterial.emissiveColor = new BABYLON.Color3(1, 0.6, 0.2); // Orange ring
        ringMaterial.diffuseColor = new BABYLON.Color3(1, 0.5, 0.1);
        ringMaterial.emissiveIntensity = 2.5;
        ringFlash.material = ringMaterial;
        
        const coneMaterial = new BABYLON.StandardMaterial('sniperConeFlash', this.scene);
        coneMaterial.emissiveColor = new BABYLON.Color3(1, 0.7, 0.3); // Yellow-orange blast
        coneMaterial.diffuseColor = new BABYLON.Color3(1, 0.6, 0.2);
        coneMaterial.emissiveIntensity = 2.0;
        coneMaterial.alpha = 0.8; // Semi-transparent
        blastCone.material = coneMaterial;
        
        // Make all elements non-collidable
        [mainFlash, ringFlash, blastCone].forEach(mesh => {
            mesh.isPickable = false;
            mesh.checkCollisions = false;
        });
        
        // Animate the muzzle flash for more dramatic effect
        const expandAnimation = new BABYLON.Animation(
            'muzzleFlashExpand',
            'scaling',
            60,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        const expandKeys = [
            { frame: 0, value: new BABYLON.Vector3(0.1, 0.1, 0.1) },
            { frame: 3, value: new BABYLON.Vector3(1.2, 1.2, 1.2) },
            { frame: 12, value: new BABYLON.Vector3(0.3, 0.3, 0.3) }
        ];
        expandAnimation.setKeys(expandKeys);
        
        // Apply animation to main flash
        this.scene.beginDirectAnimation(mainFlash, [expandAnimation], 0, 12, false);
        
        // Ring flash animation (delayed and different pattern)
        const ringExpandAnimation = expandAnimation.clone();
        ringExpandAnimation.name = 'ringFlashExpand';
        const ringExpandKeys = [
            { frame: 0, value: new BABYLON.Vector3(0.2, 0.2, 0.2) },
            { frame: 5, value: new BABYLON.Vector3(1.5, 1.5, 1.5) },
            { frame: 15, value: new BABYLON.Vector3(0.1, 0.1, 0.1) }
        ];
        ringExpandAnimation.setKeys(ringExpandKeys);
        this.scene.beginDirectAnimation(ringFlash, [ringExpandAnimation], 0, 15, false);
        
        // Longer duration for sniper muzzle flash (150ms)
        setTimeout(() => {
            muzzleFlashGroup.dispose();
        }, 150);
    }
    
    createStandardMuzzleFlash(position) {
        // Create standard muzzle flash for other weapons
        const muzzleFlash = BABYLON.MeshBuilder.CreateSphere('muzzleFlash', {
            diameter: 0.8
        }, this.scene);
        
        // Position relative to weapon so it moves with the weapon
        if (this.weapon && this.currentWeaponConfig) {
            // Parent to weapon but use the calculated world position converted to local space
            muzzleFlash.parent = this.weapon;
            
            // Convert world position to local weapon space
            const weaponMatrix = this.weapon.getWorldMatrix();
            const localPosition = BABYLON.Vector3.TransformCoordinates(position, weaponMatrix.invert());
            muzzleFlash.position = localPosition;
        } else {
            // Fallback to world position if no weapon
            muzzleFlash.position = position;
        }
        
        muzzleFlash.material = new BABYLON.StandardMaterial('muzzleFlashMat', this.scene);
        muzzleFlash.material.emissiveColor = new BABYLON.Color3(1, 0.6, 0);
        muzzleFlash.material.diffuseColor = new BABYLON.Color3(1, 0.8, 0.2);
        muzzleFlash.material.specularColor = new BABYLON.Color3(1, 1, 0.5);
        muzzleFlash.material.emissiveIntensity = 2.0;
        
        muzzleFlash.isPickable = false;
        muzzleFlash.checkCollisions = false;
        
        // Standard duration (50ms)
        setTimeout(() => {
            muzzleFlash.dispose();
        }, 50);
    }
    
    addWeaponRecoil() {
        if (!this.weapon || !this.weaponRestPosition || !this.currentWeaponConfig) return;
        
        // Don't block shooting - allow overlapping recoil animations
        // Stop any existing animations to start fresh
        this.scene.stopAnimation(this.weapon);
        
        // Calculate recoil position using weapon config
        const recoilConfig = this.currentWeaponConfig.recoil;
        const recoilPosition = this.weaponRestPosition.clone();
        recoilPosition.x += recoilConfig.intensity.x;
        recoilPosition.y += recoilConfig.intensity.y;
        recoilPosition.z -= recoilConfig.intensity.z; // Move back
        
        const recoilRotation = this.weaponRestRotation.clone();
        recoilRotation.x += recoilConfig.intensity.x; // Tilt up
        
        // Create keyframes for snappy recoil animation
        const frames = recoilConfig.duration;
        const positionKeys = [
            { frame: 0, value: this.weapon.position.clone() }, // Start from current position
            { frame: 1, value: recoilPosition }, // Very quick recoil
            { frame: frames, value: this.weaponRestPosition.clone() } // Quick return
        ];
        
        const rotationKeys = [
            { frame: 0, value: this.weapon.rotation.clone() }, // Start from current rotation
            { frame: 1, value: recoilRotation }, // Very quick recoil
            { frame: frames, value: this.weaponRestRotation.clone() } // Quick return
        ];
        
        // Create position animation with easing
        const positionAnimation = new BABYLON.Animation(
            'weaponRecoilPosition',
            'position',
            60, // 60 fps
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        positionAnimation.setKeys(positionKeys);
        
        // Add easing for more natural feel
        const easingFunction = new BABYLON.QuadraticEase();
        easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
        positionAnimation.setEasingFunction(easingFunction);
        
        // Create rotation animation with easing
        const rotationAnimation = new BABYLON.Animation(
            'weaponRecoilRotation',
            'rotation',
            60,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        rotationAnimation.setKeys(rotationKeys);
        rotationAnimation.setEasingFunction(easingFunction);
        
        // Play animations
        const animationGroup = new BABYLON.AnimationGroup('recoilGroup');
        animationGroup.addTargetedAnimation(positionAnimation, this.weapon);
        animationGroup.addTargetedAnimation(rotationAnimation, this.weapon);
        
        // Ensure weapon returns to rest position when animation completes
        animationGroup.onAnimationGroupEndObservable.add(() => {
            this.weapon.position = this.weaponRestPosition.clone();
            this.weapon.rotation = this.weaponRestRotation.clone();
        });
        
        animationGroup.play(false); // Play once, don't loop
    }
    

    
    updateNetworking() {
        // Send position updates to server at regular intervals
        if (this.game.networkManager) {
            this.game.networkManager.sendPlayerUpdate(this.position, this.rotation);
        }
    }
    
    takeDamage(damage) {
        if (!this.alive) return;
        
        // Play damage sound effect
        if (this.game.audioManager) {
            this.game.audioManager.playDamageSound();
        }
        
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
        
        // Update UI
        if (this.game.uiManager) {
            this.game.uiManager.updateHealth(this.health);
        }
    }
    
    die() {
        this.alive = false;
        console.log('Player died');
        
        // Stop walking sound when player dies
        if (this.game.audioManager) {
            this.game.audioManager.stopWalkingSound();
            this.game.audioManager.playDamageSound();
        }
        
        // Show death screen
        if (this.game.uiManager) {
            this.game.uiManager.showDeathScreen();
        }
    }
    
    respawn(position) {
        this.position = position.clone();
        this.camera.position = this.position.clone();
        this.camera.position.y += this.eyeHeight; // Maintain proper eye height
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.health = 100;
        this.alive = true;
        
        console.log('Player respawned at', position);
        
        // Re-attach weapon if it got disconnected
        if (this.weapon && !this.weapon.parent) {
            this.weapon.parent = this.camera;
        }
        
        // Update UI
        if (this.game.uiManager) {
            this.game.uiManager.hideDeathScreen();
            this.game.uiManager.updateHealth(this.health);
        }
    }
    
    triggerDeathAnimation() {
        console.log(`Death animation triggered for player ${this.id}`);
        
        // Play OOF sound
        if (this.game.audioManager) {
            this.game.audioManager.playDamageSound();
        }
        
        // Start death animation
        this.deathAnimationPlaying = true;
        this.deathStartTime = Date.now();
        
        // Set upward velocity (very fast flying upward)
        this.deathVelocity = new BABYLON.Vector3(
            (Math.random() - 0.5) * 6, // Random horizontal velocity (-3 to 3)
            550, // Much faster upward velocity
            (Math.random() - 0.5) * 6  // Random horizontal velocity (-3 to 3)0
        );
        
        // Set random rotation velocities for spinning effect
        this.deathRotationVelocity = new BABYLON.Vector3(
            (Math.random() - 0.5) * 10, // Random X rotation
            (Math.random() - 0.5) * 10, // Random Y rotation
            (Math.random() - 0.5) * 10  // Random Z rotation
        );
        
        // Make sure mesh is visible during death animation
        if (this.mesh) {
            this.mesh.setEnabled(true);
        }
        if (this.nameTag) {
            this.nameTag.setEnabled(false); // Hide name tag during death
        }
    }
    
    updateDeathAnimation(deltaTime) {
        const elapsedTime = Date.now() - this.deathStartTime;
        
        // Check if animation should end
        if (elapsedTime >= this.deathDuration) {
            this.deathAnimationPlaying = false;
            
            // Hide mesh after animation
            if (this.mesh) {
                this.mesh.setEnabled(false);
            }
            if (this.nameTag) {
                this.nameTag.setEnabled(false);
            }
            return;
        }
        
        // Apply gravity to death velocity
        const gravity = -9.81 * 2; // Double gravity for more dramatic effect
        this.deathVelocity.y += gravity * deltaTime;
        
        // Update position based on death velocity
        this.position.x += this.deathVelocity.x * deltaTime;
        this.position.y += this.deathVelocity.y * deltaTime;
        this.position.z += this.deathVelocity.z * deltaTime;
        
        // Update rotation based on death rotation velocity
        this.rotation.x += this.deathRotationVelocity.x * deltaTime;
        this.rotation.y += this.deathRotationVelocity.y * deltaTime;
        this.rotation.z += this.deathRotationVelocity.z * deltaTime;
        
        // Update mesh position and rotation
        if (this.mesh) {
            this.mesh.position = this.position;
            // During death animation, allow full rotation (not just Y-axis)
            this.mesh.rotation = this.rotation;
        }
    }
    
    dispose() {
        // Clean up weapon meshes
        if (this.weaponMeshes) {
            this.weaponMeshes.forEach(mesh => {
                if (mesh) mesh.dispose();
            });
        }
        if (this.weapon) {
            this.weapon.dispose();
        }
    }
    
    // Handle pointer lock state changes
    onPointerLockChange(isLocked) {
        this.isPointerLocked = isLocked;
        
        if (isLocked) {
            // Just gained pointer lock, set flag to prevent immediate shooting
            this.justGainedPointerLock = true;
            
            // Initialize camera rotation targets to current camera rotation
            this.cameraRotationTarget.x = this.camera.rotation.x;
            this.cameraRotationTarget.y = this.camera.rotation.y;
            this.cameraRotationTarget.z = this.camera.rotation.z;
            
            // Clear mouse accumulation to prevent sudden jumps
            this.mouseAccumulation.x = 0;
            this.mouseAccumulation.y = 0;
            
            // Clear the flag after a short delay
            setTimeout(() => {
                this.justGainedPointerLock = false;
            }, 100);
        } else {
            // Lost pointer lock, clear any accumulated mouse movement
            this.mouseAccumulation.x = 0;
            this.mouseAccumulation.y = 0;
        }
    }
}

// Remote Player class for other players in the game
class RemotePlayer {
    constructor(game, playerData) {
        this.game = game;
        this.scene = game.scene;
        this.id = playerData.id;
        
        // Player state
        this.position = new BABYLON.Vector3(
            playerData.position.x, 
            playerData.position.y, 
            playerData.position.z
        );
        this.rotation = new BABYLON.Vector3(
            playerData.rotation.x, 
            playerData.rotation.y, 
            playerData.rotation.z
        );
        this.health = playerData.health;
        this.alive = playerData.alive;
        
        // Interpolation
        this.targetPosition = this.position.clone();
        this.targetRotation = this.rotation.clone();
        
        // Character properties
        this.characterConfig = window.RupolCharacterConfig || null;
        this.characterMeshes = [];
        this.characterContainer = null;
        
        // Death animation properties
        this.deathAnimationPlaying = false;
        this.deathVelocity = new BABYLON.Vector3(0, 0, 0);
        this.deathRotationVelocity = new BABYLON.Vector3(0, 0, 0);
        this.deathStartTime = 0;
        this.deathDuration = 3000; // 3 seconds of flying
        
        this.createMesh();
    }
    
    async createMesh() {
        try {
            if (this.characterConfig) {
                // Load rupol character model
                const assetLoader = new AssetLoader(this.scene);
                const result = await assetLoader.loadModel(
                    `character_${this.id}`,
                    this.characterConfig.model.folder,
                    this.characterConfig.model.file
                );
                
                if (result.meshes && result.meshes.length > 0) {
                    // Create container for the character
                    this.characterContainer = new BABYLON.TransformNode(`playerContainer_${this.id}`, this.scene);
                    this.characterContainer.position = this.position;
                    
                    // Store character meshes
                    this.characterMeshes = result.meshes;
                    
                    // Parent all meshes to the container
                    this.characterMeshes.forEach((mesh, index) => {
                        if (mesh) {
                            mesh.parent = this.characterContainer;
                            
                            // Configure the mesh
                            mesh.isPickable = true; // Allow bullet collision
                            mesh.checkCollisions = false; // Don't interfere with player movement
                            mesh.metadata = { 
                                isPlayerMesh: true, 
                                playerId: this.id,
                                meshIndex: index 
                            };
                            
                            console.log(`Character mesh ${index} for player ${this.id}: ${mesh.name}`);
                        }
                    });
                    
                    // Apply character configuration
                    this.characterContainer.scaling = new BABYLON.Vector3(
                        this.characterConfig.model.scale.x,
                        this.characterConfig.model.scale.y,
                        this.characterConfig.model.scale.z
                    );
                    
                    this.characterContainer.rotation = new BABYLON.Vector3(
                        this.characterConfig.model.rotation.x,
                        this.characterConfig.model.rotation.y,
                        this.characterConfig.model.rotation.z
                    );
                    
                    // Set the main mesh reference for collision detection
                    this.mesh = this.characterContainer;
                    
                    console.log(`Rupol character loaded for player ${this.id}`);
                } else {
                    console.warn(`No meshes found in character model for player ${this.id}, falling back to capsule`);
                    this.createFallbackMesh();
                }
            } else {
                console.warn(`No character config available, falling back to capsule for player ${this.id}`);
                this.createFallbackMesh();
            }
        } catch (error) {
            console.error(`Failed to load character model for player ${this.id}:`, error);
            this.createFallbackMesh();
        }
        
        // Add name tag
        this.createNameTag();
    }
    
    createFallbackMesh() {
        // Create a simple capsule as fallback
        this.mesh = BABYLON.MeshBuilder.CreateCapsule(`player_${this.id}`, {
            radius: 0.5,
            height: 2
        }, this.scene);
        
        this.mesh.position = this.position;
        
        // Player material
        const material = new BABYLON.StandardMaterial(`playerMat_${this.id}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8);
        material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        this.mesh.material = material;
        
        // Configure for collision
        this.mesh.isPickable = true;
        this.mesh.checkCollisions = false;
        this.mesh.metadata = { 
            isPlayerMesh: true, 
            playerId: this.id 
        };
    }
    
    createNameTag() {
        // Create a simple name display above the player
        const nameTag = BABYLON.MeshBuilder.CreatePlane(`nameTag_${this.id}`, {
            width: 2,
            height: 0.5
        }, this.scene);
        
        // Use character config for name tag positioning if available
        const nameTagOffset = this.characterConfig ? 
            new BABYLON.Vector3(
                this.characterConfig.nameTagOffset.x,
                this.characterConfig.nameTagOffset.y,
                this.characterConfig.nameTagOffset.z
            ) : 
            new BABYLON.Vector3(0, 2.5, 0);
            
        nameTag.position = this.position.add(nameTagOffset);
        nameTag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        
        // Name tag material with text (simplified)
        const material = new BABYLON.StandardMaterial(`nameTagMat_${this.id}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(1, 1, 1);
        material.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        nameTag.material = material;
        
        // Make name tag non-collidable
        nameTag.isPickable = false;
        nameTag.checkCollisions = false;
        
        this.nameTag = nameTag;
    }
    
    update(deltaTime) {
        // Handle death animation
        if (this.deathAnimationPlaying) {
            this.updateDeathAnimation(deltaTime);
            return;
        }
        
        if (!this.alive) return;
        
        // Smooth interpolation to target position
        this.position = BABYLON.Vector3.Lerp(this.position, this.targetPosition, deltaTime * 10);
        this.rotation = BABYLON.Vector3.Lerp(this.rotation, this.targetRotation, deltaTime * 10);
        
        // Update mesh position (character container or fallback mesh)
        if (this.mesh) {
            this.mesh.position = this.position;
            
            // For character models, only rotate around Y-axis (horizontal rotation only)
            if (this.characterConfig) {
                this.mesh.rotation = new BABYLON.Vector3(0, this.rotation.y, 0);
            } else {
                // Fallback mesh can rotate normally
                this.mesh.rotation = this.rotation;
            }
        }
        
        // Update name tag position
        if (this.nameTag) {
            const nameTagOffset = this.characterConfig ? 
                new BABYLON.Vector3(
                    this.characterConfig.nameTagOffset.x,
                    this.characterConfig.nameTagOffset.y,
                    this.characterConfig.nameTagOffset.z
                ) : 
                new BABYLON.Vector3(0, 2.5, 0);
                
            this.nameTag.position = this.position.add(nameTagOffset);
        }
    }
    
    updateFromServer(playerData) {
        this.targetPosition = new BABYLON.Vector3(
            playerData.position.x, 
            playerData.position.y, 
            playerData.position.z
        );
        this.targetRotation = new BABYLON.Vector3(
            playerData.rotation.x, 
            playerData.rotation.y, 
            playerData.rotation.z
        );
        this.health = playerData.health;
        
        // Check if player just died
        const wasAlive = this.alive;
        const nowAlive = playerData.alive;
        
        this.alive = playerData.alive;
        
        // If player just died, trigger death animation
        if (wasAlive && !nowAlive) {
            this.triggerDeathAnimation();
        }
        
        // Update visibility based on alive state (unless death animation is playing)
        if (!this.deathAnimationPlaying) {
            if (this.mesh) {
                this.mesh.setEnabled(this.alive);
            }
            if (this.nameTag) {
                this.nameTag.setEnabled(this.alive);
            }
        }
    }
    
    triggerDeathAnimation() {
        console.log(`Death animation triggered for remote player ${this.id}`);
        
        // Play OOF sound
        if (this.game.audioManager) {
            this.game.audioManager.playDamageSound();
        }
        
        // Start death animation
        this.deathAnimationPlaying = true;
        this.deathStartTime = Date.now();
        
        // Set upward velocity (very fast flying upward)
        this.deathVelocity = new BABYLON.Vector3(
            (Math.random() - 0.5) * 6, // Random horizontal velocity (-3 to 3)
            550, // Much faster upward velocity
            (Math.random() - 0.5) * 6  // Random horizontal velocity (-3 to 3)
        );
        
        // Set random rotation velocities for spinning effect
        this.deathRotationVelocity = new BABYLON.Vector3(
            (Math.random() - 0.5) * 10, // Random X rotation
            (Math.random() - 0.5) * 10, // Random Y rotation
            (Math.random() - 0.5) * 10  // Random Z rotation
        );
        
        // Make sure mesh is visible during death animation
        if (this.mesh) {
            this.mesh.setEnabled(true);
        }
        if (this.nameTag) {
            this.nameTag.setEnabled(false); // Hide name tag during death
        }
    }
    
    updateDeathAnimation(deltaTime) {
        const elapsedTime = Date.now() - this.deathStartTime;
        
        // Check if animation should end
        if (elapsedTime >= this.deathDuration) {
            this.deathAnimationPlaying = false;
            
            // Hide mesh after animation
            if (this.mesh) {
                this.mesh.setEnabled(false);
            }
            if (this.nameTag) {
                this.nameTag.setEnabled(false);
            }
            return;
        }
        
        // Apply gravity to death velocity
        const gravity = -9.81 * 2; // Double gravity for more dramatic effect
        this.deathVelocity.y += gravity * deltaTime;
        
        // Update position based on death velocity
        this.position.x += this.deathVelocity.x * deltaTime;
        this.position.y += this.deathVelocity.y * deltaTime;
        this.position.z += this.deathVelocity.z * deltaTime;
        
        // Update rotation based on death rotation velocity
        this.rotation.x += this.deathRotationVelocity.x * deltaTime;
        this.rotation.y += this.deathRotationVelocity.y * deltaTime;
        this.rotation.z += this.deathRotationVelocity.z * deltaTime;
        
        // Update mesh position and rotation
        if (this.mesh) {
            this.mesh.position = this.position;
            // During death animation, allow full rotation (not just Y-axis)
            this.mesh.rotation = this.rotation;
        }
    }
    
    dispose() {
        // Clean up character meshes
        if (this.characterMeshes) {
            this.characterMeshes.forEach(mesh => {
                if (mesh) mesh.dispose();
            });
        }
        
        // Clean up character container
        if (this.characterContainer) {
            this.characterContainer.dispose();
        }
        
        // Clean up main mesh (fallback or container reference)
        if (this.mesh && this.mesh !== this.characterContainer) {
            this.mesh.dispose();
        }
        
        // Clean up name tag
        if (this.nameTag) {
            this.nameTag.dispose();
        }
    }
} 