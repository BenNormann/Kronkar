# Flowstate System Implementation Plan

## Overview
The Flowstate system is a dynamic visual and audio enhancement that triggers after getting kills, creating an immersive experience that scales with consecutive kills.

## Core Features
1. **Trigger**: Activates after first kill
2. **Visual Effects**: Dims environment, highlights players in red
3. **Audio**: Plays selected music from songs folder
4. **Scaling**: Both effects intensify with consecutive kills (up to 10)
5. **Reset**: System resets on player death

## Implementation Steps

### Step 1: Add Music Selection to Welcome Menu
- Add music dropdown to the welcome screen in `client/index.html`
- Update `client/js/ui.js` to handle music selection
- Store selected music in localStorage

### Step 2: Create Flowstate Manager
- Create new `client/js/flowstate.js` file
- Implement FlowstateManager class with:
  - Kill streak tracking
  - Visual effect management (dimming/highlighting)
  - Music playback control
  - Message display system

### Step 3: Integrate Visual Effects System
- Modify `client/js/game.js` to support post-processing effects
- Create dimming overlay system
- Implement player highlighting using Babylon.js materials
- Add smooth transition animations

### Step 4: Enhance Audio System
- Extend `client/js/audio.js` to support background music
- Add volume control for dynamic music scaling
- Implement smooth volume transitions

### Step 5: UI Messages System
- Extend `client/js/ui.js` with fade-in/fade-out message system
- Create "Starting Flowstate" and "Flowstate" messages
- Add proper CSS animations

### Step 6: Integration Points
- Hook kill events in `client/js/network.js`
- Hook death events in `client/js/player.js`
- Update game loop in `client/js/game.js` for visual effects

### Step 7: Settings and Persistence
- Add Flowstate settings to settings menu
- Store user preferences (music choice, effect intensity)
- Add toggle to disable Flowstate if desired

## Technical Details

### Visual Effect Intensity Scaling
- **Kill 1**: 10% effect intensity (0.1x)
- **Kill 2-9**: +10% per kill (0.2x, 0.3x, ... 0.9x)
- **Kill 10+**: 100% effect intensity (1.0x)

### Audio Volume Scaling
- **Kill 1**: 10% of max volume (0.1x)
- **Kill 2-9**: +10% per kill (0.2x, 0.3x, ... 0.9x)
- **Kill 10+**: 100% of max volume (1.0x)

### Visual Implementation Strategy
- Use Babylon.js post-processing pipeline for dimming effects
- Apply emissive materials to remote player meshes for red highlighting
- Create overlay system for smooth transitions

### Performance Considerations
- Cache music files for smooth playback
- Optimize visual effects to maintain 60 FPS
- Use requestAnimationFrame for smooth animations
- Minimize DOM manipulation during gameplay

## Files to Modify
1. `client/index.html` - Add music selection dropdown
2. `client/js/ui.js` - Music selection UI handling + message system
3. `client/js/audio.js` - Background music support
4. `client/js/game.js` - Visual effects integration
5. `client/js/player.js` - Death event hooks
6. `client/js/network.js` - Kill event hooks
7. `client/js/flowstate.js` - **NEW** Main flowstate manager

## Testing Strategy
1. Test music selection and persistence
2. Verify kill detection and streak counting
3. Test visual effects at different intensities
4. Verify audio volume scaling
5. Test death reset functionality
6. Performance testing under various conditions

## Implementation Order
Execute steps 1-7 sequentially, testing each component before moving to the next. This ensures a stable, working system at each stage. 