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
        
        // Debug player position
        console.log(`PLAYER SPAWNED at position: ${this.position.toString()}`);
        
        this.setupControls();
        this.initWeapon();
    }
    
    async initWeapon() {
        try {
            // Set current weapon config
            this.currentWeaponConfig = window.BulldogConfig;
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
        
        // Create weapon parent for positioning
        this.weapon = new BABYLON.TransformNode('weaponParent', this.scene);
        
        // Attach all weapon meshes to the weapon parent
        this.weaponMeshes.forEach((mesh, index) => {
            mesh.parent = this.weapon;
            mesh.setEnabled(true);
        });
        
        // Position weapon using config
        const config = this.currentWeaponConfig.model;
        this.weapon.position = new BABYLON.Vector3(config.position.x, config.position.y, config.position.z);
        this.weapon.rotation = new BABYLON.Vector3(config.rotation.x, config.rotation.y, config.rotation.z);
        this.weapon.scaling = new BABYLON.Vector3(config.scale.x, config.scale.y, config.scale.z);
        
        // Store the rest position and rotation for recoil animations
        this.weaponRestPosition = this.weapon.position.clone();
        this.weaponRestRotation = this.weapon.rotation.clone();
        
        // Parent weapon to camera so it follows camera movement
        this.weapon.parent = this.camera;
        
        // Make sure weapon renders on top and doesn't interfere with raycasting
        this.weaponMeshes.forEach((mesh) => {
            mesh.renderingGroupId = 1; // Render after scene
            mesh.isPickable = false; // Don't interfere with shooting raycasts
            mesh.checkCollisions = false; // Also disable physics collisions
            mesh.metadata = { isWeapon: true }; // Add weapon tag for filtering
        });
        
        console.log(`${this.currentWeaponConfig.name} attachment complete`);
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
        this.updateNetworking();
    }
    
    updateMovement(deltaTime) {
        const moveVector = new BABYLON.Vector3(0, 0, 0);
        
        // Calculate movement direction based on camera rotation
        const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
        const right = this.camera.getDirection(BABYLON.Vector3.Right());
        
        // Flatten forward and right vectors (remove Y component for ground movement)
        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();
        
        // Apply movement inputs
        if (this.keys.forward) {
            moveVector.addInPlace(forward);
        }
        if (this.keys.backward) {
            moveVector.subtractInPlace(forward);
        }
        if (this.keys.left) {
            moveVector.subtractInPlace(right);
        }
        if (this.keys.right) {
            moveVector.addInPlace(right);
        }
        
        // Apply speed with diagonal movement reduction and sprint functionality
        if (moveVector.length() > 0) {
            // Check if moving diagonally (more than one direction key pressed)
            const isDiagonal = (this.keys.forward || this.keys.backward) && (this.keys.left || this.keys.right);
            
            // Determine base speed (sprint or normal)
            const baseSpeed = this.keys.sprint ? this.sprintSpeed : this.speed;
            
            // Apply diagonal speed reduction (2/3 of normal speed)
            const finalSpeed = isDiagonal ? baseSpeed * (2/3) : baseSpeed;
            
            moveVector.normalize();
            moveVector.scaleInPlace(finalSpeed);
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
    
    updateShooting(deltaTime) {
        if (!this.currentWeaponConfig) return;
        
        const currentTime = Date.now() / 1000;
        const cooldownTime = 60 / this.currentWeaponConfig.fireRate; // Convert RPM to seconds
        
        if (this.keys.shoot && this.canShoot && this.isPointerLocked && !this.justGainedPointerLock && (currentTime - this.lastShotTime) >= cooldownTime) {
            this.shoot();
            this.lastShotTime = currentTime;
        }
    }
    
    shoot() {
        // Calculate barrel position and direction
        const { origin, direction } = this.getBarrelPositionAndDirection();
        
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
        // Create a muzzle flash effect
        const muzzleFlash = BABYLON.MeshBuilder.CreateSphere('muzzleFlash', {
            diameter: 0.8 // Bigger for more dramatic muzzle flash effect
        }, this.scene);
        
        // If we have a weapon, attach the muzzle flash to it so it moves with the gun
        if (this.weapon && this.currentWeaponConfig) {
            // Parent the muzzle flash to the weapon so it moves with it
            muzzleFlash.parent = this.weapon;
            
            // Set position relative to weapon using barrel offset
            const config = this.currentWeaponConfig.barrel;
            muzzleFlash.position = new BABYLON.Vector3(
                config.offset.x - .7, // Shift left from player perspective
                config.offset.y + .2, // Shift left from player perspective
                config.offset.z + config.rayOffset // Position at the end of the barrel
            );
        } else {
            // Fallback to world position if no weapon
            muzzleFlash.position = position;
        }
        
        muzzleFlash.material = new BABYLON.StandardMaterial('muzzleFlashMat', this.scene);
        
        // Bright orange/yellow muzzle flash colors
        muzzleFlash.material.emissiveColor = new BABYLON.Color3(1, 0.6, 0); // Bright orange glow
        muzzleFlash.material.diffuseColor = new BABYLON.Color3(1, 0.8, 0.2); // Yellow-orange
        muzzleFlash.material.specularColor = new BABYLON.Color3(1, 1, 0.5); // Bright specular highlight
        
        // Make it very bright and glowing
        muzzleFlash.material.emissiveIntensity = 2.0;
        
        // Make it non-collidable
        muzzleFlash.isPickable = false;
        muzzleFlash.checkCollisions = false;
        
        // Very brief duration like a real muzzle flash (50ms)
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
        
        this.createMesh();
    }
    
    createMesh() {
        // Create a simple capsule to represent the player
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
        
        // Add name tag (optional)
        this.createNameTag();
    }
    
    createNameTag() {
        // Create a simple name display above the player
        const nameTag = BABYLON.MeshBuilder.CreatePlane(`nameTag_${this.id}`, {
            width: 2,
            height: 0.5
        }, this.scene);
        
        nameTag.position = this.position.add(new BABYLON.Vector3(0, 2.5, 0));
        nameTag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        
        // Name tag material with text (simplified)
        const material = new BABYLON.StandardMaterial(`nameTagMat_${this.id}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(1, 1, 1);
        material.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        nameTag.material = material;
        
        this.nameTag = nameTag;
    }
    
    update(deltaTime) {
        if (!this.alive) return;
        
        // Smooth interpolation to target position
        this.position = BABYLON.Vector3.Lerp(this.position, this.targetPosition, deltaTime * 10);
        this.rotation = BABYLON.Vector3.Lerp(this.rotation, this.targetRotation, deltaTime * 10);
        
        // Update mesh position
        if (this.mesh) {
            this.mesh.position = this.position;
            this.mesh.rotation = this.rotation;
        }
        
        // Update name tag position
        if (this.nameTag) {
            this.nameTag.position = this.position.add(new BABYLON.Vector3(0, 2.5, 0));
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
        this.alive = playerData.alive;
        
        // Update visibility based on alive state
        if (this.mesh) {
            this.mesh.setEnabled(this.alive);
        }
        if (this.nameTag) {
            this.nameTag.setEnabled(this.alive);
        }
    }
    
    dispose() {
        if (this.mesh) {
            this.mesh.dispose();
        }
        if (this.nameTag) {
            this.nameTag.dispose();
        }
    }
} 