class UIManager {
    constructor(game) {
        this.game = game;
        
        // UI elements
        this.healthBar = document.getElementById('healthFill');
        this.healthText = document.getElementById('healthText');
        this.deathScreen = document.getElementById('deathScreen');
        this.respawnButton = document.getElementById('respawnButton');
        this.respawnTimer = document.getElementById('respawnTimer');
        this.playerCount = document.getElementById('playerCount');
        this.connectionStatus = document.getElementById('connectionStatus');
        
        // Leaderboard elements
        this.leaderboard = document.getElementById('leaderboard');
        this.leaderboardBody = document.getElementById('leaderboardBody');
        this.isLeaderboardOpen = false;
        
        // Death screen state
        this.isDead = false;
        this.respawnCountdown = 0;
        this.respawnInterval = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Respawn button click
        if (this.respawnButton) {
            this.respawnButton.addEventListener('click', () => {
                this.requestRespawn();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyR' && this.isDead) {
                this.requestRespawn();
                event.preventDefault();
            }
            
            // Tab key for leaderboard
            if (event.code === 'Tab' && !this.isDead) {
                this.toggleLeaderboard();
                event.preventDefault();
            }
        });
    }
    
    update(deltaTime) {
        // Update any animated UI elements here
    }
    
    updateHealth(health) {
        const healthPercentage = Math.max(0, Math.min(100, health));
        
        if (this.healthBar) {
            this.healthBar.style.width = `${healthPercentage}%`;
        }
        
        if (this.healthText) {
            this.healthText.textContent = `Health: ${Math.floor(healthPercentage)}`;
        }
        
        // Change color based on health level
        if (this.healthBar) {
            if (healthPercentage < 25) {
                this.healthBar.style.background = '#ff0000';
            } else if (healthPercentage < 50) {
                this.healthBar.style.background = 'linear-gradient(90deg, #ff0000, #ffff00)';
            } else {
                this.healthBar.style.background = 'linear-gradient(90deg, #ff0000, #ffff00, #00ff00)';
            }
        }
    }
    
    showDeathScreen() {
        this.isDead = true;
        
        if (this.deathScreen) {
            this.deathScreen.style.display = 'flex';
        }
        
        // Start respawn countdown
        this.startRespawnCountdown();
    }
    
    hideDeathScreen() {
        this.isDead = false;
        
        if (this.deathScreen) {
            this.deathScreen.style.display = 'none';
        }
        
        // Clear countdown
        this.clearRespawnCountdown();
    }
    
    startRespawnCountdown() {
        this.respawnCountdown = 3; // 3 seconds
        
        if (this.respawnTimer) {
            this.respawnTimer.textContent = this.respawnCountdown;
        }
        
        if (this.respawnButton) {
            this.respawnButton.style.display = 'none';
        }
        
        this.respawnInterval = setInterval(() => {
            this.respawnCountdown--;
            
            if (this.respawnTimer) {
                this.respawnTimer.textContent = this.respawnCountdown;
            }
            
            if (this.respawnCountdown <= 0) {
                this.clearRespawnCountdown();
                this.showRespawnButton();
            }
        }, 1000);
    }
    
    clearRespawnCountdown() {
        if (this.respawnInterval) {
            clearInterval(this.respawnInterval);
            this.respawnInterval = null;
        }
    }
    
    showRespawnButton() {
        if (this.respawnButton) {
            this.respawnButton.style.display = 'block';
        }
        
        if (this.respawnTimer && this.respawnTimer.parentNode) {
            this.respawnTimer.parentNode.innerHTML = 'Press R or click to respawn';
        }
    }
    
    requestRespawn() {
        if (!this.isDead) return;
        
        // Send respawn request to server
        if (this.game.networkManager) {
            this.game.networkManager.requestRespawn();
        }
        
        // Hide respawn button temporarily
        if (this.respawnButton) {
            this.respawnButton.style.display = 'none';
        }
        
        // Show waiting message
        if (this.respawnTimer && this.respawnTimer.parentNode) {
            this.respawnTimer.parentNode.innerHTML = 'Respawning...';
        }
    }
    
    updatePlayerCount(count) {
        if (this.playerCount) {
            this.playerCount.textContent = `Players: ${count}`;
        }
    }
    
    updateConnectionStatus(status, message) {
        if (this.connectionStatus) {
            this.connectionStatus.className = status;
            this.connectionStatus.textContent = message;
        }
    }
    
    showMessage(message, duration = 3000, type = 'info') {
        // Create a temporary message element
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 5px;
            font-size: 18px;
            font-weight: bold;
            z-index: 3000;
            pointer-events: none;
        `;
        
        // Set color based on message type
        switch (type) {
            case 'error':
                messageElement.style.borderLeft = '5px solid #ff0000';
                break;
            case 'success':
                messageElement.style.borderLeft = '5px solid #00ff00';
                break;
            case 'warning':
                messageElement.style.borderLeft = '5px solid #ffff00';
                break;
            default:
                messageElement.style.borderLeft = '5px solid #007acc';
                break;
        }
        
        messageElement.textContent = message;
        document.body.appendChild(messageElement);
        
        // Remove after duration
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, duration);
    }
    
    showKillFeed(killerName, victimName) {
        // Create kill feed entry
        const killFeedElement = document.createElement('div');
        killFeedElement.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 1500;
            animation: slideInFromRight 0.3s ease-out;
        `;
        
        killFeedElement.innerHTML = `<span style="color: #ff6666;">${killerName}</span> → <span style="color: #ffcccc;">${victimName}</span>`;
        document.body.appendChild(killFeedElement);
        
        // Remove after 5 seconds
        setTimeout(() => {
            killFeedElement.style.animation = 'slideOutToRight 0.3s ease-in';
            setTimeout(() => {
                if (killFeedElement.parentNode) {
                    killFeedElement.parentNode.removeChild(killFeedElement);
                }
            }, 300);
        }, 5000);
    }
    
    showDamageIndicator(direction) {
        // Create damage indicator pointing to damage source
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            width: 100px;
            height: 100px;
            transform: translate(-50%, -50%);
            border: 5px solid rgba(255, 0, 0, 0.8);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1500;
            animation: damageFlash 0.5s ease-out;
        `;
        
        document.body.appendChild(indicator);
        
        // Remove after animation
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 500);
    }
    
    toggleInstructions() {
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    // Add CSS animations dynamically
    // Leaderboard methods
    toggleLeaderboard() {
        if (!this.leaderboard) return;
        
        this.isLeaderboardOpen = !this.isLeaderboardOpen;
        this.leaderboard.style.display = this.isLeaderboardOpen ? 'block' : 'none';
        
        if (this.isLeaderboardOpen) {
            this.updateLeaderboard();
        }
    }
    
    updateLeaderboard() {
        if (!this.leaderboardBody || !this.game) return;
        
        // Get all players with scores
        const players = [];
        
        // Add local player
        if (this.game.player && this.game.networkManager) {
            players.push({
                id: this.game.networkManager.playerId,
                name: `Player ${this.game.networkManager.playerId.slice(-4)}`,
                score: this.game.player.score || 0,
                alive: this.game.player.alive
            });
        }
        
        // Add remote players
        this.game.remotePlayers.forEach((remotePlayer, playerId) => {
            players.push({
                id: playerId,
                name: `Player ${playerId.slice(-4)}`,
                score: remotePlayer.score || 0,
                alive: remotePlayer.alive
            });
        });
        
        // Sort by score (descending)
        players.sort((a, b) => b.score - a.score);
        
        // Clear current leaderboard
        this.leaderboardBody.innerHTML = '';
        
        // Add players to leaderboard
        players.forEach((player, index) => {
            const row = document.createElement('tr');
            
            const rank = index + 1;
            const isCurrentPlayer = player.id === (this.game.networkManager ? this.game.networkManager.playerId : null);
            
            if (isCurrentPlayer) {
                row.style.background = 'rgba(0, 122, 204, 0.3)';
            }
            
            row.innerHTML = `
                <td class="leaderboard-rank">${rank}</td>
                <td class="leaderboard-player">${player.name}${isCurrentPlayer ? ' (You)' : ''}</td>
                <td class="leaderboard-score">${player.score}</td>
                <td class="leaderboard-status">
                    <span class="${player.alive ? 'status-alive' : 'status-dead'}">
                        ${player.alive ? 'Alive' : 'Dead'}
                    </span>
                </td>
            `;
            
            this.leaderboardBody.appendChild(row);
        });
        
        // If no players, show message
        if (players.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="4" style="text-align: center; color: #ccc;">No players in game</td>';
            this.leaderboardBody.appendChild(row);
        }
    }
    
    // Method to update player score (called when kills happen)
    updatePlayerScore(playerId, newScore) {
        // Update remote player score
        const remotePlayer = this.game.remotePlayers.get(playerId);
        if (remotePlayer) {
            remotePlayer.score = newScore;
        }
        
        // Update leaderboard if it's open
        if (this.isLeaderboardOpen) {
            this.updateLeaderboard();
        }
    }

    addAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInFromRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutToRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            @keyframes damageFlash {
                0% { opacity: 0.8; transform: translate(-50%, -50%) scale(0.5); }
                50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize animations when the script loads
document.addEventListener('DOMContentLoaded', () => {
    const tempUI = new UIManager({});
    tempUI.addAnimations();
}); 