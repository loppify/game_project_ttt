package com.example.tictactoe

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.tictactoe.ui.theme.TicTacToeTheme
import io.socket.client.Socket
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        SocketHandler.setSocket()
        SocketHandler.establishConnection()

        setContent {
            TicTacToeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    TicTacToeApp()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        SocketHandler.closeConnection()
    }
}

@Composable
fun TicTacToeApp() {
    var username by remember { mutableStateOf("") }
    var roomName by remember { mutableStateOf("") }
    var isJoined by remember { mutableStateOf(false) }
    var board by remember { mutableStateOf(List(9) { "" }) }
    var currentTurn by remember { mutableStateOf("") }
    var gameStatus by remember { mutableStateOf("waiting") }
    var mySymbol by remember { mutableStateOf("") }
    var winnerMessage by remember { mutableStateOf("") }

    val socket = SocketHandler.getSocket()

    LaunchedEffect(Unit) {
        socket.on(Socket.EVENT_CONNECT) {
            android.util.Log.d("SocketIO", "Connected to server")
        }
        socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            android.util.Log.e("SocketIO", "Connect Error: ${args[0]}")
        }
        socket.on("room_data") { args ->
            val data = args[0] as JSONObject
            val players = data.getJSONArray("players")
            val boardArray = data.getJSONArray("board")
            
            val newBoard = mutableListOf<String>()
            for (i in 0 until boardArray.length()) {
                val cell = boardArray.optString(i, "")
                newBoard.add(if (cell == "null") "" else cell)
            }
            
            board = newBoard
            currentTurn = data.getString("currentTurn")
            gameStatus = data.getString("status")

            // Знайти свій символ
            for (i in 0 until players.length()) {
                val player = players.getJSONObject(i)
                if (player.getString("id") == socket.id()) {
                    mySymbol = player.getString("symbol")
                }
            }
        }
    }

    if (!isJoined) {
        LoginScreen(
            username = username,
            onUsernameChange = { username = it },
            roomName = roomName,
            onRoomChange = { roomName = it },
            onJoin = {
                if (username.isNotEmpty() && roomName.isNotEmpty()) {
                    val data = JSONObject()
                    data.put("username", username)
                    data.put("room", roomName)
                    socket.emit("join_room", data)
                    isJoined = true
                }
            }
        )
    } else {
        GameScreen(
            roomName = roomName,
            board = board,
            currentTurn = currentTurn,
            gameStatus = gameStatus,
            mySymbol = mySymbol,
            onCellClick = { index ->
                val data = JSONObject()
                data.put("room", roomName)
                data.put("index", index)
                socket.emit("make_move", data)
            },
            onRestart = {
                val data = JSONObject()
                data.put("room", roomName)
                socket.emit("restart_game", data)
            }
        )
    }
}

@Composable
fun LoginScreen(
    username: String,
    onUsernameChange: (String) -> Unit,
    roomName: String,
    onRoomChange: (String) -> Unit,
    onJoin: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = "Tic-Tac-Toe Online", fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(32.dp))
        OutlinedTextField(
            value = username,
            onValueChange = onUsernameChange,
            label = { Text("Ім'я гравця") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = roomName,
            onValueChange = onRoomChange,
            label = { Text("Назва кімнати") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onJoin, modifier = Modifier.fillMaxWidth()) {
            Text("Приєднатися")
        }
    }
}

@Composable
fun GameScreen(
    roomName: String,
    board: List<String>,
    currentTurn: String,
    gameStatus: String,
    mySymbol: String,
    onCellClick: (Int) -> Unit,
    onRestart: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally

    ) {
        Text(text = "Кімната: $roomName", fontSize = 20.sp)
        Spacer(modifier = Modifier.height(8.dp))
        
        when (gameStatus) {
            "waiting" -> Text("Очікування суперника...", color = Color.Gray)
            "playing" -> {
                val turnText = if (currentTurn == mySymbol) "Ваш хід ($mySymbol)" else "Хід суперника ($currentTurn)"
                Text(text = turnText, fontSize = 18.sp, fontWeight = FontWeight.Medium)
            }
            "finished" -> {
                Text(text = "Гру завершено!", fontSize = 22.sp, color = Color.Red, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = onRestart) {
                    Text("Грати знову")
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier
                .width(300.dp)
                .height(300.dp)
                .background(Color.LightGray),
            contentPadding = PaddingValues(2.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            items(9) { index ->
                Box(
                    modifier = Modifier
                        .aspectRatio(1f)
                        .background(Color.White)
                        .clickable { onCellClick(index) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = board[index],
                        fontSize = 48.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (board[index] == "X") Color.Blue else Color.Magenta
                    )
                }
            }
        }
    }
}
