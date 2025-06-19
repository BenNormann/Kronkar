# Kronkar FPS 🎮

A browser-based first-person shooter inspired by Krunker.io, built with Babylon.js and Socket.IO for LAN multiplayer gaming.

## Features ✨

### Core Gameplay
- **FPS Controls**: WASD movement, mouse look, space to jump, left-click to shoot
- **Raycasting Shooting**: Server-side hit detection with visual bullet trails  
- **Health System**: 100 HP with damage indicators and respawn mechanics
- **Simple Map**: Ground plane with obstacles for cover and tactical gameplay

### Multiplayer (LAN)
- **Real-time Multiplayer**: Up to multiple players on local network
- **Player Synchronization**: Smooth movement interpolation for remote players
- **Hit Detection**: Server-authoritative combat system
- **Respawn System**: 3-second countdown with manual respawn option

### UI & UX
- **Modern UI**: Health bar, crosshair, player count, connection status
- **Death Screen**: Respawn countdown with manual override
- **Visual Effects**: Bullet trails, hit effects, damage indicators
- **Responsive Design**: Fullscreen game with pointer lock for FPS controls

## Quick Start 🚀

### Prerequisites
- Node.js (v14 or higher)
- NPM or Yarn
- Modern web browser (Chrome, Firefox, Edge)

### Installation

1. **Clone/Download the project**
   ```bash
   git clone <repository-url>
   cd kronkar-fps
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   For development (auto-restart on changes):
   ```bash
   npm run dev
   ```

4. **Connect players**
   - Open your browser to `http://localhost:3000`
   - For LAN play, other devices can connect using your IP address (shown in server console)
   - Example: `http://192.168.1.100:3000`

## Controls 🎮

| Action | Key/Mouse |
|--------|-----------|
| Move Forward | W |
| Move Backward | S |  
| Strafe Left | A |
| Strafe Right | D |
| Jump | Space |
| Shoot | Left Mouse Button |
| Look Around | Mouse Movement |
| Release Mouse | ESC |
| Respawn | R (when dead) |

## Game Mechanics 🎯

### Health & Combat
- Players start with 100 HP
- Each hit deals 34 damage (3 shots to kill)
- Server-side hit detection prevents cheating
- Visual hit effects and damage feedback

### Movement
- Standard FPS movement with gravity
- Jump height and movement speed balanced for gameplay
- Collision detection with obstacles

### Respawn System
- 3-second automatic respawn timer
- Manual respawn with R key or button click
- Random spawn point selection

## Technical Details 🔧

### Architecture
```
kronkar-fps/
├── server/
│   └── server.js          # Node.js + Socket.IO server
├── client/
│   ├── index.html         # Main game page
│   └── js/
│       ├── game.js        # Main game engine (Babylon.js)
│       ├── player.js      # Player controller & remote players
│       ├── network.js     # Socket.IO client networking
│       └── ui.js          # UI management
└── package.json           # Dependencies & scripts
```

### Technologies Used
- **Frontend**: Babylon.js 5.x, HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express, Socket.IO
- **Networking**: WebSocket-based real-time communication
- **Rendering**: WebGL via Babylon.js engine

### Network Events
| Event | Direction | Purpose |
|-------|-----------|---------|
| `playerUpdate` | Client → Server | Position/rotation sync |
| `playerShoot` | Client → Server | Shooting actions |
| `playerMoved` | Server → Client | Remote player updates |
| `playerKilled` | Server → Client | Death notifications |
| `playerRespawned` | Server → Client | Respawn events |

## LAN Setup Guide 🌐

### Finding Your IP Address

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**Mac/Linux:**
```bash
ifconfig
```
Look for "inet" address under your active network interface.

### Firewall Configuration
You may need to allow port 3000 through your firewall:

**Windows:**
- Windows Defender Firewall → Advanced Settings
- Inbound Rules → New Rule → Port → TCP → 3000

**Mac:**
- System Preferences → Security & Privacy → Firewall Options
- Add application → node (or allow incoming connections)

### Network Troubleshooting
- Ensure all devices are on the same network
- Check firewall settings allow port 3000
- Try disabling antivirus temporarily if connection fails
- Router may need port forwarding for some setups

## Development 🛠️

### Adding New Features
The codebase is modular and extensible:

- **New Weapons**: Modify shooting mechanics in `player.js`
- **Map Assets**: Replace placeholder geometry in `game.js:createDefaultMap()`
- **UI Elements**: Extend `ui.js` for new interface components
- **Network Events**: Add new Socket.IO events in `server.js` and `network.js`

### Performance Optimization
- Babylon.js engine settings can be tuned in `game.js:initBabylon()`
- Network update rates configurable in `network.js`
- Asset loading can be optimized with Babylon.js asset containers

### Debug Mode
Enable debug overlays:
```javascript
// In browser console
game.scene.debugLayer.show();
```

## Known Limitations ⚠️

This is a prototype focused on core mechanics:

- **No Custom Assets**: Uses placeholder models/textures
- **Basic Map**: Simple geometry, no complex level design  
- **No Progression**: No accounts, stats, or unlockables
- **LAN Only**: No public matchmaking or dedicated servers
- **No Audio**: Placeholder for sound effects/music
- **Limited Physics**: Basic collision detection only

## Roadmap 🗺️

Future enhancements could include:
- [ ] 3D model imports (.glb/.obj support)
- [ ] Sound effects and music
- [ ] Multiple weapon types
- [ ] Map editor/importer
- [ ] Bot opponents
- [ ] Kill streaks and power-ups
- [ ] Spectator mode
- [ ] Mobile device support

## License 📄

MIT License - Feel free to modify and extend for your projects!

## Contributing 🤝

This is a prototype project, but improvements are welcome:
1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly  
4. Submit a pull request with description

---

**Have fun fragging! 🎯💥** 