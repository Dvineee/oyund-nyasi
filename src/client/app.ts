import { io, Socket } from "socket.io-client";

const socket: Socket = io();

// State
let myId = "";
let currentRoom: any = null;

// DOM Elements
const loginScreen = document.getElementById("login-screen")!;
const lobbyScreen = document.getElementById("lobby-screen")!;
const roomScreen = document.getElementById("room-screen")!;
const nicknameInput = document.getElementById("nickname-input") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn")!;
const userInfo = document.getElementById("user-info")!;
const roomListContainer = document.getElementById("room-list")!;
const createRoomBtn = document.getElementById("create-room-btn")!;
const createRoomModal = document.getElementById("create-room-modal")!;
const confirmCreateBtn = document.getElementById("confirm-create-btn")!;
const cancelCreateBtn = document.getElementById("cancel-create-btn")!;
const roomNameInput = document.getElementById("room-name-input") as HTMLInputElement;
const gameTypeSelect = document.getElementById("game-type-select") as HTMLSelectElement;
const chatInput = document.getElementById("chat-input") as HTMLInputElement;
const sendChatBtn = document.getElementById("send-chat-btn")!;
const chatMessages = document.getElementById("chat-messages")!;
const playerList = document.getElementById("player-list")!;
const leaveRoomBtn = document.getElementById("leave-room-btn")!;
const gameContainer = document.getElementById("game-container")!;

// --- Actions ---

joinBtn.onclick = () => {
  const nick = nicknameInput.value.trim();
  if (nick) {
    socket.emit("join_platform", nick);
    userInfo.innerText = nick;
  }
};

createRoomBtn.onclick = () => createRoomModal.classList.remove("hidden");
cancelCreateBtn.onclick = () => createRoomModal.classList.add("hidden");

confirmCreateBtn.onclick = () => {
  const name = roomNameInput.value.trim();
  const gameType = gameTypeSelect.value;
  if (name) {
    socket.emit("create_room", { name, gameType });
    createRoomModal.classList.add("hidden");
  }
};

sendChatBtn.onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === "Enter") sendMessage(); };

function sendMessage() {
  const msg = chatInput.value.trim();
  if (msg) {
    socket.emit("send_message", { message: msg });
    chatInput.value = "";
  }
}

leaveRoomBtn.onclick = () => {
  socket.emit("leave_room");
  roomScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  currentRoom = null;
  gameContainer.innerHTML = "";
  chatMessages.innerHTML = "";
};

// --- Socket Events ---

socket.on("platform_joined", (id: string) => {
  myId = id;
  loginScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
});

socket.on("room_list", (rooms: any[]) => {
  roomListContainer.innerHTML = "";
  rooms.forEach(room => {
    const div = document.createElement("div");
    div.className = "bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center hover:border-orange-500 transition cursor-pointer";
    div.innerHTML = `
      <div>
        <h4 class="font-bold text-orange-400">${room.name}</h4>
        <p class="text-xs text-gray-400">${room.gameType === 'tictactoe' ? 'Tic Tac Toe' : room.gameType}</p>
      </div>
      <div class="text-right">
        <span class="text-sm font-mono">${room.playerCount}/2</span>
        <button class="ml-4 bg-orange-600 px-3 py-1 rounded-md text-xs font-bold ${room.playerCount >= 2 ? 'opacity-50 cursor-not-allowed' : ''}">Katıl</button>
      </div>
    `;
    div.onclick = () => {
      if (room.playerCount < 2) socket.emit("join_room", room.id);
    };
    roomListContainer.appendChild(div);
  });
});

socket.on("room_created", (room: any) => {
  renderRoom(room);
});

socket.on("player_joined", (room: any) => {
  renderRoom(room);
});

socket.on("player_left", (room: any) => {
  renderRoom(room);
});

socket.on("new_message", (data: any) => {
  const div = document.createElement("div");
  div.className = "bg-gray-700/50 p-2 rounded-lg";
  div.innerHTML = `<span class="font-bold text-orange-400">${data.sender}:</span> <span class="break-words">${data.text}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function renderRoom(room: any) {
  currentRoom = room;
  lobbyScreen.classList.add("hidden");
  roomScreen.classList.remove("hidden");
  
  // Players
  playerList.innerHTML = "";
  room.players.forEach((p: any) => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-2 text-sm";
    li.innerHTML = `<span class="w-2 h-2 bg-green-500 rounded-full"></span> ${p.nickname} ${p.id === room.hostId ? '(Host)' : ''}`;
    playerList.appendChild(li);
  });

  // Game Container
  if (room.players.length === 2) {
    initTicTacToe(room);
  } else {
    gameContainer.innerHTML = `<p class="text-gray-400 text-center">Diğer oyuncu bekleniyor...</p>`;
  }
}

function initTicTacToe(room: any) {
  gameContainer.innerHTML = `
    <div class="grid grid-cols-3 gap-2 w-64 mx-auto mt-8">
      ${[0,1,2,3,4,5,6,7,8].map(i => `<div data-index="${i}" class="cell w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center text-4xl font-bold cursor-pointer hover:bg-gray-600 transition h-[80px]"></div>`).join('')}
    </div>
    <div id="game-status" class="mt-8 text-center text-xl font-bold">Oyun Başladı!</div>
  `;

  document.querySelectorAll(".cell").forEach(cell => {
    cell.onclick = () => {
       const index = (cell as HTMLElement).dataset.index;
       socket.emit("make_move", { index: Number(index) });
    };
  });
}

socket.on("move_made", (data: any) => {
  const cell = document.querySelector(`[data-index="${data.index}"]`);
  if (cell) {
    const mark = data.playerId === currentRoom.hostId ? "X" : "O";
    cell.innerHTML = mark;
    cell.classList.add(mark === "X" ? "text-blue-400" : "text-red-400");
  }
  
  const status = document.getElementById("game-status")!;
  if (data.nextTurn === myId) {
    status.innerText = "Sıra Sizde!";
    status.className = "mt-8 text-center text-xl font-bold text-green-400";
  } else {
    status.innerText = "Rakip Bekleniyor...";
    status.className = "mt-8 text-center text-xl font-bold text-gray-400";
  }
});

socket.on("game_over", (data: any) => {
  const status = document.getElementById("game-status")!;
  if (data.draw) {
    status.innerText = "Berabere!";
    status.className = "mt-8 text-center text-xl font-bold text-yellow-400";
  } else {
    status.innerText = `Kazanan: ${data.winner}`;
    status.className = "mt-8 text-center text-xl font-bold text-green-500";
  }
  
  // Update board one last time
  data.board.forEach((mark: string, i: number) => {
    const cell = document.querySelector(`[data-index="${i}"]`);
    if (cell && mark) {
      cell.innerHTML = mark;
      cell.classList.add(mark === "X" ? "text-blue-400" : "text-red-400");
    }
  });

  const btn = document.createElement("button");
  btn.innerText = "Lobiye Dön";
  btn.className = "mt-4 bg-orange-600 px-6 py-2 rounded-lg font-bold block mx-auto";
  btn.onclick = () => location.reload();
  status.appendChild(btn);
});

socket.on("error", (data: any) => {
  alert(data.message);
});