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
            
            // Send initial username
            if (this.game.uiManager) {
                const username = this.game.uiManager.getCurrentUsername();
                this.sendUsernameUpdate(username);
            }
            
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
            
            // Play 3D weapon sound for remote player
            if (this.game.audioManager && this.game.player) {
                const shooterPosition = new BABYLON.Vector3(data.origin.x, data.origin.y, data.origin.z);
                const listenerPosition = this.game.player.position;
                
                // Get weapon config for the remote player who shot
                let weaponConfig = null;
                
                // Try to find the remote player who shot
                const remotePlayer = this.game.remotePlayers.get(data.playerId);
                if (remotePlayer && remotePlayer.currentWeaponConfig) {
                    // Use remote player's weapon if available
                    weaponConfig = remotePlayer.currentWeaponConfig;
                } else {
                    // Fallback: Use a default weapon sound (Bulldog for now)
                    // In the future, server should send weapon type with shot data
                    weaponConfig = window.BulldogConfig;
                }
                
                if (weaponConfig) {
                    this.game.audioManager.playRemoteWeaponSound(
                        weaponConfig, 
                        listenerPosition, 
                        shooterPosition
                    );
                }
            }
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
                
                // Update remote player's alive state to trigger death animation
                const remotePlayer = this.game.remotePlayers.get(data.victimId);
                if (remotePlayer) {
                    remotePlayer.updateFromServer({
                        position: remotePlayer.targetPosition,
                        rotation: remotePlayer.targetRotation,
                        health: 0,
                        alive: false,
                        score: remotePlayer.score
                    });
                    
                    // Play 3D death sound for remote player
                    if (this.game.audioManager && this.game.player) {
                        this.game.audioManager.playRemoteDamageSound(
                            this.game.player.position,
                            remotePlayer.position
                        );
                    }
                }
            }
            
            // Handle kill scoring
            if (data.killerId === this.playerId) {
                // Local player got a kill - use server-provided score for consistency
                this.game.player.score = data.killerScore || this.game.player.score + 1;
                console.log('Your score is now:', this.game.player.score);
                
                // Trigger Flowstate system
                if (this.game.flowstateManager) {
                    this.game.flowstateManager.onKill();
                }
            } else {
                // Remote player got a kill, update their score with server data
                const killerPlayer = this.game.remotePlayers.get(data.killerId);
                if (killerPlayer) {
                    killerPlayer.score = data.killerScore || (killerPlayer.score || 0) + 1;
                }
            }
            
            // Handle death counting
            if (data.victimId === this.playerId) {
                // Local player died - deaths already incremented in die() method
                console.log('Your deaths:', this.game.player.deaths);
            } else {
                // Remote player died, update their death count with server data
                const victimPlayer = this.game.remotePlayers.get(data.victimId);
                if (victimPlayer && data.victimDeaths !== undefined) {
                    victimPlayer.deaths = data.victimDeaths;
                }
            }
            
            // Show kill feed
            if (this.game.uiManager) {
                let killerName, victimName;
                
                if (data.killerId === this.playerId) {
                    killerName = 'You';
                } else {
                    const killerPlayer = this.game.remotePlayers.get(data.killerId);
                    killerName = killerPlayer?.username || `Player ${data.killerId.slice(-4)}`;
                }
                
                if (data.victimId === this.playerId) {
                    victimName = 'You';
                } else {
                    const victimPlayer = this.game.remotePlayers.get(data.victimId);
                    victimName = victimPlayer?.username || `Player ${data.victimId.slice(-4)}`;
                }
                
                this.game.uiManager.showKillFeed(killerName, victimName);
            }
        });
        
        // Player respawned
        this.socket.on('playerRespawned', (data) => {
            if (data.playerId === this.playerId) {
                console.log('You respawned');
                const spawnPos = new BABYLON.Vector3(
                    data.player.position.x,
                    data.player.position.y,
                    data.player.position.z
                );
                this.game.player.respawn(spawnPos);
            } else {
                console.log('Player respawned:', data.playerId);
                const remotePlayer = this.game.remotePlayers.get(data.playerId);
                if (remotePlayer) {
                    remotePlayer.updateFromServer(data.player);
                }
            }
        });
        
        // Bot networking events
        this.socket.on('botUpdate', (data) => {
            // Update bot position from network
            const bot = this.game.bots ? this.game.bots.get(data.botId) : null;
            if (bot && !bot.isNetworkHost) {
                // Only update if this client doesn't own the bot
                bot.updateFromNetwork(data);
            }
        });
        
        this.socket.on('botSpawned', (data) => {
            // Another client spawned a bot - create it locally
            if (!this.game.bots) this.game.bots = new Map();
            
            console.log('Remote bot spawned:', data.botId);
            const bot = new BotPlayer(this.game, data.botId);
            bot.isNetworkHost = false; // Mark as remote bot
            bot.position = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
            bot.username = data.username;
            this.game.bots.set(data.botId, bot);
        });
        
        this.socket.on('botRemoved', (data) => {
            // Another client removed a bot
            if (this.game.bots && this.game.bots.has(data.botId)) {
                const bot = this.game.bots.get(data.botId);
                bot.dispose();
                this.game.bots.delete(data.botId);
                console.log('Remote bot removed:', data.botId);
            }
        });
        
        // Username update from other players
        this.socket.on('playerUsernameUpdated', (data) => {
            console.log('Player username updated:', data);
            const remotePlayer = this.game.remotePlayers.get(data.playerId);
            if (remotePlayer) {
                remotePlayer.username = data.username;
                remotePlayer.updateNameTag(); // Update the visual name tag
                console.log(`Updated username for player ${data.playerId}: ${data.username}`);
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
    
    sendUsernameUpdate(username) {
        if (this.connected && this.socket) {
            this.socket.emit('usernameUpdate', { username: username });
            console.log('Sent username update:', username);
        }
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
                // Count current players (including bots)
                const humanCount = this.game.remotePlayers.size + 1; // +1 for local player
                const botCount = this.game.bots ? this.game.bots.size : 0;
                const totalCount = humanCount + botCount;
                playerCountElement.textContent = `Players: ${humanCount} (${botCount} bots)`;
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
    
    // Bot networking functions
    sendBotUpdate(botId, botData) {
        if (this.connected && this.socket) {
            this.socket.emit('botUpdate', {
                botId: botId,
                position: botData.position,
                rotation: botData.rotation,
                alive: botData.alive,
                health: botData.health
            });
        }
    }
    
    sendBotSpawned(botId, botData) {
        if (this.connected && this.socket) {
            this.socket.emit('botSpawned', {
                botId: botId,
                position: botData.position,
                username: botData.username
            });
            console.log('Sent bot spawn notification:', botId);
        }
    }
    
    sendBotRemoved(botId) {
        if (this.connected && this.socket) {
            this.socket.emit('botRemoved', { botId: botId });
            console.log('Sent bot removal notification:', botId);
        }
    }
} 