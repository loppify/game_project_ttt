import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './index.css';

const socket = io('http://localhost:3001');

function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [joined, setJoined] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [leaderboard, setLeaderboard] = useState({});
  const [history, setHistory] = useState([]);

  useEffect(() => {
    socket.on('room_data', (data) => {
      setRoomData(data);
    });

    socket.on('leaderboard_update', (newLeaderboard) => {
      setLeaderboard(newLeaderboard);
      fetchHistory(); // Оновлюємо історію після гри
    });

    fetchLeaderboard();
    fetchHistory();

    return () => {
      socket.off('room_data');
      socket.off('leaderboard_update');
    };
  }, []);

  const fetchLeaderboard = async () => {
    const res = await fetch('http://localhost:3001/api/leaderboard');
    const data = await res.json();
    setLeaderboard(data);
  };

  const fetchHistory = async () => {
    const res = await fetch('http://localhost:3001/api/history');
    const data = await res.json();
    setHistory(data);
  };

  const joinRoom = () => {
    if (username && room) {
      socket.emit('join_room', { username, room });
      setJoined(true);
    }
  };

  const makeMove = (index) => {
    socket.emit('make_move', { room, index });
  };

  const restartGame = () => {
    socket.emit('restart_game', { room });
  };

  if (!joined) {
    return (
      <div className="app-container" style={{ justifyContent: 'center' }}>
        <div className="game-section">
          <h2>Вхід до гри</h2>
          <input 
            type="text" 
            placeholder="Ім'я гравця" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
          />
          <input 
            type="text" 
            placeholder="Назва кімнати (групи)" 
            value={room} 
            onChange={(e) => setRoom(e.target.value)} 
          />
          <button onClick={joinRoom}>Приєднатися</button>
        </div>
      </div>
    );
  }

  const me = roomData?.players.find(p => p.id === socket.id);

  return (
    <div className="app-container">
      <div className="game-section">
        <h2>Кімната: {room}</h2>
        {roomData?.status === 'waiting' && <p>Очікування другого гравця...</p>}
        {roomData?.status === 'playing' && <p>Хід: {roomData.currentTurn} (Ви граєте як {me?.symbol})</p>}
        {roomData?.status === 'finished' && (
          <div>
            <h3>Гра завершена!</h3>
            <button onClick={restartGame}>Грати знову</button>
          </div>
        )}

        <div className="board">
          {roomData?.board.map((cell, index) => (
            <div 
              key={index} 
              className="cell" 
              onClick={() => makeMove(index)}
            >
              {cell}
            </div>
          ))}
        </div>
      </div>

      <div className="stats-section">
        <div className="leaderboard">
          <h3>🏆 Лідерборд</h3>
          <ul>
            {Object.entries(leaderboard).sort((a, b) => b[1] - a[1]).map(([player, wins]) => (
              <li key={player}>{player}: {wins} перемог</li>
            ))}
          </ul>
        </div>
        
        <div className="history">
          <h3>📜 Останні матчі</h3>
          <ul>
            {history.slice(-5).reverse().map((match, idx) => (
              <li key={idx} style={{ fontSize: '0.9em' }}>
                [{match.room}] {match.playerX} vs {match.playerO} - <b>{match.result}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
