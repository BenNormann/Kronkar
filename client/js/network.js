class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.connected = false;
        this.playerId = null;
        
        // Network optimization
        this.lastUpdateSent = 0;
        this.updateRate = 1000 / 60; // 60 updates per second
        
        // Pending updates
        this.pendingPlayerUpdate = null;
        this.pendingShoot = null;
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // Connect to server
                this.socket = io();
                
                this.setupEventHandlers();
                
                this.socket.on('connect', () => {
                    console.log('Connected to server');
                    this.connected = true;
                    this.updateConnectionStatus('connected', 'Connected to server');
                    resolve();
                });
                
                this.socket.on('connect_error', (error) => {
                    console.error('Connection failed:', error);
                    this.connected = false;
                    this.updateConnectionStatus('disconnected', 'Connection failed');
                    reject(error);
                });
                
                this.socket.on('disconnect', () => {
                    console.log('Disconnected from server');
                    this.connected = false;
                    this.updateConnectionStatus('disconnected', 'Disconnected from server');
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    setupEventHandlers() {
        // Player joined the game
        this.socket.on('playerJoined', (data) => {
            console.log('Player joined:', data);
            this.playerId = data.playerId;
            
            // Set player position to spawn position
            if (data.player && data.player.position) {
                const spawnPos = new BABYLON.Vector3(
                    data.player.position.x,
                    data.player.position.y,
                    data.player.position.z
                );
                this.game.player.position = spawnPos;
                this.game.player.camera.position = spawnPos.clone();
                this.game.player.camera.position.y += this.game.player.eyeHeight; // Apply proper eye height
                console.log('Player positioned by server at:', spawnPos.toString());
            }
            
            // Add existing players
            if (data.allPlayers) {
                data.allPlayers.forEach(playerData => {
                    if (playerData.id !== this.playerId) {
                        this.game.addRemotePlayer(playerData);
                    }
                });
            }
            
            // Update player count
            this.updatePlayerCount(data.allPlayers ? data.allPlayers.length : 1);
        });
        
        // New player connected
        this.socket.on('playerConnected', (playerData) => {
            console.log('New player connected:', playerData.id);
            this.game.addRemotePlayer(playerData);
            this.updatePlayerCount();
        });
        
        // Player disconnected
        this.socket.on('playerDisconnected', (playerId) => {
            console.log('Player disconnected:', playerId);
            this.game.removeRemotePlayer(playerId);
            this.updatePlayerCount();
        });
        
        // Player movement update
        this.socket.on('playerMoved', (data) => {
            const remotePlayer = this.game.remotePlayers.get(data.playerId);
            if (remotePlayer) {
                remotePlayer.updateFromServer({
                    position: data.position,
                    rotation: data.rotation,
                    health: remotePlayer.health,
                    alive: remotePlayer.alive
                });
            }
        });
        
        // Player shot - create projectile for other players' shots
        this.socket.on('playerShot', (data) => {
            // Create physics projectile for other players' shots
            this.game.createProjectile(
                new BABYLON.Vector3(data.origin.x, data.origin.y, data.origin.z),
                new BABYLON.Vector3(data.direction.x, data.direction.y, data.direction.z),
                data.playerId
            );
        });
        
        // Player took damage
        this.socket.on('playerDamaged', (data) => {
            console.log('You took damage:', data.damage);
            this.game.player.takeDamage(data.damage);
        });
        
        // Player killed
        this.socket.on('playerKilled', (data) => {
            if (data.victimId === this.playerId) {
                console.log('You were killed by:', data.killerId);
                this.game.player.die();
            } else {
                console.log('Player killed:', data.victimId, 'by', data.killerId);
                // Could show kill feed here
            }
        });
        
        // Player respawned
        this.socket.on('playerRespawned', (data) => {
            if (data.playerId === this.playerId) {
                const spawnPos = new BABYLON.Vector3(
                    data.player.position.x,
                    data.player.position.y,
                    data.player.position.z
                );
                this.game.player.respawn(spawnPos);
                console.log('Player respawned by server at:', spawnPos.toString());
            } else {
                // Update remote player
                const remotePlayer = this.game.remotePlayers.get(data.playerId);
                if (remotePlayer) {
                    remotePlayer.updateFromServer(data.player);
                }
            }
        });
    }
    
    sendPlayerUpdate(position, rotation) {
        if (!this.connected || !this.socket) return;
        
        const now = Date.now();
        if (now - this.lastUpdateSent < this.updateRate) {
            // Store pending update
            this.pendingPlayerUpdate = { position, rotation };
            return;
        }
        
        // Send the update
        this.socket.emit('playerUpdate', {
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            rotation: {
                x: rotation.x,
                y: rotation.y,
                z: rotation.z
            }
        });
        
        this.lastUpdateSent = now;
        this.pendingPlayerUpdate = null;
    }
    
    sendShoot(origin, direction) {
        if (!this.connected || !this.socket) return;
        
        this.socket.emit('playerShoot', {
            origin: {
                x: origin.x,
                y: origin.y,
                z: origin.z
            },
            direction: {
                x: direction.x,
                y: direction.y,
                z: direction.z
            }
        });
    }
    
    requestRespawn() {
        if (!this.connected || !this.socket) return;
        
        this.socket.emit('requestRespawn');
    }
    
    updateConnectionStatus(status, message) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.className = status;
            statusElement.textContent = message;
        }
    }
    
    updatePlayerCount(count) {
        const playerCountElement = document.getElementById('playerCount');
        if (playerCountElement) {
            if (count !== undefined) {
                playerCountElement.textContent = `Players: ${count}`;
            } else {
                // Count current players
                const currentCount = this.game.remotePlayers.size + 1; // +1 for local player
                playerCountElement.textContent = `Players: ${currentCount}`;
            }
        }
    }
    
    // Send pending updates if any
    update() {
        if (this.pendingPlayerUpdate) {
            this.sendPlayerUpdate(
                this.pendingPlayerUpdate.position,
                this.pendingPlayerUpdate.rotation
            );
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
    }
} 