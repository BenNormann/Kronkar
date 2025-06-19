class Player {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.camera = game.camera;
        
        // Player state
        this.position = new BABYLON.Vector3(0, 2, 0);
        this.rotation = new BABYLON.Vector3(0, 0, 0);
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.health = 100;
        this.alive = true;
        
        // Movement settings
        this.speed = 8;
        this.jumpForce = 8;
        this.mouseSensitivity = 0.002;
        this.isGrounded = false;
        this.gravity = -20;
        
        // Shooting
        this.canShoot = true;
        this.shootCooldown = 0.1; // seconds between shots
        this.lastShotTime = 0;
        
        // Pointer lock state
        this.isPointerLocked = false;
        this.justGainedPointerLock = false;
        
        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            shoot: false
        };
        
        this.mouseMovement = { x: 0, y: 0 };
        
        this.setupControls();
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
            }
        });
        
        // Mouse input
        document.addEventListener('mousemove', (event) => {
            if (this.isPointerLocked) {
                this.mouseMovement.x = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
                this.mouseMovement.y = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
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
        
        // Normalize and apply speed
        if (moveVector.length() > 0) {
            moveVector.normalize();
            moveVector.scaleInPlace(this.speed);
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
        
        // Update position
        const newPosition = this.position.add(this.velocity.scale(deltaTime));
        
        // Simple collision detection with ground
        if (newPosition.y <= 2) {
            newPosition.y = 2;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
        
        // Check collision with scene (basic implementation)
        this.position = newPosition;
        this.camera.position = this.position;
        
        // Update rotation for networking
        this.rotation.x = this.camera.rotation.x;
        this.rotation.y = this.camera.rotation.y;
        this.rotation.z = this.camera.rotation.z;
    }
    
    updateCamera(deltaTime) {
        if (this.isPointerLocked) {
            // Apply mouse movement to camera rotation
            this.camera.rotation.y += this.mouseMovement.x * this.mouseSensitivity;
            this.camera.rotation.x += this.mouseMovement.y * this.mouseSensitivity;
            
            // Clamp vertical rotation
            this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
            
            // Reset mouse movement
            this.mouseMovement.x = 0;
            this.mouseMovement.y = 0;
        }
    }
    
    updateShooting(deltaTime) {
        const currentTime = Date.now() / 1000;
        
        if (this.keys.shoot && this.canShoot && this.isPointerLocked && !this.justGainedPointerLock && (currentTime - this.lastShotTime) >= this.shootCooldown) {
            this.shoot();
            this.lastShotTime = currentTime;
        }
    }
    
    shoot() {
        // Get shooting ray from camera
        const origin = this.camera.position.clone();
        const direction = this.camera.getDirection(BABYLON.Vector3.Forward());
        
        // Create visual bullet trail
        this.game.createBulletTrail(origin, direction);
        
        // Perform raycast for hit detection
        const ray = new BABYLON.Ray(origin, direction);
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            // Filter out bullets and UI elements
            return mesh.name !== 'bullet' && !mesh.name.startsWith('ui_');
        });
        
        // Send shoot event to server
        if (this.game.networkManager) {
            this.game.networkManager.sendShoot(origin, direction);
        }
        
        // Handle local hit effects (visual only, server handles actual damage)
        if (hit.hit) {
            this.createHitEffect(hit.pickedPoint);
        }
    }
    
    createHitEffect(position) {
        // Create a simple hit effect
        const hitEffect = BABYLON.MeshBuilder.CreateSphere('hitEffect', {
            diameter: 0.5
        }, this.scene);
        
        hitEffect.position = position;
        
        // Hit effect material
        const material = new BABYLON.StandardMaterial('hitEffectMat', this.scene);
        material.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
        hitEffect.material = material;
        
        // Animate and dispose
        setTimeout(() => {
            hitEffect.dispose();
        }, 200);
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
        this.camera.position = this.position;
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.health = 100;
        this.alive = true;
        
        console.log('Player respawned at', position);
        
        // Update UI
        if (this.game.uiManager) {
            this.game.uiManager.hideDeathScreen();
            this.game.uiManager.updateHealth(this.health);
        }
    }
    
    // Handle pointer lock state changes
    onPointerLockChange(isLocked) {
        this.isPointerLocked = isLocked;
        
        if (isLocked) {
            // Just gained pointer lock, set flag to prevent immediate shooting
            this.justGainedPointerLock = true;
            
            // Clear the flag after a short delay
            setTimeout(() => {
                this.justGainedPointerLock = false;
            }, 100);
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