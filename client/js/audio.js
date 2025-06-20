class AudioManager {
    constructor() {
        this.enabled = true;
        this.masterVolume = 1.0;
        this.soundCache = new Map();
        this.currentWalkingSound = null;
        
        // Initialize audio context for better browser compatibility
        this.audioContext = null;
        this.initAudioContext();
        
        console.log('AudioManager initialized');
    }
    
    initAudioContext() {
        try {
            // Try to create audio context (required for modern browsers)
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            if (window.AudioContext) {
                this.audioContext = new AudioContext();
                console.log('Audio context created successfully');
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
    
    // Play walking sound (looped)
    async playWalkingSound() {
        if (this.currentWalkingSound && !this.currentWalkingSound.paused) {
            return this.currentWalkingSound; // Already playing
        }
        
        this.currentWalkingSound = await this.playSound('assets/sounds/walking.m4a', 0.3, true);
        return this.currentWalkingSound;
    }
    
    // Stop walking sound
    stopWalkingSound() {
        if (this.currentWalkingSound && !this.currentWalkingSound.paused) {
            this.currentWalkingSound.pause();
            this.currentWalkingSound.currentTime = 0;
        }
    }
    
    // Preload commonly used sounds
    async preloadSounds() {
        const soundsToPreload = [
            'assets/sounds/Bulldog.m4a',
            'assets/sounds/Sniper.m4a',
            'assets/sounds/OOF.m4a',
            'assets/sounds/Reload.m4a',
            'assets/sounds/walking.m4a'
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
        this.soundCache.forEach((audio) => {
            if (!audio.paused) {
                audio.pause();
                audio.currentTime = 0;
            }
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