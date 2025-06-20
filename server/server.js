const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Game state
const players = new Map();
const gameConfig = {
  maxHealth: 100,
  respawnTime: 3000, // 3 seconds
  mapBounds: {
    x: { min: -50, max: 50 },
    y: { min: 0, max: 20 },
    z: { min: -50, max: 50 }
  }
};

// Dust2 spawn points matching client-side coordinates
const dust2SpawnPoints = [
  { x: 421, y: 40, z: -599 },
  { x: 442, y: 40, z: -630 },
  { x: 371, y: 40, z: -836 },
  { x: 198, y: 40, z: -323 },
  { x: 62, y: 40, z: 138 },
  { x: -529, y: 40, z: -40 },
  { x: -582, y: 40, z: -569 },
  { x: -597, y: 30, z: -409 },
  { x: -669, y: 40, z: -1064 },
  { x: -92, y: 40, z: -628 },
  { x: 405, y: 40, z: -881 }
];

// Helper function to generate spawn position
function getSpawnPosition() {
  const randomIndex = Math.floor(Math.random() * dust2SpawnPoints.length);
  return dust2SpawnPoints[randomIndex];
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Initialize new player
  const spawnPos = getSpawnPosition();
  const newPlayer = {
    id: socket.id,
    position: spawnPos,
    rotation: { x: 0, y: 0, z: 0 },
    health: gameConfig.maxHealth,
    alive: true,
    lastUpdate: Date.now()
  };
  
  players.set(socket.id, newPlayer);
  
  // Send initial game state to new player
  socket.emit('playerJoined', {
    playerId: socket.id,
    player: newPlayer,
    allPlayers: Array.from(players.values())
  });
  
  // Notify other players about new player
  socket.broadcast.emit('playerConnected', newPlayer);
  
  // Handle player movement updates
  socket.on('playerUpdate', (data) => {
    const player = players.get(socket.id);
    if (player && player.alive) {
      player.position = data.position;
      player.rotation = data.rotation;
      player.lastUpdate = Date.now();
      
      // Broadcast to other players
      socket.broadcast.emit('playerMoved', {
        playerId: socket.id,
        position: data.position,
        rotation: data.rotation
      });
    }
  });
  
  // Handle shooting
  socket.on('playerShoot', (data) => {
    const shooter = players.get(socket.id);
    if (shooter && shooter.alive) {
      // Broadcast shot to all other players to create their own projectiles
      socket.broadcast.emit('playerShot', {
        playerId: socket.id,
        origin: data.origin,
        direction: data.direction
      });
    }
  });
  
  // Handle bullet hits (projectile-based)
  socket.on('bulletHit', (data) => {
    const { bulletId, targetPlayerId, damage, shooterId } = data;
    
    const shooter = players.get(shooterId);
    const target = players.get(targetPlayerId);
    
    if (!shooter || !target || !target.alive) {
      return; // Invalid hit
    }
    
    // Prevent self-damage
    if (shooterId === targetPlayerId) {
      return;
    }
    
    console.log(`Bullet ${bulletId} hit player ${targetPlayerId} for ${damage} damage`);
    
    // Apply damage
    target.health -= damage;
    
    if (target.health <= 0) {
      target.health = 0;
      target.alive = false;
      
      // Notify all players about the kill
      io.emit('playerKilled', {
        killerId: shooterId,
        victimId: targetPlayerId
      });
      
      console.log(`Player ${targetPlayerId} killed by ${shooterId}`);
      
      // Schedule respawn
      setTimeout(() => {
        respawnPlayer(targetPlayerId);
      }, gameConfig.respawnTime);
    } else {
      // Just notify target about damage
      io.to(targetPlayerId).emit('playerDamaged', {
        damage: damage,
        health: target.health,
        shooterId: shooterId
      });
    }
  });
  
  // Handle respawn request
  socket.on('requestRespawn', () => {
    const player = players.get(socket.id);
    if (player && !player.alive) {
      respawnPlayer(socket.id);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    players.delete(socket.id);
    socket.broadcast.emit('playerDisconnected', socket.id);
  });
});

// Note: Hit detection is now handled client-side through projectile collision
// The server validates hits when clients report bulletHit events

// Respawn player
function respawnPlayer(playerId) {
  const player = players.get(playerId);
  if (player) {
    player.position = getSpawnPosition();
    player.health = gameConfig.maxHealth;
    player.alive = true;
    
    // Notify all players about respawn
    io.emit('playerRespawned', {
      playerId: playerId,
      player: player
    });
  }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Kronkar FPS Server running on port ${PORT}`);
  console.log(`Connect from other devices on your network using your local IP:${PORT}`);
  
  // Try to display local IP addresses
  const os = require('os');
  const interfaces = os.networkInterfaces();
  console.log('\nLocal IP addresses:');
  Object.keys(interfaces).forEach(interfaceName => {
    interfaces[interfaceName].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  ${interfaceName}: ${iface.address}:${PORT}`);
      }
    });
  });
}); 