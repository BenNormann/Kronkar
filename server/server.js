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

// Helper function to generate spawn position
function getSpawnPosition() {
  return {
    x: (Math.random() - 0.5) * 20, // -10 to 10
    y: 2,
    z: (Math.random() - 0.5) * 20  // -10 to 10
  };
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
      // Broadcast shot to all other players for visual effects
      socket.broadcast.emit('playerShot', {
        playerId: socket.id,
        origin: data.origin,
        direction: data.direction
      });
      
      // Check for hits (server-side hit detection)
      checkHit(socket.id, data.origin, data.direction);
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

// Hit detection function
function checkHit(shooterId, origin, direction) {
  const maxDistance = 100;
  const hitboxRadius = 1; // Simple sphere collision
  
  players.forEach((player, playerId) => {
    if (playerId === shooterId || !player.alive) return;
    
    // Simple ray-sphere intersection
    const playerPos = player.position;
    const rayOrigin = origin;
    const rayDir = direction;
    
    // Vector from ray origin to sphere center
    const oc = {
      x: rayOrigin.x - playerPos.x,
      y: rayOrigin.y - playerPos.y,
      z: rayOrigin.z - playerPos.z
    };
    
    const a = rayDir.x * rayDir.x + rayDir.y * rayDir.y + rayDir.z * rayDir.z;
    const b = 2 * (oc.x * rayDir.x + oc.y * rayDir.y + oc.z * rayDir.z);
    const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - hitboxRadius * hitboxRadius;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant >= 0) {
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (t >= 0 && t <= maxDistance) {
        // Hit detected!
        handleHit(shooterId, playerId);
      }
    }
  });
}

// Handle hit logic
function handleHit(shooterId, victimId) {
  const victim = players.get(victimId);
  const shooter = players.get(shooterId);
  
  if (victim && shooter) {
    const damage = 34; // Damage per hit
    victim.health -= damage;
    
    if (victim.health <= 0) {
      victim.health = 0;
      victim.alive = false;
      
      // Notify all players about the kill
      io.emit('playerKilled', {
        killerId: shooterId,
        victimId: victimId
      });
      
      // Schedule respawn
      setTimeout(() => {
        respawnPlayer(victimId);
      }, gameConfig.respawnTime);
    } else {
      // Just notify about damage
      io.to(victimId).emit('playerDamaged', {
        damage: damage,
        health: victim.health,
        shooterId: shooterId
      });
    }
  }
}

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