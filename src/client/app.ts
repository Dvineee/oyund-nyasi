import { io, Socket } from "socket.io-client";

/**
 * Procedural Sound Management (Web Audio API)
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    if (!this.enabled) return;
    this.initCtx();
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx!.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + duration);
  }

  playClick() { this.playTone(800, "sine", 0.1, 0.05); }
  playNotify() { this.playTone(1200, "sine", 0.2, 0.05); }
  playSuccess() { this.playTone(600, "sine", 0.1); setTimeout(() => this.playTone(900, "sine", 0.3), 100); }
  playError() { this.playTone(200, "square", 0.2, 0.05); }
  playMove() { this.playTone(400, "triangle", 0.1, 0.08); }
}

const sounds = new SoundManager();
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
const quickMatchBtn = document.getElementById("quick-match-btn")!;
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
    sounds.playSuccess();
  }
};

createRoomBtn.onclick = () => {
  createRoomModal.classList.remove("hidden");
  createRoomModal.classList.add("flex");
  sounds.playClick();
};

quickMatchBtn.onclick = () => {
  socket.emit("quick_match");
  sounds.playClick();
};

cancelCreateBtn.onclick = () => {
  createRoomModal.classList.add("hidden");
  createRoomModal.classList.remove("flex");
};

confirmCreateBtn.onclick = () => {
  const name = roomNameInput.value.trim();
  const gameType = gameTypeSelect.value;
  if (name) {
    socket.emit("create_room", { name, gameType });
    createRoomModal.classList.add("hidden");
    createRoomModal.classList.remove("flex");
    sounds.playSuccess();
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
  sounds.playClick();
};

// --- Socket Events ---

socket.on("platform_joined", (id: string) => {
  myId = id;
  loginScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  lobbyScreen.classList.add("animate-fade");
  document.getElementById("user-info-container")?.classList.remove("hidden");
});

socket.on("room_list", (roomsData: any[]) => {
  roomListContainer.innerHTML = "";
  if (roomsData.length === 0) {
    roomListContainer.innerHTML = `<div class="col-span-full text-center p-12 text-gray-500 italic">Henüz aktif oda yok. Bir tane oluşturmaya ne dersin?</div>`;
  }
  roomsData.forEach(room => {
    const div = document.createElement("div");
    div.className = "panel neon-border p-5 flex justify-between items-center group cursor-pointer animate-fade";
    div.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-accent/10 transition-colors">
          <span class="text-2xl">${room.gameType === 'tictactoe' ? '❌' : '🎮'}</span>
        </div>
        <div>
          <h4 class="font-black text-sm text-white uppercase tracking-tighter group-hover:text-accent transition-colors">${room.name}</h4>
          <p class="text-[10px] font-mono text-gray-500 uppercase tracking-widest">${room.gameType}</p>
        </div>
      </div>
      <div class="flex items-center gap-6">
        <div class="text-right">
          <div class="flex items-center gap-1.5 justify-end">
            <span class="w-2 h-2 rounded-full ${room.status === 'waiting' ? 'bg-success animate-pulse shadow-[0_0_10px_#00ff88]' : 'bg-gray-600'}"></span>
            <span class="text-xs font-black font-mono">${room.playerCount}/${room.maxPlayers}</span>
          </div>
          <span class="text-[9px] text-gray-600 uppercase font-black tracking-widest">${room.status === 'waiting' ? 'Waiting' : 'Live'}</span>
        </div>
        <button class="btn-primary py-2 px-4 !text-[9px]">
          ${room.playerCount >= room.maxPlayers ? 'FULL' : 'JOIN'}
        </button>
      </div>
    `;
    div.onclick = () => {
      if (room.playerCount < room.maxPlayers) {
        socket.emit("join_room", room.id);
        sounds.playClick();
      }
    };
    roomListContainer.appendChild(div);
  });
});

socket.on("room_created", (room: any) => renderRoom(room));
socket.on("game_started", (room: any) => { renderRoom(room); sounds.playNotify(); });
socket.on("player_joined", (room: any) => { renderRoom(room); sounds.playNotify(); });
socket.on("player_left", (room: any) => renderRoom(room));

socket.on("new_message", (data: any) => {
  const div = document.createElement("div");
  if (data.isSystem) {
    div.className = "text-[11px] text-center text-gray-600 font-mono uppercase tracking-tighter py-2 animate-fade";
    div.innerHTML = `<span>[${data.text}]</span>`;
  } else {
    const isMe = data.sender === userInfo.innerText;
    div.className = `flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade mb-2`;
    div.innerHTML = `
      <div class="chat-bubble ${isMe ? 'bg-accent/20 border border-accent/30 text-accent' : 'bg-neutral-800 text-gray-300'}">
        <div class="flex justify-between items-center gap-4 mb-0.5">
          <span class="font-black text-[10px] uppercase tracking-widest ${isMe ? 'text-accent' : 'text-gray-500'}">${data.sender}</span>
          <span class="text-[9px] opacity-40">${data.timestamp}</span>
        </div>
        <span class="text-[13px] leading-relaxed">${data.text}</span>
      </div>
    `;
    if (!isMe) sounds.playNotify();
  }
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function renderRoom(room: any) {
  currentRoom = room;
  lobbyScreen.classList.add("hidden");
  roomScreen.classList.remove("hidden");
  roomScreen.classList.add("animate-fade");
  
  const controls = document.getElementById("game-over-controls");
  if (controls) controls.remove();
  const inviteDiv = document.querySelector(".rematch-invite");
  if (inviteDiv) inviteDiv.remove();

  playerList.innerHTML = "";
  room.players.forEach((p: any) => {
    const li = document.createElement("li");
    li.className = "panel p-3 flex items-center justify-between mb-2 group";
    li.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center font-bold text-xs text-accent">
          ${p.nickname.charAt(0).toUpperCase()}
        </div>
        <span class="text-sm font-bold text-white">${p.nickname}</span>
      </div>
      ${p.id === room.hostId ? '<span class="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20 font-bold uppercase">Host</span>' : ''}
    `;
    playerList.appendChild(li);
  });

  if (room.players.length === room.maxPlayers) {
    initTicTacToe(room);
  } else {
    gameContainer.innerHTML = `
      <div class="text-center space-y-4 py-20">
        <div class="w-20 h-20 bg-neutral-800/50 rounded-full flex items-center justify-center mx-auto border-4 border-dashed border-neutral-700 animate-spin">
           <span class="text-3xl">⏳</span>
        </div>
        <p class="text-gray-500 animate-pulse font-mono uppercase tracking-widest text-sm">Diğer oyuncu bekleniyor...</p>
      </div>
    `;
  }
}

function initTicTacToe(room: any) {
  const board = room.state?.board || Array(9).fill(null);
  gameContainer.innerHTML = `
    <div class="flex flex-col items-center">
       <div class="grid grid-cols-3 gap-4 w-full max-w-[360px]">
          ${[0,1,2,3,4,5,6,7,8].map(i => {
            const mark = board[i] || "";
            const markClass = mark === 'X' ? 'mark-x' : (mark === 'O' ? 'mark-o' : '');
            return `<div data-index="${i}" class="cell ${markClass}">${mark}</div>`;
          }).join('')}
       </div>
       <div id="game-status" class="mt-12 text-center text-sm font-mono font-black uppercase tracking-[0.2em] transition-all">
          ${room.state?.turn === myId ? '<span class="text-success animate-neon">Sizin Sıranız</span>' : '<span class="text-gray-600">Rakip Sırası</span>'}
       </div>
    </div>
  `;

  document.querySelectorAll(".cell").forEach(cell => {
    cell.onclick = () => {
       const index = (cell as HTMLElement).dataset.index;
       socket.emit("make_move", { index: Number(index) });
       sounds.playClick();
    };
  });
}

socket.on("move_made", (data: any) => {
  const cell = document.querySelector(`[data-index="${data.index}"]`);
  if (cell) {
    const mark = data.playerId === currentRoom.hostId ? "X" : "O";
    cell.innerHTML = mark;
    cell.className = `cell ${mark === 'X' ? 'mark-x' : 'mark-o'} animate-fade`;
    sounds.playMove();
  }
  
  const status = document.getElementById("game-status")!;
  if (data.nextTurn === myId) {
    status.innerHTML = '<span class="text-success animate-neon">Sizin Sıranız</span>';
    sounds.playNotify();
  } else {
    status.innerHTML = '<span class="text-gray-600">Rakip Sırası</span>';
  }
});

socket.on("game_over", (data: any) => {
  const status = document.getElementById("game-status")!;
  const isMeWinner = data.winner === userInfo.innerText;

  if (data.draw) {
    status.innerHTML = '<span class="text-yellow-500">Berabere!</span>';
    sounds.playNotify();
  } else if (data.forfeit) {
    status.innerHTML = `<span class="text-success font-black text-2xl tracking-tighter">HÜKMEN GALİP!</span><br><span class="text-[10px] text-gray-500">Rakip oyundan ayrıldı</span>`;
    sounds.playSuccess();
  } else {
    status.innerHTML = `<span class="${isMeWinner ? 'text-success' : 'text-red-500'} font-black text-2xl tracking-tighter">${isMeWinner ? 'ZAFER!' : 'YENİLGİ!'}</span>`;
    isMeWinner ? sounds.playSuccess() : sounds.playError();
  }
  
  const controls = document.createElement("div");
  controls.className = "mt-8 flex gap-3 justify-center animate-fade";
  controls.id = "game-over-controls";

  const retryBtn = document.createElement("button");
  retryBtn.innerText = "TEKRAR OYNA";
  retryBtn.className = "btn-primary py-2 px-6 text-xs";
  retryBtn.onclick = () => {
    retryBtn.disabled = true;
    retryBtn.innerText = "BEKLENİYOR...";
    socket.emit("request_rematch");
    sounds.playClick();
  };

  const lobiBtn = document.createElement("button");
  lobiBtn.innerText = "LOBİYE DÖN";
  lobiBtn.className = "btn-secondary py-2 px-6 text-xs";
  lobiBtn.onclick = () => {
    socket.emit("leave_room");
    roomScreen.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    sounds.playClick();
  };

  controls.appendChild(retryBtn);
  controls.appendChild(lobiBtn);
  status.parentNode?.appendChild(controls);
});

socket.on("rematch_offered", (data: any) => {
  sounds.playNotify();
  const status = document.getElementById("game-status")!;
  const existingControls = document.getElementById("game-over-controls");
  if (existingControls) existingControls.remove();

  const inviteDiv = document.createElement("div");
  inviteDiv.className = "rematch-invite mt-6 p-6 panel animate-fade text-center";
  inviteDiv.innerHTML = `
    <p class="font-bold mb-4 text-sm uppercase tracking-widest text-white">${data.sender} rövanş istiyor!</p>
    <div class="flex gap-3 justify-center">
      <button id="accept-rematch-btn" class="btn-primary py-2 px-6 text-xs">KABUL ET</button>
      <button id="decline-rematch-btn" class="btn-secondary py-2 px-6 text-xs">REDDET</button>
    </div>
  `;
  status.parentNode?.appendChild(inviteDiv);

  document.getElementById("accept-rematch-btn")!.onclick = () => {
    socket.emit("accept_rematch");
    inviteDiv.remove();
    sounds.playSuccess();
  };
  document.getElementById("decline-rematch-btn")!.onclick = () => {
    inviteDiv.remove();
    status.innerHTML = '<span class="text-gray-600 font-bold">Rövanş Reddedildi</span>';
    sounds.playClick();
  };
});

socket.on("error", (data: any) => {
  sounds.playError();
  console.error("Game Error:", data.message);
});
