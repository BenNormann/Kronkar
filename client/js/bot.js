class BotPlayer extends RemotePlayer {
    constructor(game, botId) {
        // Create bot data similar to remote player data
        const botData = {
            id: botId,
            position: game.getSpawnPosition(),
            rotation: { x: 0, y: 0, z: 0 },
            health: 100,
            alive: true,
            score: 0,
            username: BotPlayer.generateRandomName()
        };
        
        // Call parent constructor (RemotePlayer) with bot data
        super(game, botData);
        
        // Mark as bot
        this.isBot = true;
        
        // Copy EXACT movement properties from Player class
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.speed = 150;
        this.horizontalSpeed = 75;
        this.sprintSpeed = 225;
        this.sprintMultiplier = 1.5;
        this.gravity = -200;
        this.isGrounded = false;
        this.jumpForce = 70;
        this.eyeHeight = 16; // Same as Player
        this.isMoving = false;
        this.wasMoving = false;
        
        // Create a camera for the bot (needed for Player-like movement calculations)
        this.camera = new BABYLON.FreeCamera(`botCamera_${this.id}`, this.position.clone(), this.scene);
        this.camera.minZ = 0.01;
        this.camera.maxZ = 1000;
        this.camera.position = this.position.clone();
        this.camera.position.y += this.eyeHeight;
        
        // Score tracking
        this.score = 0;
        
        // AI input simulation (like a real player)
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            shoot: false,
            sprint: false
        };
        
        // AI behavior properties
        this.lastDirectionChange = 0;
        this.directionChangeInterval = 3000; // Change direction every 3 seconds
        this.lastJumpTime = 0;
        this.jumpCooldown = 2000; // Jump every 2 seconds max
        
        // Shooting properties
        this.lastShootTime = 0;
        this.shootCooldown = 1000; // Shoot every 1 second when targeting
        this.shootChance = 0.8; // 80% chance to shoot when has target
        this.currentWeaponConfig = window.BulldogConfig; // Default to Bulldog
        
        // Targeting properties
        this.currentTarget = null;
        this.lastTargetCheck = 0;
        this.targetCheckInterval = 1000; // Check for new targets every 1 second
        this.maxTargetDistance = 100; // Maximum targeting range
        this.targetLostTime = 0;
        this.maxTargetLostTime = 2000; // Switch targets if lost for 2 seconds
        
        console.log(`BotPlayer ${this.id} (${this.username}) created - alive: ${this.alive}, position:`, this.position);
        
        // Ensure bot can be hit by bullets - add collision metadata to character meshes
        this.setupBotCollision();
    }
    
    // Setup collision detection for the bot
    setupBotCollision() {
        // Wait a bit for the character mesh to be created, then set up collision
        setTimeout(() => {
            if (this.characterMeshes && this.characterMeshes.length > 0) {
                this.characterMeshes.forEach(mesh => {
                    if (mesh) {
                        mesh.metadata = mesh.metadata || {};
                        mesh.metadata.isPlayerMesh = true;
                        mesh.metadata.playerId = this.id;
                        mesh.isPickable = true; // Allow bullets to hit
                        console.log(`Set up collision for bot mesh: ${mesh.name}`);
                    }
                });
            } else if (this.mesh) {
                // Fallback to main mesh if character meshes not available
                this.mesh.metadata = this.mesh.metadata || {};
                this.mesh.metadata.isPlayerMesh = true;
                this.mesh.metadata.playerId = this.id;
                this.mesh.isPickable = true;
                console.log(`Set up collision for bot main mesh: ${this.mesh.name}`);
            }
        }, 1000); // Give time for mesh creation
    }
    
    // Main update method - combines RemotePlayer functionality with bot movement
    update(deltaTime) {
        if (!this.alive) {
            super.update(deltaTime);
            return;
        }
        
        // Update AI input simulation
        this.updateAIInputs(deltaTime);
        
        // Apply Player-like movement using simulated keys
        this.updateBotMovement(deltaTime);
        
        // Call parent update for mesh positioning and other RemotePlayer functionality
        super.update(deltaTime);
    }
    
    // AI input simulation - randomly press keys like a human would
    updateAIInputs(deltaTime) {
        const currentTime = performance.now();
        
        // Update targeting system
        this.updateTargeting(currentTime);
        
        // Change direction periodically (less often when targeting)
        const directionInterval = this.currentTarget ? 
            this.directionChangeInterval * 2 : // Move less when focusing on target
            this.directionChangeInterval;
            
        if (currentTime - this.lastDirectionChange > directionInterval) {
            this.generateRandomInputs();
            this.lastDirectionChange = currentTime;
        }
        
        // Random jumping
        if (currentTime - this.lastJumpTime > this.jumpCooldown && Math.random() < 0.1) {
            this.keys.jump = true;
            this.lastJumpTime = currentTime;
        } else {
            this.keys.jump = false;
        }
        
        // Targeted shooting
        if (this.currentTarget && currentTime - this.lastShootTime > this.shootCooldown && Math.random() < this.shootChance) {
            this.shootAtTarget();
            this.lastShootTime = currentTime;
        }
    }
    
    // Generate random key inputs like a human player
    generateRandomInputs() {
        // Reset all movement keys
        this.keys.forward = false;
        this.keys.backward = false;
        this.keys.left = false;
        this.keys.right = false;
        this.keys.sprint = false;
        
        // Choose random movement pattern
        const movementPatterns = [
            // Basic movements
            { forward: true },                              // Move forward
            { backward: true },                             // Move backward  
            { left: true },                                 // Strafe left
            { right: true },                                // Strafe right
            
            // Diagonal movements
            { forward: true, left: true },                  // Forward-left
            { forward: true, right: true },                 // Forward-right
            { backward: true, left: true },                 // Backward-left
            { backward: true, right: true },                // Backward-right
            
            // Sprint patterns
            { forward: true, sprint: true },                // Sprint forward
            { forward: true, left: true, sprint: true },    // Sprint diagonally
            { forward: true, right: true, sprint: true },   // Sprint diagonally
            
            // Stationary (stop moving)
            {},                                             // No movement
        ];
        
        const pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
        
        // Apply the chosen pattern
        Object.assign(this.keys, pattern);
        
        // Only log when movement pattern actually changes (reduce spam)
        const patternKey = JSON.stringify(pattern);
        if (this.lastMovementPattern !== patternKey) {
            console.log(`Bot ${this.username} changed movement pattern`);
            this.lastMovementPattern = patternKey;
        }
    }
    
    // Targeting system
    updateTargeting(currentTime) {
        // Check for new targets periodically
        if (currentTime - this.lastTargetCheck > this.targetCheckInterval) {
            this.checkForTargets();
            this.lastTargetCheck = currentTime;
        }
        
        // Validate current target
        if (this.currentTarget) {
            if (!this.isValidTarget(this.currentTarget)) {
                console.log(`Bot ${this.username} lost target: ${this.currentTarget.username || 'Player'}`);
                this.currentTarget = null;
                this.targetLostTime = 0;
            } else if (!this.canSeeTarget(this.currentTarget)) {
                // Target is blocked, start countdown
                if (this.targetLostTime === 0) {
                    this.targetLostTime = currentTime;
                } else if (currentTime - this.targetLostTime > this.maxTargetLostTime) {
                    console.log(`Bot ${this.username} lost sight of target for too long, switching`);
                    this.currentTarget = null;
                    this.targetLostTime = 0;
                }
            } else {
                // Target is visible, reset lost time
                this.targetLostTime = 0;
                // Aim at target
                this.aimAtTarget(this.currentTarget);
            }
        }
    }
    
    checkForTargets() {
        const potentialTargets = [];
        
        // Add human player as potential target
        if (this.game.player && this.game.player.alive) {
            const distance = BABYLON.Vector3.Distance(this.position, this.game.player.position);
            if (distance <= this.maxTargetDistance && this.canSeeTarget(this.game.player)) {
                potentialTargets.push({
                    target: this.game.player,
                    distance: distance,
                    type: 'player'
                });
            }
        }
        
        // Add remote players as potential targets
        if (this.game.remotePlayers) {
            this.game.remotePlayers.forEach((remotePlayer, playerId) => {
                if (remotePlayer.alive) {
                    const distance = BABYLON.Vector3.Distance(this.position, remotePlayer.position);
                    if (distance <= this.maxTargetDistance && this.canSeeTarget(remotePlayer)) {
                        potentialTargets.push({
                            target: remotePlayer,
                            distance: distance,
                            type: 'remote'
                        });
                    }
                }
            });
        }
        
        // Add other bots as potential targets (bot vs bot combat)
        if (this.game.bots) {
            this.game.bots.forEach((bot, botId) => {
                if (bot !== this && bot.alive) { // Don't target self
                    const distance = BABYLON.Vector3.Distance(this.position, bot.position);
                    if (distance <= this.maxTargetDistance && this.canSeeTarget(bot)) {
                        potentialTargets.push({
                            target: bot,
                            distance: distance,
                            type: 'bot'
                        });
                    }
                }
            });
        }
        
        // Select new target if we don't have one
        if (!this.currentTarget && potentialTargets.length > 0) {
            // Pick a random target from visible ones
            const randomTarget = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
            this.currentTarget = randomTarget.target;
            console.log(`Bot ${this.username} acquired target: ${this.currentTarget.username || 'Player'} (${randomTarget.type}, distance: ${randomTarget.distance.toFixed(1)})`);
        }
    }
    
    isValidTarget(target) {
        // Check if target still exists and is alive
        if (!target || !target.alive) return false;
        
        // Check if target is still in range
        const distance = BABYLON.Vector3.Distance(this.position, target.position);
        return distance <= this.maxTargetDistance;
    }
    
    canSeeTarget(target) {
        if (!target || !this.camera) return false;
        
        // Create ray from bot's camera to target
        const direction = target.position.subtract(this.camera.position).normalize();
        const distance = BABYLON.Vector3.Distance(this.camera.position, target.position);
        
        const ray = new BABYLON.Ray(this.camera.position, direction, distance - 1); // Stop just before target
        
        // Filter to only check environment collisions (not players/bots)
        const meshFilter = (mesh) => {
            return mesh.checkCollisions && 
                   mesh.name !== 'bullet' && 
                   mesh.name !== 'hitEffect' && 
                   !mesh.name.startsWith('ui_') && 
                   (!mesh.metadata || (!mesh.metadata.isPlayerMesh && !mesh.metadata.isWeapon));
        };
        
        const hit = this.scene.pickWithRay(ray, meshFilter);
        
        // If ray hits something before reaching target, line of sight is blocked
        return !hit.hit;
    }
    
    aimAtTarget(target) {
        if (!target || !this.camera) return;
        
        // Calculate direction to target
        const targetDirection = target.position.subtract(this.camera.position).normalize();
        
        // Convert to rotation angles
        const targetRotationY = Math.atan2(targetDirection.x, targetDirection.z);
        const targetRotationX = -Math.asin(targetDirection.y);
        
        // Smoothly rotate camera towards target
        const lerpFactor = 0.02; // Smooth turning speed
        
        // Lerp Y rotation (horizontal)
        this.camera.rotation.y = this.lerpAngle(this.camera.rotation.y, targetRotationY, lerpFactor);
        
        // Lerp X rotation (vertical) 
        this.camera.rotation.x = BABYLON.Scalar.Lerp(this.camera.rotation.x, targetRotationX, lerpFactor);
    }
    
    lerpAngle(current, target, factor) {
        // Handle angle wrapping for smooth rotation
        let diff = target - current;
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        return current + diff * factor;
    }
    
    // Bot shooting method (targeted)
    shootAtTarget() {
        if (!this.alive || !this.camera || !this.currentWeaponConfig || !this.currentTarget) return;
        
        // Calculate shoot origin
        const shootOrigin = this.camera.position.clone();
        
        // Calculate direction to target with some prediction for moving targets
        let targetPosition = this.currentTarget.position.clone();
        
        // Lead target prediction for moving targets
        if (this.currentTarget.velocity) {
            const timeToTarget = BABYLON.Vector3.Distance(shootOrigin, targetPosition) / this.currentWeaponConfig.projectile.velocity;
            targetPosition.addInPlace(this.currentTarget.velocity.scale(timeToTarget * 0.5)); // 50% prediction
        }
        
        let shootDirection = targetPosition.subtract(shootOrigin).normalize();
        
        // Add some random inaccuracy to make bots realistic (not perfect aimbot)
        const inaccuracy = 0.03; // 3% inaccuracy for targeted shots
        shootDirection.x += (Math.random() - 0.5) * inaccuracy;
        shootDirection.y += (Math.random() - 0.5) * inaccuracy;
        shootDirection.z += (Math.random() - 0.5) * inaccuracy;
        shootDirection.normalize();
        
        // Create projectile using game's system
        this.game.createProjectile(shootOrigin, shootDirection, this.id);
        
        // Play weapon sound at bot's position
        if (this.game.audioManager && this.game.player) {
            const listenerPosition = this.game.player.position;
            this.game.audioManager.playRemoteWeaponSound(
                this.currentWeaponConfig,
                listenerPosition,
                this.position
            );
        }
        
        console.log(`Bot ${this.username} shot at target: ${this.currentTarget.username || 'Player'}`);
    }
    
    // Cleanup method to clear target when bot dies
    die() {
        this.currentTarget = null;
        this.targetLostTime = 0;
        
        // Call parent die method
        if (super.die) {
            super.die();
        }
    }
    
    // EXACT copy of Player class updateMovement method
    updateBotMovement(deltaTime) {
        if (!this.keys || !this.alive) return;
        
        // Calculate movement vector
        let moveVector = new BABYLON.Vector3(0, 0, 0);
        
        // Determine movement directions based on current keys
        let forwardBackwardVector = new BABYLON.Vector3(0, 0, 0);
        let leftRightVector = new BABYLON.Vector3(0, 0, 0);
        
        if (this.keys.forward) forwardBackwardVector.z += 1;
        if (this.keys.backward) forwardBackwardVector.z -= 1;
        if (this.keys.left) leftRightVector.x -= 1;
        if (this.keys.right) leftRightVector.x += 1;
        
        // Transform to world space using bot's camera
        forwardBackwardVector = this.camera.getDirection(forwardBackwardVector);
        leftRightVector = this.camera.getDirection(leftRightVector);
        forwardBackwardVector.y = 0;
        leftRightVector.y = 0;
        forwardBackwardVector.normalize();
        leftRightVector.normalize();
        
        // Apply different speeds for forward/backward vs left/right movement
        const sprintMultiplier = this.keys.sprint ? this.sprintMultiplier : 1.0;
        
        // Scale forward/backward movement with full speed
        forwardBackwardVector.scaleInPlace(this.speed * sprintMultiplier);
        
        // Scale left/right movement with horizontal speed
        leftRightVector.scaleInPlace(this.horizontalSpeed * sprintMultiplier);
        
        // Combine movement vectors after applying different speeds
        moveVector = forwardBackwardVector.add(leftRightVector);
        
        // Handle diagonal movement normalization - when moving in two directions
        if (forwardBackwardVector.length() > 0 && leftRightVector.length() > 0) {
            moveVector.scaleInPlace(2/3);
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
        
        // PERFORMANCE OPTIMIZATION: Skip expensive collision checks for minimal movement
        const moveDistance = this.velocity.scale(deltaTime);
        const totalMovement = Math.abs(moveDistance.x) + Math.abs(moveDistance.y) + Math.abs(moveDistance.z);
        
        // If movement is negligible and bot is grounded, skip collision detection
        if (totalMovement < 0.01 && this.isGrounded && Math.abs(this.velocity.y) < 1.0) {
            // Still update positions for minimal movement and camera
            this.position.addInPlace(moveDistance);
            this.camera.position = this.position.clone();
            this.camera.position.y += this.eyeHeight;
            
            // Update target position for RemotePlayer interpolation
            this.targetPosition = this.position.clone();
            this.targetRotation = this.rotation.clone();
            
            this.isMoving = false;
            this.updateWalkingSound();
            return;
        }
        
        // OPTIMIZED COLLISION DETECTION - Reduced raycasts with early exits
        let newPosition = this.position.clone();
        
        // Player collision capsule parameters - EXACT SAME AS PLAYER
        const playerRadius = 1.2; // Player collision radius
        const playerHeight = 3.0; // Player collision height
        const stepHeight = 100.0; // Maximum step height player can walk over
        
        // Cache mesh filter for better performance - EXACT SAME AS PLAYER
        const meshFilter = (mesh) => {
            return mesh.checkCollisions && mesh.name !== 'bullet' && mesh.name !== 'hitEffect' && 
                   !mesh.name.startsWith('ui_') && (!mesh.metadata || !mesh.metadata.isWeapon);
        };
        
        // Step 1: Optimized horizontal movement with fewer sphere checks - EXACT SAME AS PLAYER
        const horizontalDistance = Math.sqrt(moveDistance.x * moveDistance.x + moveDistance.z * moveDistance.z);
        if (horizontalDistance > 0.001) {
            const moveDir = new BABYLON.Vector3(moveDistance.x, 0, moveDistance.z).normalize();
            const targetHorizontalPos = new BABYLON.Vector3(
                this.position.x + moveDistance.x,
                this.position.y,
                this.position.z + moveDistance.z
            );
            
            // Reduced height checks - only check critical levels
            let canMoveHorizontal = true;
            const checkHeights = [1.0, 2.5]; // Bottom and top (removed middle for performance)
            
            for (let height of checkHeights) {
                // Single raycast check for thin walls (more efficient than scene.pick)
                const rayToTarget = new BABYLON.Ray(
                    new BABYLON.Vector3(this.position.x, this.position.y + height, this.position.z),
                    moveDir
                );
                const rayHit = this.scene.pickWithRay(rayToTarget, meshFilter);
                
                if (rayHit.hit && rayHit.distance < horizontalDistance + playerRadius) {
                    canMoveHorizontal = false;
                    break; // Early exit - no need to check remaining heights
                }
            }
            
            if (canMoveHorizontal) {
                // No collision - move normally
                newPosition.x = targetHorizontalPos.x;
                newPosition.z = targetHorizontalPos.z;
            } else {
                // Try wall sliding by testing X and Z movement separately
                let slideMovement = new BABYLON.Vector3(0, 0, 0);
                
                // Test X movement alone (only one height check for performance)
                if (Math.abs(moveDistance.x) > 0.001) {
                    const xRay = new BABYLON.Ray(
                        new BABYLON.Vector3(this.position.x, this.position.y + 1.5, this.position.z),
                        new BABYLON.Vector3(Math.sign(moveDistance.x), 0, 0)
                    );
                    const xHit = this.scene.pickWithRay(xRay, meshFilter);
                    
                    if (!xHit.hit || xHit.distance >= Math.abs(moveDistance.x) + playerRadius) {
                        slideMovement.x = moveDistance.x * 0.9; // Slightly damped sliding
                    }
                }
                
                // Test Z movement alone (only one height check for performance)
                if (Math.abs(moveDistance.z) > 0.001) {
                    const zRay = new BABYLON.Ray(
                        new BABYLON.Vector3(this.position.x, this.position.y + 1.5, this.position.z),
                        new BABYLON.Vector3(0, 0, Math.sign(moveDistance.z))
                    );
                    const zHit = this.scene.pickWithRay(zRay, meshFilter);
                    
                    if (!zHit.hit || zHit.distance >= Math.abs(moveDistance.z) + playerRadius) {
                        slideMovement.z = moveDistance.z * 0.9; // Slightly damped sliding
                    }
                }
                
                // Apply sliding movement
                newPosition.x = this.position.x + slideMovement.x;
                newPosition.z = this.position.z + slideMovement.z;
            }
        }
        
        // Step 2: Optimized ground detection - drastically reduced raycasts - EXACT SAME AS PLAYER
        newPosition.y = this.position.y + moveDistance.y;
        
        // Smart ground check positions - focus on essential points only
        const footLevel = newPosition.y + 0.1;
        const groundCheckPositions = [
            new BABYLON.Vector3(newPosition.x, footLevel, newPosition.z), // Center (most important)
            new BABYLON.Vector3(newPosition.x + 0.8, footLevel, newPosition.z), // Right edge
            new BABYLON.Vector3(newPosition.x - 0.8, footLevel, newPosition.z), // Left edge
            new BABYLON.Vector3(newPosition.x, footLevel, newPosition.z + 0.8), // Forward edge
            new BABYLON.Vector3(newPosition.x, footLevel, newPosition.z - 0.8), // Backward edge
        ];
        
        // Only add stair detection rays when actually moving at reasonable speed
        if (horizontalDistance > 1.0) {
            const moveDir = new BABYLON.Vector3(moveDistance.x, 0, moveDistance.z).normalize();
            const projectionDistance = Math.min(2.0, horizontalDistance * 1.5);
            
            // Reduced stair check heights for performance
            const footRayHeights = [1.0, 2.5]; // Only bottom and top
            for (let height of footRayHeights) {
                const forwardFootPos = this.position.add(moveDir.scale(projectionDistance)).add(new BABYLON.Vector3(0, height, 0));
                groundCheckPositions.push(forwardFootPos);
            }
        }
        
        // Only add anti-glitch rays at critical positions when needed
        if (this.velocity.y < -50) { // Only when falling fast enough to glitch
            const criticalHeights = [0.0]; // Just one height check
            for (let height of criticalHeights) {
                const baseY = footLevel + height;
                // Reduced to 4 directions instead of 8
                const angleStep = Math.PI / 2; // 90 degrees apart
                for (let i = 0; i < 4; i++) {
                    const angle = i * angleStep;
                    const radius = 0.5;
                    const x = newPosition.x + Math.cos(angle) * radius;
                    const z = newPosition.z + Math.sin(angle) * radius;
                    groundCheckPositions.push(new BABYLON.Vector3(x, baseY, z));
                }
            }
        }
        
        let groundHit = null;
        let closestGroundDistance = Infinity;
        
        // Check ground positions with early exit for performance
        for (let checkPos of groundCheckPositions) {
            const groundRay = new BABYLON.Ray(checkPos, new BABYLON.Vector3(0, -1, 0));
            const hit = this.scene.pickWithRay(groundRay, meshFilter);
            
            if (hit.hit && hit.distance < closestGroundDistance) {
                closestGroundDistance = hit.distance;
                groundHit = hit;
                
                // Early exit if we find ground very close (performance optimization)
                if (hit.distance < 1.0) {
                    break;
                }
            }
        }
        
        // Apply ground collision with tighter distance check
        if (groundHit && closestGroundDistance < 5.0) {
            const groundY = groundHit.pickedPoint.y + 2.0;
            if (newPosition.y <= groundY) {
                newPosition.y = groundY;
                this.velocity.y = Math.max(0, this.velocity.y);
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
        
        // Update rotation for networking - EXACT SAME AS PLAYER
        this.rotation.x = this.camera.rotation.x;
        this.rotation.y = this.camera.rotation.y;
        this.rotation.z = this.camera.rotation.z;
        
        // Update target position for RemotePlayer interpolation
        this.targetPosition = this.position.clone();
        this.targetRotation = this.rotation.clone();
        
        // Track movement for walking sound - EXACT SAME AS PLAYER
        this.isMoving = (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) && 
                       this.isGrounded && horizontalDistance > 0.005;
        
        // Update walking sound - EXACT SAME AS PLAYER
        this.updateWalkingSound();
    }
    
    // Add walking sound update method - EXACT SAME AS PLAYER
    updateWalkingSound() {
        // Handle walking sound based on movement state
        if (this.isMoving && !this.wasMoving) {
            // Just started moving - play walking sound with sprint info
            if (this.game.audioManager) {
                this.game.audioManager.playWalkingSound(this.keys.sprint);
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
    
    // Generate random bot name
    static generateRandomName() {
        const names = [
            'Bot_Alpha', 'Bot_Beta', 'Bot_Gamma', 'Bot_Delta', 'Bot_Echo',
            'Bot_Foxtrot', 'Bot_Golf', 'Bot_Hotel', 'Bot_India', 'Bot_Juliet',
            'Rookie', 'Veteran', 'Sniper', 'Scout', 'Heavy', 'Medic',
            'Engineer', 'Assault', 'Support', 'Recon'
        ];
        
        return names[Math.floor(Math.random() * names.length)] + '_' + Math.floor(Math.random() * 1000);
    }
    
    // Use RemotePlayer's takeDamage and die methods - they should work properly
    // Override only to add bot-specific behavior like auto-respawn
    
    takeDamage(damage) {
        console.log(`Bot ${this.username} taking damage: ${damage}, current health: ${this.health}`);
        
        // Call parent takeDamage method
        if (super.takeDamage) {
            super.takeDamage(damage);
        } else {
            // Fallback if parent doesn't have takeDamage
            this.health -= damage;
            if (this.health <= 0) {
                this.die();
            }
        }
        
        console.log(`Bot ${this.username} health after damage: ${this.health}, alive: ${this.alive}`);
    }
    
    die() {
        console.log(`Bot ${this.username} die() called - health: ${this.health}, alive: ${this.alive}`);
        
        // Clear targeting when dying
        this.currentTarget = null;
        this.targetLostTime = 0;
        
        // Call parent die method first
        if (super.die) {
            super.die();
        } else {
            // Fallback if parent doesn't have die method
            this.alive = false;
            this.health = 0;
        }
        
        console.log(`Bot ${this.username} after die() - health: ${this.health}, alive: ${this.alive}`);
        
        // Schedule auto-respawn for bots after 5 seconds
        setTimeout(() => {
            if (!this.alive) {
                console.log(`Bot ${this.username} auto-respawning after 5 seconds`);
                this.respawn();
            }
        }, 5000);
    }
    
    // Respawn handling
    respawn() {
        console.log(`Bot ${this.username} respawning...`);
        
        // Reset health and alive state
        this.health = 100;
        this.alive = true;
        
        // Get new spawn position
        const newPosition = this.game.getSpawnPosition();
        this.position = newPosition.clone();
        this.targetPosition = this.position.clone();
        this.targetRotation = this.rotation.clone();
        
        // Reset camera position
        if (this.camera) {
            this.camera.position = this.position.clone();
            this.camera.position.y += this.eyeHeight;
        }
        
        // Reset targeting
        this.currentTarget = null;
        this.targetLostTime = 0;
        
        // Reset physics
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.isGrounded = false;
        
        // Reset death animation state
        this.deathAnimationPlaying = false;
        this.deathVelocity = new BABYLON.Vector3(0, 0, 0);
        this.deathRotationVelocity = new BABYLON.Vector3(0, 0, 0);
        
        // Ensure mesh visibility is restored
        if (this.mesh) {
            this.mesh.setEnabled(true);
            this.mesh.isVisible = true;
        }
        
        // Restore character mesh visibility  
        if (this.characterMeshes && this.characterMeshes.length > 0) {
            this.characterMeshes.forEach(mesh => {
                if (mesh) {
                    mesh.setEnabled(true);
                    mesh.isVisible = true;
                }
            });
        }
        
        // Restore character container mesh visibility
        if (this.characterContainer) {
            this.characterContainer.setEnabled(true);
            const childMeshes = this.characterContainer.getChildMeshes();
            childMeshes.forEach(mesh => {
                if (mesh) {
                    mesh.setEnabled(true);
                    mesh.isVisible = true;
                }
            });
        }
        
        // Call parent respawn if it exists
        if (super.respawn && typeof super.respawn === 'function') {
            super.respawn(newPosition);
        }
        
        // Update leaderboard
        if (this.game.uiManager) {
            this.game.uiManager.updateLeaderboard();
        }
        
        console.log(`Bot ${this.username} respawned at: ${newPosition.toString()}`);
    }
    
    // Clean disposal
    dispose() {
        // Dispose of the bot's camera
        if (this.camera) {
            this.camera.dispose();
            this.camera = null;
        }
        
        console.log(`BotPlayer ${this.id} disposed`);
        super.dispose();
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BotPlayer;
} else {
    window.BotPlayer = BotPlayer;
} 