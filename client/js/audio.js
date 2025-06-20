class AudioManager {
    constructor() {
        this.enabled = true;
        this.masterVolume = 1.0;
        this.soundCache = new Map();
        this.currentWalkingSound = null;
        this.activeAudioSources = new Map();
        this.maxConcurrentSources = 20;
        
        // Audio context
        this.audioContext = null;
        this.listener = null;
        
        // Performance optimizations
        this.lastListenerUpdate = 0;
        this.lastCleanup = 0;
        
        this.initAudioContext();
        console.log('AudioManager initialized');
    }
    
    initAudioContext() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            if (window.AudioContext) {
                this.audioContext = new AudioContext();
                this.listener = this.audioContext.listener;
                
                if (this.listener.forwardX) {
                    const time = this.audioContext.currentTime;
                    this.listener.forwardX.setValueAtTime(0, time);
                    this.listener.forwardY.setValueAtTime(0, time);
                    this.listener.forwardZ.setValueAtTime(1, time);
                    this.listener.upX.setValueAtTime(0, time);
                    this.listener.upY.setValueAtTime(1, time);
                    this.listener.upZ.setValueAtTime(0, time);
                } else if (this.listener.setOrientation) {
                    this.listener.setOrientation(0, 0, 1, 0, 1, 0);
                }
                
                console.log('3D Audio context created successfully');
            }
        } catch (error) {
            console.warn('Could not create audio context:', error);
        }
    }
    
    async resumeAudioContext() {
        if (this.audioContext?.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.warn('Could not resume audio context:', error);
            }
        }
    }

    updateListener(position, forward, up) {
        if (!this.listener || !this.audioContext) return;
        
        try {
            const currentTime = this.audioContext.currentTime;
            
            if (this.listener.positionX) {
                this.listener.positionX.setValueAtTime(position.x, currentTime);
                this.listener.positionY.setValueAtTime(position.y, currentTime);
                this.listener.positionZ.setValueAtTime(position.z, currentTime);
                this.listener.forwardX.setValueAtTime(-forward.x, currentTime);
                this.listener.forwardY.setValueAtTime(-forward.y, currentTime);
                this.listener.forwardZ.setValueAtTime(-forward.z, currentTime);
                this.listener.upX.setValueAtTime(up.x, currentTime);
                this.listener.upY.setValueAtTime(up.y, currentTime);
                this.listener.upZ.setValueAtTime(up.z, currentTime);
            } else if (this.listener.setPosition && this.listener.setOrientation) {
                this.listener.setPosition(position.x, position.y, position.z);
                this.listener.setOrientation(-forward.x, -forward.y, -forward.z, up.x, up.y, up.z);
            }
        } catch (error) {
            console.warn('Error updating 3D audio listener:', error);
        }
    }
    
    async playSound(soundPath, volume = 1.0, loop = false) {
        if (!this.enabled) return null;
        
        try {
            await this.resumeAudioContext();
            
            let audio;
            if (this.soundCache.has(soundPath)) {
                const cachedAudio = this.soundCache.get(soundPath);
                audio = cachedAudio.cloneNode();
            } else {
                audio = new Audio(soundPath);
                audio.preload = 'auto';
                this.soundCache.set(soundPath, audio.cloneNode());
            }
            
            audio.volume = Math.min(1.0, Math.max(0.0, volume * this.masterVolume));
            audio.loop = loop;
            
            // Auto-cleanup
            audio.addEventListener('ended', () => audio.remove());
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                return playPromise.then(() => audio).catch(error => {
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
    
    // Optimized distance calculation using squared distance
    calculateDistanceVolume(listenerPosition, sourcePosition, maxDistance = 200, baseVolume = 1.0) {
        const dx = listenerPosition.x - sourcePosition.x;
        const dy = listenerPosition.y - sourcePosition.y;
        const dz = listenerPosition.z - sourcePosition.z;
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        const maxDistanceSquared = maxDistance * maxDistance;
        
        if (distanceSquared >= maxDistanceSquared) return 0;
        
        const distance = Math.sqrt(distanceSquared);
        return baseVolume * Math.max(0, 1 - (distance / maxDistance));
    }

    async play3DSound(soundPath, listenerPosition, sourcePosition, baseVolume = 1.0, maxDistance = 200, loop = false) {
        if (!this.enabled) return null;
        
        if (this.audioContext && this.listener) {
            return this.playPositionalAudio(soundPath, sourcePosition, baseVolume, maxDistance, loop);
        } else {
            const volume = this.calculateDistanceVolume(listenerPosition, sourcePosition, maxDistance, baseVolume);
            return volume <= 0.01 ? null : this.playSound(soundPath, volume, loop);
        }
    }

    async playPositionalAudio(soundPath, sourcePosition, baseVolume = 1.0, maxDistance = 200, loop = false) {
        const result = await this.playPositionalAudioWithPanner(soundPath, sourcePosition, baseVolume, maxDistance, loop);
        return result?.source || null;
    }

    async playPositionalAudioWithPanner(soundPath, sourcePosition, baseVolume = 1.0, maxDistance = 200, loop = false) {
        if (!this.audioContext || !this.listener) return null;
        
        // Limit concurrent sources
        if (this.activeAudioSources.size >= this.maxConcurrentSources) {
            console.warn('Too many concurrent audio sources, skipping sound');
            return null;
        }
        
        try {
            await this.resumeAudioContext();
            
            // Get or create audio buffer
            let audioBuffer;
            const bufferKey = soundPath + '_buffer';
            if (this.soundCache.has(bufferKey)) {
                audioBuffer = this.soundCache.get(bufferKey);
            } else {
                const response = await fetch(soundPath);
                const arrayBuffer = await response.arrayBuffer();
                audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.soundCache.set(bufferKey, audioBuffer);
            }
            
            // Create audio nodes
            const source = this.audioContext.createBufferSource();
            const panner = this.audioContext.createPanner();
            const gainNode = this.audioContext.createGain();
            
            // Configure
            source.buffer = audioBuffer;
            source.loop = loop;
            
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'linear';
            panner.refDistance = maxDistance * 0.1;
            panner.maxDistance = maxDistance;
            panner.rolloffFactor = 0.3;
            
            // Set position
            const currentTime = this.audioContext.currentTime;
            if (panner.positionX) {
                panner.positionX.setValueAtTime(sourcePosition.x, currentTime);
                panner.positionY.setValueAtTime(sourcePosition.y, currentTime);
                panner.positionZ.setValueAtTime(sourcePosition.z, currentTime);
            } else if (panner.setPosition) {
                panner.setPosition(sourcePosition.x, sourcePosition.y, sourcePosition.z);
            }
            
            gainNode.gain.setValueAtTime(baseVolume * this.masterVolume, currentTime);
            
            // Connect
            source.connect(panner);
            panner.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Track and cleanup
            const sourceId = Date.now() + '_' + Math.random();
            this.activeAudioSources.set(sourceId, { source, panner, gainNode });
            
            source.onended = () => {
                this.activeAudioSources.delete(sourceId);
                try {
                    source.disconnect();
                    panner.disconnect();
                    gainNode.disconnect();
                } catch (error) {
                    // Ignore cleanup errors
                }
            };
            
            source.start(0);
            return { source, panner };
            
        } catch (error) {
            console.warn(`Error playing 3D positional audio ${soundPath}:`, error);
            return null;
        }
    }

    // Weapon sounds
    async playWeaponSound(weaponConfig) {
        if (!weaponConfig?.audio?.fireSound) {
            console.warn('No fire sound configured for weapon');
            return;
        }
        return this.playSound(weaponConfig.audio.fireSound, weaponConfig.audio.volume || 1.0);
    }

    async playRemoteWeaponSound(weaponConfig, listenerPosition, sourcePosition) {
        if (!weaponConfig?.audio?.fireSound) return null;
        return this.play3DSound(weaponConfig.audio.fireSound, listenerPosition, sourcePosition, weaponConfig.audio.volume || 1.0, 2000);
    }

    // Damage sounds
    async playDamageSound() {
        return this.playSound('assets/sounds/OOF.m4a', 0.7);
    }

    async playRemoteDamageSound(listenerPosition, sourcePosition) {
        return this.play3DSound('assets/sounds/OOF.m4a', listenerPosition, sourcePosition, 0.8, 800);
    }

    // Reload sounds
    async playReloadSound(weaponConfig) {
        if (!weaponConfig?.audio?.reloadSound) {
            console.warn('No reload sound configured for weapon');
            return;
        }
        return this.playSound(weaponConfig.audio.reloadSound, (weaponConfig.audio.volume || 1.0) * 0.8);
    }
    
    // Walking sounds
    async playWalkingSound(isSprinting = false) {
        const timerKey = 'localWalkingTimer';
        if (this.soundCache.has(timerKey)) return;
        
        this.playLocalStepSequence(isSprinting);
        return true;
    }

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
            const randomStep = stepSounds[Math.floor(Math.random() * stepSounds.length)];
            
            try {
                let audio;
                if (this.soundCache.has(randomStep)) {
                    audio = this.soundCache.get(randomStep).cloneNode();
                } else {
                    audio = new Audio(randomStep);
                    audio.preload = 'auto';
                    this.soundCache.set(randomStep, audio.cloneNode());
                }
                
                audio.volume = Math.min(1.0, Math.max(0.0, 0.4 * this.masterVolume));
                audio.playbackRate = isSprinting ? 1.4 : 1.0;
                audio.addEventListener('ended', () => audio.remove());
                
                await audio.play().catch(error => {
                    console.warn('Could not play local step sound:', error);
                });
            } catch (error) {
                console.warn('Error playing local step sound:', error);
            }
        };
        
        const stepInterval = isSprinting ? 200 : 333;
        playRandomStep();
        
        const intervalId = setInterval(playRandomStep, stepInterval);
        this.soundCache.set(timerKey, intervalId);
        this.currentWalkingSound = { paused: false };
    }
    
    stopWalkingSound() {
        const timerKey = 'localWalkingTimer';
        if (this.soundCache.has(timerKey)) {
            clearInterval(this.soundCache.get(timerKey));
            this.soundCache.delete(timerKey);
        }
        this.currentWalkingSound = null;
    }

    async playRemoteWalkingSound(playerId, sourcePosition, isSprinting = false) {
        const timerKey = `walkingTimer_${playerId}`;
        if (this.soundCache.has(timerKey)) return;
        
        this.playStepSequence(playerId, sourcePosition, isSprinting);
        return true;
    }

    updateWalkingSoundPosition(playerId, newPosition) {
        const positionKey = `walkingPosition_${playerId}`;
        const lastPosition = this.soundCache.get(positionKey);
        
        if (!lastPosition || BABYLON.Vector3.Distance(lastPosition, newPosition) > 0.1) {
            this.soundCache.set(positionKey, newPosition.clone());
        }
    }

    playStepSequence(playerId, initialPosition, isSprinting) {
        const timerKey = `walkingTimer_${playerId}`;
        const stepSounds = [
            'assets/sounds/steps/step1.mp3',
            'assets/sounds/steps/step2.mp3',
            'assets/sounds/steps/step3.mp3',
            'assets/sounds/steps/step4.mp3',
            'assets/sounds/steps/step5.mp3'
        ];
        
        this.soundCache.set(`walkingPosition_${playerId}`, initialPosition);
        
        const playRandomStep = async () => {
            const currentPosition = this.soundCache.get(`walkingPosition_${playerId}`) || initialPosition;
            const randomStep = stepSounds[Math.floor(Math.random() * stepSounds.length)];
            
            try {
                const source = await this.playPositionalAudio(randomStep, currentPosition, 0.6, 1200, false);
                
                if (source?.playbackRate) {
                    source.playbackRate.setValueAtTime(isSprinting ? 1.4 : 1.0, this.audioContext.currentTime);
                }
            } catch (error) {
                console.warn('Error playing step sound:', error);
            }
        };
        
        const stepInterval = isSprinting ? 250 : 400;
        playRandomStep();
        
        const intervalId = setInterval(playRandomStep, stepInterval);
        this.soundCache.set(timerKey, intervalId);
    }

    stopRemoteWalkingSound(playerId) {
        const timerKey = `walkingTimer_${playerId}`;
        const positionKey = `walkingPosition_${playerId}`;
        
        if (this.soundCache.has(timerKey)) {
            clearInterval(this.soundCache.get(timerKey));
            this.soundCache.delete(timerKey);
        }
        this.soundCache.delete(positionKey);
    }
    
    async preloadSounds() {
        const soundsToPreload = [
            'assets/sounds/Bulldog.m4a',
            'assets/sounds/Sniper.m4a',
            'assets/sounds/OOF.m4a',
            'assets/sounds/Reload.m4a',
            'assets/sounds/steps/step1.mp3',
            'assets/sounds/steps/step2.mp3',
            'assets/sounds/steps/step3.mp3',
            'assets/sounds/steps/step4.mp3',
            'assets/sounds/steps/step5.mp3'
        ];
        
        console.log('Preloading sounds...');
        
        const preloadPromises = soundsToPreload.map(async (soundPath) => {
            try {
                const audio = new Audio(soundPath);
                audio.preload = 'auto';
                audio.volume = 0;
                this.soundCache.set(soundPath, audio);
                
                await audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                }).catch(() => {
                    // Ignore autoplay restriction errors
                });
                
                console.log(`Preloaded: ${soundPath}`);
            } catch (error) {
                console.warn(`Could not preload ${soundPath}:`, error);
            }
        });
        
        await Promise.all(preloadPromises);
        console.log('Sound preloading complete');
    }
    
    // Efficient cleanup - called periodically
    cleanupStuckSounds() {
        const now = performance.now();
        if (now - this.lastCleanup < 5000) return; // Only cleanup every 5 seconds
        this.lastCleanup = now;
        
        // Clean up finished audio sources
        const sourcesToRemove = [];
        this.activeAudioSources.forEach((audioData, sourceId) => {
            try {
                if (!audioData.source || audioData.source.playbackState === 'finished') {
                    sourcesToRemove.push(sourceId);
                }
            } catch (error) {
                sourcesToRemove.push(sourceId);
            }
        });
        
        sourcesToRemove.forEach(sourceId => {
            const audioData = this.activeAudioSources.get(sourceId);
            if (audioData) {
                try {
                    audioData.source.disconnect();
                    audioData.panner.disconnect();
                    audioData.gainNode.disconnect();
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
            this.activeAudioSources.delete(sourceId);
        });
    }
    
    setMasterVolume(volume) {
        this.masterVolume = Math.min(1.0, Math.max(0.0, volume));
        console.log(`Master volume set to: ${this.masterVolume}`);
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`Audio ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    stopAllSounds() {
        this.stopWalkingSound();
        
        this.soundCache.forEach((audio, key) => {
            try {
                if (typeof audio === 'number') {
                    clearInterval(audio); // Walking timers
                } else if (audio && !audio.paused && !audio.ended) {
                    audio.pause();
                    audio.currentTime = 0;
                }
            } catch (error) {
                console.warn(`Error stopping sound ${key}:`, error);
            }
        });
    }
    
    dispose() {
        this.stopAllSounds();
        this.soundCache.clear();
        this.activeAudioSources.clear();
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        console.log('AudioManager disposed');
    }
}

// Auto-cleanup every 10 seconds
setInterval(() => {
    if (window.audioManager) {
        window.audioManager.cleanupStuckSounds();
    }
}, 10000);

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioManager;
} else {
    window.AudioManager = AudioManager;
}

