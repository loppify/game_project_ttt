const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const DATA_FILE = path.join(__dirname, 'data.json');

// Ініціалізація даних
let gameData = { leaderboard: {}, history: [] };
if (fs.existsSync(DATA_FILE)) {
  gameData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

const saveData = () => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(gameData, null, 2));
};

// Стан поточних кімнат
const rooms = {};

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Рядки
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Стовпці
  [0, 4, 8], [2, 4, 6]             // Діагоналі
];

const checkWinner = (board) => {
  for (let i = 0; i < WINNING_COMBINATIONS.length; i++) {
    const [a, b, c] = WINNING_COMBINATIONS[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (!board.includes(null)) return 'Draw';
  return null;
};

// API для отримання лідерборду та історії
app.get('/api/leaderboard', (req, res) => res.json(gameData.leaderboard));
app.get('/api/history', (req, res) => res.json(gameData.history));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', ({ username, room }) => {
    socket.join(room);
    if (!rooms[room]) {
      rooms[room] = { players: [], board: Array(9).fill(null), currentTurn: 'X', status: 'waiting' };
    }

    const currentRoom = rooms[room];
    if (currentRoom.players.length < 2 && !currentRoom.players.find(p => p.username === username)) {
      currentRoom.players.push({ id: socket.id, username, symbol: currentRoom.players.length === 0 ? 'X' : 'O' });
    }

    if (currentRoom.players.length === 2) {
      currentRoom.status = 'playing';
    }

    io.to(room).emit('room_data', currentRoom);
  });

  socket.on('make_move', ({ room, index }) => {
    const currentRoom = rooms[room];
    if (!currentRoom || currentRoom.status !== 'playing') return;

    const player = currentRoom.players.find(p => p.id === socket.id);
    if (!player || player.symbol !== currentRoom.currentTurn || currentRoom.board[index]) return;

    currentRoom.board[index] = player.symbol;
    currentRoom.currentTurn = currentRoom.currentTurn === 'X' ? 'O' : 'X';

    const winner = checkWinner(currentRoom.board);
    if (winner) {
      currentRoom.status = 'finished';
      let resultText = '';
      
      if (winner === 'Draw') {
        resultText = 'Draw';
      } else {
        const winnerObj = currentRoom.players.find(p => p.symbol === winner);
        const loserObj = currentRoom.players.find(p => p.symbol !== winner);
        resultText = `${winnerObj.username} won`;
        
        // Оновлення лідерборду
        gameData.leaderboard[winnerObj.username] = (gameData.leaderboard[winnerObj.username] || 0) + 1;
        gameData.leaderboard[loserObj.username] = (gameData.leaderboard[loserObj.username] || 0); // забезпечити наявність
      }

      // Збереження історії
      gameData.history.push({
        room,
        date: new Date().toISOString(),
        playerX: currentRoom.players.find(p => p.symbol === 'X').username,
        playerO: currentRoom.players.find(p => p.symbol === 'O').username,
        result: resultText
      });
      saveData();
    }

    io.to(room).emit('room_data', currentRoom);
    if (winner) {
      io.emit('leaderboard_update', gameData.leaderboard); // Оновлення для всіх клієнтів
    }
  });

  socket.on('restart_game', ({ room }) => {
     if (rooms[room]) {
         rooms[room].board = Array(9).fill(null);
         rooms[room].currentTurn = 'X';
         rooms[room].status = rooms[room].players.length === 2 ? 'playing' : 'waiting';
         io.to(room).emit('room_data', rooms[room]);
     }
  });

  socket.on('disconnect', () => {
    for (const roomName in rooms) {
      const room = rooms[roomName];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        room.status = 'waiting';
        room.board = Array(9).fill(null);
        io.to(roomName).emit('room_data', room);
        io.to(roomName).emit('player_disconnected');
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
