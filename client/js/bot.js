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
        this.isNetworkHost = true; // This client owns/controls this bot
        
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
        this.deaths = 0;
        
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
        
        // Enhanced AI timing properties for wall avoidance
        this.lastInputUpdate = 0;
        this.inputUpdateInterval = 3000; // Reduced from 2000ms - update movement less frequently
        this.lastMovementPattern = null; // Track movement pattern changes
        
        // Performance optimization properties (smart optimizations that preserve functionality)
        this.lastWallCheck = 0;
        this.wallCheckInterval = 1000; // Check walls every 1 second instead of constantly
        this.cachedWallDetection = {}; // Cache wall detection results
        this.updateCounter = 0; // For throttling expensive operations
        this.lastNetworkUpdate = 0;
        this.networkUpdateInterval = 100; // Network updates every 100ms (was every frame)
        
        // Collision optimization - reuse objects to reduce garbage collection
        this.tempRay = new BABYLON.Ray(new BABYLON.Vector3(), new BABYLON.Vector3(), 100);
        this.tempVector = new BABYLON.Vector3(0, 0, 0);
        this.tempVector2 = new BABYLON.Vector3(0, 0, 0);
        this.tempVector3 = new BABYLON.Vector3(0, 0, 0);
        
        // Reduce physics accuracy slightly for performance (bots don't need perfect physics)
        this.physicsAccuracy = 0.8; // 80% accuracy vs 100% for players
        
        // Shooting properties
        this.lastShot = 0;
        this.fireRate = 800; // Fire every 800ms when targeting
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
        
        // Check if bot has fallen off the map
        if (this.position.y < -65) {
            console.log(`Bot ${this.username} fell off the map (y: ${this.position.y.toFixed(2)}), respawning...`);
            this.respawn();
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
        if (!this.alive) return;
        
        const currentTime = Date.now();
        this.updateCounter++;
        
        // Optimize expensive operations frequency without breaking functionality
        const doTargetingUpdate = this.updateCounter % 20 === 0; // Every 20 frames (~0.33s at 60fps)
        const doWallUpdate = currentTime - this.lastWallCheck > this.wallCheckInterval;
        
        // Update targeting system (reduced frequency but still functional)
        if (doTargetingUpdate) {
            this.updateTargeting(currentTime);
        }
        
        // Enhanced movement generation with wall avoidance (cached when possible)
        if (currentTime - this.lastInputUpdate > this.inputUpdateInterval) {
            // Update wall detection cache periodically
            if (doWallUpdate) {
                this.cachedWallDetection = this.detectWallsAroundBot();
                this.lastWallCheck = currentTime;
            }
            
            // Check for immediate wall collision danger using cached data when available
            const emergencyAvoidance = this.checkEmergencyWallAvoidance();
            
            if (emergencyAvoidance) {
                Object.assign(this.keys, emergencyAvoidance);
                console.log(`Bot ${this.username} emergency wall avoidance activated`);
            } else {
                this.generateRandomInputs();
            }
            
            this.lastInputUpdate = currentTime;
        }
        
        // Dynamic movement adjustment (use cached data when available)
        if (this.isMoving && Object.keys(this.cachedWallDetection).length > 0) {
            this.adjustMovementForWalls();
        }
        
        // Handle shooting (slightly reduced frequency)
        if (this.currentTarget && currentTime - this.lastShot > this.fireRate) {
            this.shootAtTarget();
            this.lastShot = currentTime;
        }
    }
    
    // Check for immediate wall collision danger requiring emergency action
    checkEmergencyWallAvoidance() {
        if (!this.camera || !this.scene) return null;
        
        // Get current movement direction
        const movementVector = this.getCurrentMovementVector();
        if (movementVector.length() < 0.1) return null; // Not moving
        
        // Cast a forward ray in the current movement direction with earlier detection
        const rayDistance = 5.0; // Increased from 3.0 for earlier detection
        const rayHeight = 1.5;
        
        // Position slightly in front for better collision prediction
        this.tempVector.copyFrom(this.position);
        this.tempVector.y += rayHeight;
        this.tempVector.addInPlace(movementVector.scale(0.5)); // Look ahead 0.5 units
        
        // Transform movement direction to world space
        this.camera.getDirectionToRef(movementVector, this.tempVector2);
        this.tempVector2.y = 0;
        this.tempVector2.normalize();
        
        // Reuse ray object
        this.tempRay.origin.copyFrom(this.tempVector);
        this.tempRay.direction.copyFrom(this.tempVector2);
        this.tempRay.length = rayDistance;
        
        // Use cached mesh filter if available
        const meshFilter = this.meshFilter || ((mesh) => {
            return mesh.checkCollisions && 
                   !mesh.name.includes('bullet') && 
                   !mesh.name.includes('ui_') && 
                   (!mesh.metadata || (!mesh.metadata.isWeapon && !mesh.metadata.isPlayerMesh));
        });
        
        const hit = this.scene.pickWithRay(this.tempRay, meshFilter);
        
        if (hit.hit && hit.distance < 2.5) { // Emergency threshold increased from 2.0
            console.log(`Bot ${this.username} emergency wall detected at distance: ${hit.distance.toFixed(2)}`);
            return this.findEmergencyEscapeRoute(hit);
        }
        
        return null;
    }
    
    getCurrentMovementVector() {
        const movement = new BABYLON.Vector3(0, 0, 0);
        
        if (this.keys.forward) movement.z += 1;
        if (this.keys.backward) movement.z -= 1;
        if (this.keys.left) movement.x -= 1;
        if (this.keys.right) movement.x += 1;
        
        return movement.normalize();
    }
    
    findEmergencyEscapeRoute(wallHit) {
        if (!this.camera || !this.scene) return null;
        
        // Test escape directions in order of preference
        const escapeDirections = [
            { keys: { left: true }, direction: new BABYLON.Vector3(-1, 0, 0), priority: 1 },
            { keys: { right: true }, direction: new BABYLON.Vector3(1, 0, 0), priority: 1 },
            { keys: { backward: true }, direction: new BABYLON.Vector3(0, 0, -1), priority: 2 },
            { keys: { left: true, backward: true }, direction: new BABYLON.Vector3(-0.707, 0, -0.707), priority: 3 },
            { keys: { right: true, backward: true }, direction: new BABYLON.Vector3(0.707, 0, -0.707), priority: 3 }
        ];
        
        // Sort by priority (lower number = higher priority)
        escapeDirections.sort((a, b) => a.priority - b.priority);
        
        for (const escape of escapeDirections) {
            // Transform direction to world space
            this.camera.getDirectionToRef(escape.direction, this.tempVector3);
            this.tempVector3.y = 0;
            this.tempVector3.normalize();
            
            // Test escape direction with a longer ray for better planning
            this.tempVector.copyFrom(this.position);
            this.tempVector.y += 1.5;
            
            this.tempRay.origin.copyFrom(this.tempVector);
            this.tempRay.direction.copyFrom(this.tempVector3);
            this.tempRay.length = 4.0; // Longer escape planning distance
            
            const escapeHit = this.scene.pickWithRay(this.tempRay, this.meshFilter);
            
            // If this direction is clear or the obstacle is far enough
            if (!escapeHit.hit || escapeHit.distance > 3.0) {
                console.log(`Bot ${this.username} found escape route: ${Object.keys(escape.keys).join('+')}`);
                return escape.keys;
            }
        }
        
        // If all escape routes are blocked, stop and back up
        console.log(`Bot ${this.username} completely surrounded, backing up`);
        return { backward: true };
    }
    
    adjustMovementForWalls() {
        if (!this.camera || !this.scene || Object.keys(this.cachedWallDetection).length === 0) return;
        
        const wallData = this.cachedWallDetection;
        let adjustmentMade = false;
        
        // Predictive wall avoidance - adjust movement before hitting walls
        if (this.keys.forward && wallData.forward && wallData.forward.distance < 3.5) {
            // If forward path is blocked, try diagonal movement
            if (!wallData.forwardLeft || !wallData.forwardLeft.tooClose) {
                this.keys.left = true;
                adjustmentMade = true;
            } else if (!wallData.forwardRight || !wallData.forwardRight.tooClose) {
                this.keys.right = true;
                adjustmentMade = true;
            } else {
                // Both diagonals blocked, stop forward movement
                this.keys.forward = false;
                adjustmentMade = true;
            }
        }
        
        // Prevent strafing into walls
        if (this.keys.left && wallData.left && wallData.left.tooClose) {
            this.keys.left = false;
            // Try forward or backward movement instead
            if (!wallData.forward || wallData.forward.distance > 2.5) {
                this.keys.forward = true;
            }
            adjustmentMade = true;
        }
        
        if (this.keys.right && wallData.right && wallData.right.tooClose) {
            this.keys.right = false;
            // Try forward or backward movement instead
            if (!wallData.forward || wallData.forward.distance > 2.5) {
                this.keys.forward = true;
            }
            adjustmentMade = true;
        }
        
        // Corner detection and avoidance
        if (wallData.forwardLeft && wallData.forwardLeft.tooClose && 
            wallData.forwardRight && wallData.forwardRight.tooClose) {
            // In a corner, back out
            this.keys.forward = false;
            this.keys.backward = true;
            adjustmentMade = true;
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
        
        // Use cached wall detection for performance
        const wallDetection = this.cachedWallDetection || {};
        
        // Simplified movement patterns for performance
        const safePatterns = [];
        
        // Basic movements - only add if direction is clear
        if (!wallDetection.forward?.tooClose) {
            safePatterns.push({ forward: true });
            safePatterns.push({ forward: true, sprint: true }); // Sprint if safe
        }
        
        if (!wallDetection.backward?.tooClose) {
            safePatterns.push({ backward: true });
        }
        
        if (!wallDetection.left?.tooClose) {
            safePatterns.push({ left: true });
        }
        
        if (!wallDetection.right?.tooClose) {
            safePatterns.push({ right: true });
        }
        
        // Simplified diagonal movements (only forward combinations for performance)
        if (!wallDetection.forward?.tooClose && !wallDetection.left?.tooClose) {
            safePatterns.push({ forward: true, left: true });
        }
        
        if (!wallDetection.forward?.tooClose && !wallDetection.right?.tooClose) {
            safePatterns.push({ forward: true, right: true });
        }
        
        // Stationary option
        safePatterns.push({});
        
        // Select random pattern from available safe options
        const pattern = safePatterns[Math.floor(Math.random() * safePatterns.length)];
        
        // Apply the chosen pattern
        Object.assign(this.keys, pattern);
        
        // Only log when movement pattern actually changes (reduce spam)
        const patternKey = JSON.stringify(pattern);
        if (this.lastMovementPattern !== patternKey) {
            console.log(`Bot ${this.username} changed movement pattern`);
            this.lastMovementPattern = patternKey;
        }
    }
    
    // Detect walls in key directions around the bot (optimized but functional)
    detectWallsAroundBot() {
        if (!this.camera || !this.scene) return {};
        
        // Increased detection distance for better planning
        const rayDistance = 4.5; // Increased from 3.0
        const rayHeight = 1.5;
        
        // Reuse temp vector for position calculation
        this.tempVector.copyFrom(this.position);
        this.tempVector.y += rayHeight;
        
        // Enhanced direction set with better diagonal coverage
        const directions = {
            forward: new BABYLON.Vector3(0, 0, 1),
            backward: new BABYLON.Vector3(0, 0, -1),
            left: new BABYLON.Vector3(-1, 0, 0),
            right: new BABYLON.Vector3(1, 0, 0),
            forwardLeft: new BABYLON.Vector3(-0.707, 0, 0.707),
            forwardRight: new BABYLON.Vector3(0.707, 0, 0.707),
            backwardLeft: new BABYLON.Vector3(-0.707, 0, -0.707), // Added back for better corner detection
            backwardRight: new BABYLON.Vector3(0.707, 0, -0.707)  // Added back for better corner detection
        };
        
        const wallDetection = {};
        
        // Optimized mesh filter (cached function to avoid recreation)
        if (!this.meshFilter) {
            this.meshFilter = (mesh) => {
                return mesh.checkCollisions && 
                       !mesh.name.includes('bullet') && 
                       !mesh.name.includes('ui_') && 
                       (!mesh.metadata || (!mesh.metadata.isWeapon && !mesh.metadata.isPlayerMesh && !mesh.metadata.isBot));
            };
        }
        
        // Transform directions and cast rays
        Object.keys(directions).forEach(dirName => {
            // Reuse temp vectors
            this.tempVector2.copyFrom(directions[dirName]);
            this.camera.getDirectionToRef(this.tempVector2, this.tempVector2);
            this.tempVector2.y = 0;
            this.tempVector2.normalize();
            
            // Reuse ray object to reduce garbage collection
            this.tempRay.origin.copyFrom(this.tempVector);
            this.tempRay.direction.copyFrom(this.tempVector2);
            this.tempRay.length = rayDistance;
            
            const hit = this.scene.pickWithRay(this.tempRay, this.meshFilter);
            
            wallDetection[dirName] = {
                hasWall: hit.hit,
                distance: hit.hit ? hit.distance : rayDistance,
                tooClose: hit.hit && hit.distance < 2.0,  // Immediate danger
                warning: hit.hit && hit.distance < 3.0,   // Warning zone
                safe: !hit.hit || hit.distance > 3.5      // Safe zone
            };
        });
        
        return wallDetection;
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
        
        // Store previous position for networking (reuse temp vector)
        this.tempVector3.copyFrom(this.position);
        
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
        
        // OPTIMIZED COLLISION DETECTION - Reduced accuracy for bots (they don't need perfect physics)
        let newPosition = this.position.clone();
        
        // Reduced collision parameters for bots (good enough accuracy)
        const playerRadius = 1.2 * this.physicsAccuracy; // Slightly smaller for performance
        const playerHeight = 3.0; 
        const stepHeight = 100.0; 
        
        // Optimized mesh filter (reuse cached version)
        const meshFilter = this.meshFilter || ((mesh) => {
            return mesh.checkCollisions && mesh.name !== 'bullet' && mesh.name !== 'hitEffect' && 
                   !mesh.name.startsWith('ui_') && (!mesh.metadata || !mesh.metadata.isWeapon);
        });
        
        // Step 1: Optimized horizontal movement - fewer checks for bots
        const horizontalDistance = Math.sqrt(moveDistance.x * moveDistance.x + moveDistance.z * moveDistance.z);
        if (horizontalDistance > 0.001) {
            const moveDir = new BABYLON.Vector3(moveDistance.x, 0, moveDistance.z).normalize();
            const targetHorizontalPos = new BABYLON.Vector3(
                this.position.x + moveDistance.x,
                this.position.y,
                this.position.z + moveDistance.z
            );
            
            // Reduced height checks for bots - only check one height for performance
            let canMoveHorizontal = true;
            const checkHeight = 1.5; // Single height check at eye level
            
            // Reuse ray object
            this.tempRay.origin.set(this.position.x, this.position.y + checkHeight, this.position.z);
            this.tempRay.direction.copyFrom(moveDir);
            this.tempRay.length = horizontalDistance + playerRadius;
            
            const rayHit = this.scene.pickWithRay(this.tempRay, meshFilter);
            
            if (rayHit.hit && rayHit.distance < horizontalDistance + playerRadius) {
                canMoveHorizontal = false;
            }
            
            if (canMoveHorizontal) {
                // No collision - move normally
                newPosition.x = targetHorizontalPos.x;
                newPosition.z = targetHorizontalPos.z;
            } else {
                // Simplified wall sliding for bots (good enough)
                let slideMovement = new BABYLON.Vector3(0, 0, 0);
                
                // Test X movement alone
                if (Math.abs(moveDistance.x) > 0.001) {
                    this.tempRay.origin.set(this.position.x, this.position.y + 1.5, this.position.z);
                    this.tempRay.direction.set(Math.sign(moveDistance.x), 0, 0);
                    this.tempRay.length = Math.abs(moveDistance.x) + playerRadius;
                    
                    const xHit = this.scene.pickWithRay(this.tempRay, meshFilter);
                    
                    if (!xHit.hit || xHit.distance >= Math.abs(moveDistance.x) + playerRadius) {
                        slideMovement.x = moveDistance.x * 0.9;
                    }
                }
                
                // Test Z movement alone
                if (Math.abs(moveDistance.z) > 0.001) {
                    this.tempRay.origin.set(this.position.x, this.position.y + 1.5, this.position.z);
                    this.tempRay.direction.set(0, 0, Math.sign(moveDistance.z));
                    this.tempRay.length = Math.abs(moveDistance.z) + playerRadius;
                    
                    const zHit = this.scene.pickWithRay(this.tempRay, meshFilter);
                    
                    if (!zHit.hit || zHit.distance >= Math.abs(moveDistance.z) + playerRadius) {
                        slideMovement.z = moveDistance.z * 0.9;
                    }
                }
                
                // Apply sliding movement
                newPosition.x = this.position.x + slideMovement.x;
                newPosition.z = this.position.z + slideMovement.z;
            }
        }
        
        // Step 2: Simplified ground detection for bots (fewer rays but still functional)
        newPosition.y = this.position.y + moveDistance.y;
        
        // Reduced ground check positions for bots (center + 2 edges vs 5 points)
        const footLevel = newPosition.y + 0.1;
        const groundCheckPositions = [
            new BABYLON.Vector3(newPosition.x, footLevel, newPosition.z), // Center (most important)
            new BABYLON.Vector3(newPosition.x + 0.6, footLevel, newPosition.z), // Right edge (reduced from 0.8)
            new BABYLON.Vector3(newPosition.x - 0.6, footLevel, newPosition.z)  // Left edge (reduced from 0.8)
            // Removed forward/backward checks for performance
        ];
        
        let groundHit = null;
        let closestGroundDistance = Infinity;
        
        // Check ground positions (reuse ray object)
        for (let checkPos of groundCheckPositions) {
            this.tempRay.origin.copyFrom(checkPos);
            this.tempRay.direction.set(0, -1, 0);
            this.tempRay.length = 100;
            
            const hit = this.scene.pickWithRay(this.tempRay, meshFilter);
            
            if (hit.hit && hit.distance < closestGroundDistance) {
                closestGroundDistance = hit.distance;
                groundHit = hit;
                
                // Early exit if ground is very close
                if (hit.distance < 1.0) {
                    break;
                }
            }
        }
        
        // Apply ground collision
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
        this.camera.position.y += this.eyeHeight;
        
        // Update rotation for networking
        this.rotation.x = this.camera.rotation.x;
        this.rotation.y = this.camera.rotation.y;
        this.rotation.z = this.camera.rotation.z;
        
        // Update target position for RemotePlayer interpolation
        this.targetPosition = this.position.clone();
        this.targetRotation = this.rotation.clone();
        
        // Optimized network updates (throttled)
        const currentTime = Date.now();
        if (this.isNetworkHost && this.game.networkManager && 
            currentTime - this.lastNetworkUpdate > this.networkUpdateInterval) {
            
            // Check if position changed significantly
            const positionChange = BABYLON.Vector3.Distance(this.tempVector3, this.position);
            if (positionChange > 0.5) {
                this.game.networkManager.sendBotUpdate(this.id, {
                    position: this.position,
                    rotation: this.rotation,
                    alive: this.alive,
                    health: this.health
                });
                this.lastNetworkUpdate = currentTime;
            }
        }
        
        // Track movement for walking sound
        this.isMoving = (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) && 
                       this.isGrounded && horizontalDistance > 0.005;
        
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
        
        // Increment death count
        this.deaths++;
        
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
        
        console.log(`Bot ${this.username} after die() - health: ${this.health}, alive: ${this.alive}, deaths: ${this.deaths}`);
        
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
        // Notify network about bot removal if this client owns the bot
        if (this.isNetworkHost && this.game.networkManager) {
            this.game.networkManager.sendBotRemoved(this.id);
        }
        
        // Dispose of all meshes
        if (this.characterMeshes) {
            this.characterMeshes.forEach(mesh => {
                if (mesh) mesh.dispose();
            });
        }
        
        if (this.mesh) {
            this.mesh.dispose();
        }
        
        if (this.camera) {
            this.camera.dispose();
        }
        
        console.log(`Bot ${this.username} (${this.id}) disposed`);
    }
    
    // Update bot from network data (for remote bots)
    updateFromNetwork(data) {
        if (this.isNetworkHost) return; // Don't update if this client owns the bot
        
        // Update position and rotation from network
        this.targetPosition = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
        this.targetRotation = { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z };
        this.alive = data.alive;
        this.health = data.health;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BotPlayer;
} else {
    window.BotPlayer = BotPlayer;
} 