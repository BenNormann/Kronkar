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
        
        // Username input elements (welcome screen and settings menu)
        this.usernameInput = document.getElementById('usernameInput');
        this.settingsMenu = document.getElementById('settingsMenu');
        this.saveSettingsButton = document.getElementById('saveSettings');
        this.cancelSettingsButton = document.getElementById('cancelSettings');
        this.isSettingsOpen = false;
        
        // Music selection elements
        this.musicDropdown = document.getElementById('musicDropdown');
        this.musicDescription = document.getElementById('musicDescription');
        
        // Death screen state
        this.isDead = false;
        this.respawnCountdown = 0;
        this.respawnInterval = null;
        
        this.setupEventListeners();
        this.loadUsername();
        this.loadSelectedMusic();
    }
    
    setupEventListeners() {
        // Respawn button click
        if (this.respawnButton) {
            this.respawnButton.addEventListener('click', () => {
                this.requestRespawn();
            });
        }
        
        // Username input handlers (for welcome screen)
        if (this.usernameInput) {
            // Save username when user types or changes focus
            this.usernameInput.addEventListener('blur', () => {
                this.saveUsername();
            });
            
            this.usernameInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.saveUsername();
                    this.usernameInput.blur();
                }
            });
        }
        
        // Settings menu button handlers
        if (this.saveSettingsButton) {
            this.saveSettingsButton.addEventListener('click', () => {
                this.saveSettings();
            });
        }
        
        if (this.cancelSettingsButton) {
            this.cancelSettingsButton.addEventListener('click', () => {
                this.closeSettings();
            });
        }
        
        // Music selection handlers
        if (this.musicDropdown) {
            this.musicDropdown.addEventListener('change', () => {
                this.saveSelectedMusic();
                this.updateMusicDescription();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyR' && this.isDead) {
                this.requestRespawn();
                event.preventDefault();
            }
            
            // Tab key for leaderboard
            if (event.code === 'Tab' && !this.isDead && !this.isSettingsOpen) {
                this.toggleLeaderboard();
                event.preventDefault();
            }
            
            // Escape key for settings menu
            if (event.code === 'Escape' && !this.isDead) {
                if (this.isSettingsOpen) {
                    this.closeSettings();
                } else if (this.isLeaderboardOpen) {
                    this.toggleLeaderboard();
                } else {
                    this.openSettings();
                }
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
                name: this.getCurrentUsername(),
                score: this.game.player.score || 0,
                alive: this.game.player.alive
            });
        }
        
        // Add remote players
        this.game.remotePlayers.forEach((remotePlayer, playerId) => {
            players.push({
                id: playerId,
                name: remotePlayer.username || `Player ${playerId.slice(-4)}`,
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
    
    // Username Management
    loadUsername() {
        // Load username from localStorage or generate default
        const savedUsername = localStorage.getItem('kronkar_username');
        if (savedUsername) {
            this.currentUsername = savedUsername;
        } else {
            // Generate a default username
            this.currentUsername = this.generateDefaultUsername();
            localStorage.setItem('kronkar_username', this.currentUsername);
        }
        
        // Update input field if it exists
        if (this.usernameInput) {
            this.usernameInput.value = this.currentUsername;
        }
        
        console.log('Loaded username:', this.currentUsername);
    }
    
    generateDefaultUsername() {
        const adjectives = ['Swift', 'Shadow', 'Lightning', 'Steel', 'Storm', 'Frost', 'Fire', 'Dark', 'Golden', 'Silver'];
        const nouns = ['Warrior', 'Hunter', 'Sniper', 'Ghost', 'Wolf', 'Eagle', 'Viper', 'Tiger', 'Dragon', 'Phoenix'];
        
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumber = Math.floor(Math.random() * 99);
        
        return `${randomAdjective}${randomNoun}${randomNumber}`;
    }
    
    getCurrentUsername() {
        return this.currentUsername || 'Player';
    }
    
    // Save username from the welcome screen input
    saveUsername() {
        if (!this.usernameInput) return;
        
        let newUsername = this.usernameInput.value.trim();
        
        // Validation
        if (!newUsername) {
            newUsername = this.generateDefaultUsername();
            this.usernameInput.value = newUsername;
        }
        
        if (newUsername.length > 20) {
            newUsername = newUsername.substring(0, 20);
            this.usernameInput.value = newUsername;
        }
        
        // Remove invalid characters
        newUsername = newUsername.replace(/[<>"/\\&]/g, '');
        this.usernameInput.value = newUsername;
        
        if (newUsername !== this.currentUsername) {
            this.currentUsername = newUsername;
            localStorage.setItem('kronkar_username', this.currentUsername);
            
            // Notify server of username change if connected
            if (this.game.networkManager && this.game.networkManager.connected) {
                this.game.networkManager.sendUsernameUpdate(this.currentUsername);
            }
            
            console.log('Username updated to:', this.currentUsername);
        }
    }
    
    // Settings Menu Methods
    openSettings() {
        if (!this.settingsMenu || this.isDead) return;
        
        this.isSettingsOpen = true;
        this.settingsMenu.style.display = 'block';
        
        // Close leaderboard if open
        if (this.isLeaderboardOpen) {
            this.toggleLeaderboard();
        }
        
        // Update settings input with current username
        const settingsUsernameInput = this.settingsMenu.querySelector('#usernameInput');
        if (settingsUsernameInput) {
            settingsUsernameInput.value = this.currentUsername;
            settingsUsernameInput.focus();
            settingsUsernameInput.select();
        }
    }
    
    closeSettings() {
        if (!this.settingsMenu) return;
        
        this.isSettingsOpen = false;
        this.settingsMenu.style.display = 'none';
    }
    
    saveSettings() {
        const settingsUsernameInput = this.settingsMenu.querySelector('#usernameInput');
        if (!settingsUsernameInput) return;
        
        let newUsername = settingsUsernameInput.value.trim();
        
        // Validation
        if (!newUsername) {
            this.showMessage('Username cannot be empty!', 3000, 'error');
            return;
        }
        
        if (newUsername.length > 20) {
            this.showMessage('Username too long! Max 20 characters.', 3000, 'error');
            return;
        }
        
        // Remove invalid characters
        newUsername = newUsername.replace(/[<>"/\\&]/g, '');
        
        if (newUsername !== this.currentUsername) {
            this.currentUsername = newUsername;
            localStorage.setItem('kronkar_username', this.currentUsername);
            
            // Update welcome screen input as well
            if (this.usernameInput) {
                this.usernameInput.value = this.currentUsername;
            }
            
            // Notify server of username change
            if (this.game.networkManager && this.game.networkManager.connected) {
                this.game.networkManager.sendUsernameUpdate(this.currentUsername);
            }
            
            this.showMessage(`Username updated to: ${this.currentUsername}`, 3000, 'success');
            console.log('Username updated to:', this.currentUsername);
        }
        
        this.closeSettings();
    }

    // Music Selection Management
    loadSelectedMusic() {
        const savedMusic = localStorage.getItem('kronkar_selected_music');
        if (savedMusic && this.musicDropdown) {
            this.musicDropdown.value = savedMusic;
        }
        this.updateMusicDescription();
    }
    
    saveSelectedMusic() {
        if (!this.musicDropdown) return;
        
        const selectedMusic = this.musicDropdown.value;
        localStorage.setItem('kronkar_selected_music', selectedMusic);
        console.log('Selected music saved:', selectedMusic);
    }
    
    getSelectedMusic() {
        return localStorage.getItem('kronkar_selected_music') || 'Synthwave1.mp3';
    }
    
    updateMusicDescription() {
        if (!this.musicDescription) return;
        
        const selectedMusic = this.musicDropdown ? this.musicDropdown.value : this.getSelectedMusic();
        
        const descriptions = {
            'Synthwave1.mp3': 'Energetic synthwave track perfect for intense moments',
            'Synthwave2.mp3': 'Atmospheric synthwave with driving beats',
            'Phonk1.mp3': 'Hard-hitting phonk track with heavy bass',
            'Phonk2.mp3': 'Dark phonk beats for maximum intensity'
        };
        
        this.musicDescription.textContent = descriptions[selectedMusic] || 'Music that plays during Flowstate mode';
    }
    
    // Flowstate Message Display
    showFlowstateMessage(message, duration = 500) {
        // Remove any existing flowstate message
        const existingMessage = document.querySelector('.flowstate-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Create new message element
        const messageElement = document.createElement('div');
        messageElement.className = 'flowstate-message';
        messageElement.textContent = message;
        document.body.appendChild(messageElement);
        
        // Show message with animation
        setTimeout(() => {
            messageElement.classList.add('show');
        }, 10);
        
        // Hide and remove message after duration
        setTimeout(() => {
            messageElement.classList.remove('show');
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 500); // Wait for fade out animation
        }, duration);
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