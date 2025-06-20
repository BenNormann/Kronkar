class AudioManager {
    constructor() {
        this.enabled = true;
        this.masterVolume = 1.0;
        this.soundCache = new Map();
        this.currentWalkingSound = null;
        
        
        // Initialize audio context for better browser compatibility
        this.audioContext = null;
        this.listener = null;
        this.initAudioContext();
        
        console.log('AudioManager initialized');
    }
    
    initAudioContext() {
        try {
            // Try to create audio context (required for modern browsers)
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            if (window.AudioContext) {
                this.audioContext = new AudioContext();
                this.listener = this.audioContext.listener;
                
                // Set up listener orientation (forward and up vectors) - coordinate system corrected
                if (this.listener.forwardX) {
                    // New Web Audio API - corrected for Babylon.js coordinate system
                    this.listener.forwardX.setValueAtTime(0, this.audioContext.currentTime);
                    this.listener.forwardY.setValueAtTime(0, this.audioContext.currentTime);
                    this.listener.forwardZ.setValueAtTime(1, this.audioContext.currentTime); // Positive Z for forward
                    this.listener.upX.setValueAtTime(0, this.audioContext.currentTime);
                    this.listener.upY.setValueAtTime(1, this.audioContext.currentTime);
                    this.listener.upZ.setValueAtTime(0, this.audioContext.currentTime);
                } else if (this.listener.setOrientation) {
                    // Legacy Web Audio API - corrected coordinate system
                    this.listener.setOrientation(0, 0, 1, 0, 1, 0);
                }
                
                console.log('3D Audio context created successfully');
            }
        } catch (error) {
            console.warn('Could not create audio context:', error);
        }
    }
    
    // Resume audio context (required for Chrome autoplay policy)
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('Audio context resumed');
            } catch (error) {
                console.warn('Could not resume audio context:', error);
            }
        }
    }

    // Update 3D listener position and orientation
    updateListener(position, forward, up) {
        if (!this.listener || !this.audioContext) return;
        
        try {
            const currentTime = this.audioContext.currentTime;
            
            // Update listener position
            if (this.listener.positionX) {
                // New Web Audio API
                this.listener.positionX.setValueAtTime(position.x, currentTime);
                this.listener.positionY.setValueAtTime(position.y, currentTime);
                this.listener.positionZ.setValueAtTime(position.z, currentTime);
                
                // Update orientation - invert forward direction only (Babylon.js vs Web Audio API convention)
                this.listener.forwardX.setValueAtTime(-forward.x, currentTime);
                this.listener.forwardY.setValueAtTime(-forward.y, currentTime);
                this.listener.forwardZ.setValueAtTime(-forward.z, currentTime);
                this.listener.upX.setValueAtTime(up.x, currentTime);
                this.listener.upY.setValueAtTime(up.y, currentTime);
                this.listener.upZ.setValueAtTime(up.z, currentTime);
            } else if (this.listener.setPosition && this.listener.setOrientation) {
                // Legacy Web Audio API
                this.listener.setPosition(position.x, position.y, position.z);
                this.listener.setOrientation(-forward.x, -forward.y, -forward.z, up.x, up.y, up.z);
            }
        } catch (error) {
            console.warn('Error updating 3D audio listener:', error);
        }
    }
    
    // Play a sound effect
    async playSound(soundPath, volume = 1.0, loop = false) {
        if (!this.enabled) return null;
        
        try {
            // Resume audio context if needed (for browser autoplay policies)
            await this.resumeAudioContext();
            
            // Check if sound is already cached
            let audio;
            if (this.soundCache.has(soundPath)) {
                // Clone the cached audio for concurrent playback
                const cachedAudio = this.soundCache.get(soundPath);
                audio = cachedAudio.cloneNode();
            } else {
                // Create new audio element
                audio = new Audio(soundPath);
                audio.preload = 'auto';
                
                // Cache the audio for future use
                this.soundCache.set(soundPath, audio.cloneNode());
            }
            
            // Set audio properties
            audio.volume = Math.min(1.0, Math.max(0.0, volume * this.masterVolume));
            audio.loop = loop;
            
            // Play the sound
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                return playPromise.then(() => {
                    console.log(`Playing sound: ${soundPath} at volume ${audio.volume}`);
                    return audio;
                }).catch(error => {
                    console.warn(`Could not play sound ${soundPath}:`, error);
                    return null;
                });
            }
            
            return audio;
            
        } catch (error) {
            console.error(`Error playing sound ${soundPath}:`, error);
            return null;
        }
    }
    
    // Play weapon fire sound
    async playWeaponSound(weaponConfig) {
        if (!weaponConfig || !weaponConfig.audio || !weaponConfig.audio.fireSound) {
            console.warn('No fire sound configured for weapon');
            return;
        }
        
        return this.playSound(weaponConfig.audio.fireSound, weaponConfig.audio.volume || 1.0);
    }
    
    // Play damage/hit sound
    async playDamageSound() {
        return this.playSound('assets/sounds/OOF.m4a', 0.7);
    }
    
    // Play reload sound
    async playReloadSound(weaponConfig) {
        if (!weaponConfig || !weaponConfig.audio || !weaponConfig.audio.reloadSound) {
            console.warn('No reload sound configured for weapon');
            return;
        }
        
        return this.playSound(weaponConfig.audio.reloadSound, weaponConfig.audio.volume * 0.8 || 0.8);
    }
    
    // Play walking sound with individual steps for local player
    async playWalkingSound(isSprinting = false) {
        const timerKey = 'localWalkingTimer';
        
        // Check if already playing step sequence
        if (this.soundCache.has(timerKey)) {
            return; // Already playing
        }
        
        // Start local step sequence
        this.playLocalStepSequence(isSprinting);
        return true;
    }

    // Play sequence of individual step sounds for local player
    playLocalStepSequence(isSprinting) {
        const timerKey = 'localWalkingTimer';
        const stepSounds = [
            'assets/sounds/steps/step1.mp3',
            'assets/sounds/steps/step2.mp3',
            'assets/sounds/steps/step3.mp3',
            'assets/sounds/steps/step4.mp3',
            'assets/sounds/steps/step5.mp3'
        ];
        
        const playRandomStep = async () => {
            // Pick random step sound
            const randomStep = stepSounds[Math.floor(Math.random() * stepSounds.length)];
            
            try {
                // For local player, use regular audio (no 3D positioning needed)
                let audio;
                if (this.soundCache.has(randomStep)) {
                    const cachedAudio = this.soundCache.get(randomStep);
                    audio = cachedAudio.cloneNode();
                } else {
                    audio = new Audio(randomStep);
                    audio.preload = 'auto';
                    this.soundCache.set(randomStep, audio.cloneNode());
                }
                
                // Set volume and playback rate for local player
                audio.volume = Math.min(1.0, Math.max(0.0, 0.4 * this.masterVolume)); // Slightly louder for local player
                audio.playbackRate = isSprinting ? 1.4 : 1.0; // Speed up for sprinting
                
                // Play the step
                await audio.play().catch(error => {
                    console.warn(`Could not play local step sound:`, error);
                });
                
            } catch (error) {
                console.warn(`Error playing local step sound:`, error);
            }
        };
        
        // Set step timing based on sprinting (1.5x faster)
        const stepInterval = isSprinting ? 200 : 333; // 1.5x faster steps (was 300/500ms)
        
        // Play first step immediately
        playRandomStep();
        
        // Set up interval for subsequent steps
        const intervalId = setInterval(playRandomStep, stepInterval);
        
        // Cache the timer so we can stop it later
        this.soundCache.set(timerKey, intervalId);
        this.currentWalkingSound = { paused: false }; // Maintain compatibility with existing code
    }
    
    // Stop walking sound
    stopWalkingSound() {
        const timerKey = 'localWalkingTimer';
        if (this.soundCache.has(timerKey)) {
            const intervalId = this.soundCache.get(timerKey);
            try {
                clearInterval(intervalId);
            } catch (error) {
                console.warn(`Error stopping local walking timer:`, error);
            }
            this.soundCache.delete(timerKey);
        }
        this.currentWalkingSound = null;
    }

    // Calculate distance-based volume for 3D audio
    calculateDistanceVolume(listenerPosition, sourcePosition, maxDistance = 200, baseVolume = 1.0) {
        const distance = BABYLON.Vector3.Distance(listenerPosition, sourcePosition);
        
        // If beyond max distance, no sound
        if (distance >= maxDistance) {
            return 0;
        }
        
        // Linear falloff from baseVolume to 0 over maxDistance
        const volumeMultiplier = Math.max(0, 1 - (distance / maxDistance));
        return baseVolume * volumeMultiplier;
    }

    // Play 3D positional sound for remote players
    async play3DSound(soundPath, listenerPosition, sourcePosition, baseVolume = 1.0, maxDistance = 200, loop = false) {
        if (!this.enabled) return null;
        
        // Use Web Audio API for true 3D positioning if available
        if (this.audioContext && this.listener) {
            return this.playPositionalAudio(soundPath, sourcePosition, baseVolume, maxDistance, loop);
        } else {
            // Fallback to distance-based volume
            const volume = this.calculateDistanceVolume(listenerPosition, sourcePosition, maxDistance, baseVolume);
            
            // Don't play if volume is too low (beyond hearing range)
            if (volume <= 0.01) {
                return null;
            }
            
            return this.playSound(soundPath, volume, loop);
        }
    }

    // Play true 3D positional audio using Web Audio API
    async playPositionalAudio(soundPath, sourcePosition, baseVolume = 1.0, maxDistance = 200, loop = false) {
        const result = await this.playPositionalAudioWithPanner(soundPath, sourcePosition, baseVolume, maxDistance, loop);
        return result ? result.source : null;
    }

    // Play true 3D positional audio and return both source and panner for position updates
    async playPositionalAudioWithPanner(soundPath, sourcePosition, baseVolume = 1.0, maxDistance = 200, loop = false) {
        if (!this.audioContext || !this.listener) return null;
        
        try {
            // Resume audio context if needed
            await this.resumeAudioContext();
            
            // Get or create audio buffer
            let audioBuffer;
            if (this.soundCache.has(soundPath + '_buffer')) {
                audioBuffer = this.soundCache.get(soundPath + '_buffer');
            } else {
                // Load and decode audio file
                const response = await fetch(soundPath);
                const arrayBuffer = await response.arrayBuffer();
                audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.soundCache.set(soundPath + '_buffer', audioBuffer);
            }
            
            // Create audio nodes
            const source = this.audioContext.createBufferSource();
            const panner = this.audioContext.createPanner();
            const gainNode = this.audioContext.createGain();
            
            // Configure buffer source
            source.buffer = audioBuffer;
            source.loop = loop;
            
            // Configure panner for 3D positioning
            panner.panningModel = 'HRTF'; // Head-related transfer function for realistic 3D
            panner.distanceModel = 'linear'; // Linear falloff is less aggressive than inverse
            panner.refDistance = maxDistance * 0.1; // 10% of max distance for reference
            panner.maxDistance = maxDistance;
            panner.rolloffFactor = 0.3; // Much lower rolloff for longer range audio
            
            // Set 3D position
            if (panner.positionX) {
                // New Web Audio API
                panner.positionX.setValueAtTime(sourcePosition.x, this.audioContext.currentTime);
                panner.positionY.setValueAtTime(sourcePosition.y, this.audioContext.currentTime);
                panner.positionZ.setValueAtTime(sourcePosition.z, this.audioContext.currentTime);
            } else if (panner.setPosition) {
                // Legacy Web Audio API
                panner.setPosition(sourcePosition.x, sourcePosition.y, sourcePosition.z);
            }
            
            // Configure gain
            gainNode.gain.setValueAtTime(baseVolume * this.masterVolume, this.audioContext.currentTime);
            
            // Connect audio graph: source -> panner -> gain -> destination
            source.connect(panner);
            panner.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Start playback
            source.start(0);
            
            // Return both source and panner for position updates
            return { source, panner };
            
        } catch (error) {
            console.warn(`Error playing 3D positional audio ${soundPath}:`, error);
            return null;
        }
    }

    // Play remote player weapon sound
    async playRemoteWeaponSound(weaponConfig, listenerPosition, sourcePosition) {
        if (!weaponConfig || !weaponConfig.audio || !weaponConfig.audio.fireSound) {
            return null;
        }
        
        return this.play3DSound(
            weaponConfig.audio.fireSound, 
            listenerPosition, 
            sourcePosition, 
            weaponConfig.audio.volume || 1.0, 
            2000 // Much longer range for weapon sounds
        );
    }

    // Play remote player damage sound
    async playRemoteDamageSound(listenerPosition, sourcePosition) {
        return this.play3DSound(
            'assets/sounds/OOF.m4a', 
            listenerPosition, 
            sourcePosition, 
            0.8, 
            800 // Increased range for damage sounds
        );
    }

    // Play remote player walking sound with individual steps
    async playRemoteWalkingSound(playerId, sourcePosition, isSprinting = false) {
        const timerKey = `walkingTimer_${playerId}`;
        
        // Check if this player already has a walking timer running
        if (this.soundCache.has(timerKey)) {
            return; // Already playing step sequence
        }
        
        // Start step sequence using the same 3D audio as weapons
        this.playStepSequence(playerId, sourcePosition, isSprinting);
        
        return true;
    }

    // Update position for a player's walking sounds - called when player moves
    updateWalkingSoundPosition(playerId, newPosition) {
        // Store the latest position for this player
        this.soundCache.set(`walkingPosition_${playerId}`, newPosition);
    }

    // Play sequence of individual step sounds using proper 3D audio
    playStepSequence(playerId, initialPosition, isSprinting) {
        const timerKey = `walkingTimer_${playerId}`;
        const stepSounds = [
            'assets/sounds/steps/step1.mp3',
            'assets/sounds/steps/step2.mp3',
            'assets/sounds/steps/step3.mp3',
            'assets/sounds/steps/step4.mp3',
            'assets/sounds/steps/step5.mp3'
        ];
        
        // Store initial position
        this.soundCache.set(`walkingPosition_${playerId}`, initialPosition);
        
        const playRandomStep = async () => {
            // Get current position for this player (updated in real-time)
            const currentPosition = this.soundCache.get(`walkingPosition_${playerId}`) || initialPosition;
            
            // Pick random step sound
            const randomStep = stepSounds[Math.floor(Math.random() * stepSounds.length)];
            
            try {
                // Use current position for each step - this gives real-time 3D positioning
                const source = await this.playPositionalAudio(
                    randomStep, 
                    currentPosition, 
                    0.6, // Base volume for footsteps
                    1200, // Range for footsteps
                    false
                );
                
                // Set playback rate for sprinting
                if (source && source.playbackRate) {
                    source.playbackRate.setValueAtTime(
                        isSprinting ? 1.4 : 1.0, 
                        this.audioContext.currentTime
                    );
                }
                
            } catch (error) {
                console.warn(`Error playing step sound:`, error);
            }
        };
        
        // Set step timing based on sprinting (1.5x faster)
        const stepInterval = isSprinting ? 200 : 333;
        
        // Play first step immediately
        playRandomStep();
        
        // Set up interval for subsequent steps
        const intervalId = setInterval(playRandomStep, stepInterval);
        
        // Cache the timer so we can stop it later
        this.soundCache.set(timerKey, intervalId);
    }

    // Stop remote player walking sound
    stopRemoteWalkingSound(playerId) {
        const timerKey = `walkingTimer_${playerId}`;
        const positionKey = `walkingPosition_${playerId}`;
        
        if (this.soundCache.has(timerKey)) {
            const intervalId = this.soundCache.get(timerKey);
            try {
                clearInterval(intervalId);
            } catch (error) {
                console.warn(`Error stopping walking timer for player ${playerId}:`, error);
            }
            this.soundCache.delete(timerKey);
        }
        
        // Clean up position cache
        this.soundCache.delete(positionKey);
    }
    
    // Preload commonly used sounds
    async preloadSounds() {
        const soundsToPreload = [
            'assets/sounds/Bulldog.m4a',
            'assets/sounds/Sniper.m4a',
            'assets/sounds/OOF.m4a',
            'assets/sounds/Reload.m4a',
            // Individual step sounds
            'assets/sounds/steps/step1.mp3',
            'assets/sounds/steps/step2.mp3',
            'assets/sounds/steps/step3.mp3',
            'assets/sounds/steps/step4.mp3',
            'assets/sounds/steps/step5.mp3'
        ];
        
        console.log('Preloading sounds...');
        
        for (const soundPath of soundsToPreload) {
            try {
                const audio = new Audio(soundPath);
                audio.preload = 'auto';
                audio.volume = 0; // Silent preload
                
                // Cache the audio
                this.soundCache.set(soundPath, audio);
                
                // Trigger loading
                await audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                }).catch(() => {
                    // Ignore preload play errors (autoplay restrictions)
                });
                
                console.log(`Preloaded: ${soundPath}`);
            } catch (error) {
                console.warn(`Could not preload ${soundPath}:`, error);
            }
        }
        
        console.log('Sound preloading complete');
    }
    
    // Set master volume (0.0 to 1.0)
    setMasterVolume(volume) {
        this.masterVolume = Math.min(1.0, Math.max(0.0, volume));
        console.log(`Master volume set to: ${this.masterVolume}`);
    }
    
    // Enable/disable audio
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`Audio ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Stop all sounds
    stopAllSounds() {
        // Stop walking sound
        this.stopWalkingSound();
        
        // Stop all cached audio elements
        this.soundCache.forEach((audio, key) => {
            try {
                if (!audio.paused && !audio.ended) {
                audio.pause();
                audio.currentTime = 0;
                }
            } catch (error) {
                console.warn(`Error stopping sound ${key}:`, error);
            }
        });
    }

    // Clean up stuck walking sounds (call periodically)
    cleanupStuckSounds() {
        const keysToRemove = [];
        this.soundCache.forEach((item, key) => {
            if (key.startsWith('walkingTimer_')) {
                // These should be interval IDs, just verify they exist
                try {
                    if (typeof item !== 'number') {
                        keysToRemove.push(key);
                    }
                } catch (error) {
                    keysToRemove.push(key);
                }
            } else if (key.startsWith('walking_')) {
                // Old walking sound cleanup (shouldn't exist with new system)
                keysToRemove.push(key);
            }
        });
        
        keysToRemove.forEach(key => {
            if (key.startsWith('walkingTimer_') || key === 'localWalkingTimer') {
                try {
                    clearInterval(this.soundCache.get(key));
                } catch (error) {
                    // Ignore errors when clearing intervals
                }
            }
            this.soundCache.delete(key);
        });
    }
    
    // Clean up resources
    dispose() {
        this.stopAllSounds();
        this.soundCache.clear();
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        console.log('AudioManager disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioManager;
} else {
    window.AudioManager = AudioManager;
} 