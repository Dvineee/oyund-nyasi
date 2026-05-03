import { auth, db } from "../lib/firebase";
import { 
  signInAnonymously, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  where,
  deleteDoc,
  getDocs,
  limit,
  setDoc,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";

/**
 * Procedural Sound Management (Web Audio API)
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private initCtx() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    } catch (e) {
      console.warn("Ses sistemi başlatılamadı:", e);
      this.enabled = false;
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

// State
let myId = "";
let myNickname = "";
let currentRoomId: string | null = null;
let currentRoomData: any = null;
let unsubscribeRoom: (() => void) | null = null;
let unsubscribeChat: (() => void) | null = null;

console.log("🔥 Firebase başlatılıyor...");

// Auth Listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ Firebase Auth Başarılı. UID:", user.uid);
    myId = user.uid;
    joinBtn.innerHTML = "PLATFORMA KATIL";
    (joinBtn as HTMLButtonElement).disabled = false;
    joinBtn.classList.remove("cursor-wait", "opacity-70");
    
    // Listen for rooms
    setupRoomListListener();
  } else {
    console.log("🔄 Anonim giriş yapılıyor...");
    signInAnonymously(auth).catch(err => {
       console.error("❌ Auth hatası:", err);
       joinBtn.innerHTML = "BAĞLANTI HATASI";
    });
  }
});

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
    myNickname = nick;
    userInfo.innerText = nick;
    loginScreen.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    lobbyScreen.classList.add("animate-fade");
    document.getElementById("user-info-container")?.classList.remove("hidden");
    sounds.playSuccess();
  }
};

createRoomBtn.onclick = () => {
  createRoomModal.classList.remove("hidden");
  createRoomModal.classList.add("flex");
  sounds.playClick();
};

cancelCreateBtn.onclick = () => {
  createRoomModal.classList.add("hidden");
  createRoomModal.classList.remove("flex");
};

(confirmCreateBtn as any).async_onclick = async () => {
  const name = roomNameInput.value.trim();
  const gameType = gameTypeSelect.value;
  if (name && myId) {
    sounds.playClick();
    try {
      const roomRef = await addDoc(collection(db, "rooms"), {
        name,
        gameType,
        hostId: myId,
        players: [myId],
        playerNicks: { [myId]: myNickname },
        status: "waiting",
        state: gameType === "tictactoe" ? { board: Array(9).fill(null), turn: myId } : { round: 1, scores: {}, moves: {} },
        createdAt: serverTimestamp()
      });
      console.log("Room Created:", roomRef.id);
      createRoomModal.classList.add("hidden");
      createRoomModal.classList.remove("flex");
      joinRoom(roomRef.id);
    } catch (e) {
      console.error("Room Create Error:", e);
    }
  }
};
// Re-bind with async support
confirmCreateBtn.onclick = () => (confirmCreateBtn as any).async_onclick();

quickMatchBtn.onclick = async () => {
  const roomsRef = collection(db, "rooms");
  const q = query(roomsRef, where("status", "==", "waiting"), limit(1));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const room = querySnapshot.docs[0];
    joinRoom(room.id);
  } else {
    // No waiting room, create one with random name
    roomNameInput.value = `Hızlı Maç #${Math.floor(Math.random()*900)+100}`;
    (confirmCreateBtn as any).async_onclick();
  }
  sounds.playClick();
};

sendChatBtn.onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === "Enter") sendMessage(); };

async function sendMessage() {
  const msg = chatInput.value.trim();
  if (msg && currentRoomId) {
    await addDoc(collection(db, "rooms", currentRoomId, "messages"), {
      senderId: myId,
      senderName: myNickname,
      message: msg,
      timestamp: serverTimestamp()
    });
    chatInput.value = "";
  }
}

leaveRoomBtn.onclick = async () => {
  if (currentRoomId) {
    const roomRef = doc(db, "rooms", currentRoomId);
    
    if (currentRoomData.players.length === 1) {
      await deleteDoc(roomRef);
    } else {
      await updateDoc(roomRef, {
        players: arrayRemove(myId),
        status: "waiting"
      });
    }
  }
  
  exitRoomUI();
};

function exitRoomUI() {
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribeChat) unsubscribeChat();
  roomScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  currentRoomId = null;
  currentRoomData = null;
  gameContainer.innerHTML = "";
  chatMessages.innerHTML = "";
  sounds.playClick();
}

// --- Firebase Events ---

function setupRoomListListener() {
  const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    roomListContainer.innerHTML = "";
    if (snapshot.empty) {
      roomListContainer.innerHTML = `<div class="col-span-full text-center p-12 text-gray-500 italic">Henüz aktif oda yok. Bir tane oluşturmaya ne dersin?</div>`;
      return;
    }
    
    snapshot.forEach((roomDoc) => {
      const room = roomDoc.data();
      const roomId = roomDoc.id;
      const playerCount = room.players?.length || 0;
      const maxPlayers = 2;

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
              <span class="text-xs font-black font-mono">${playerCount}/${maxPlayers}</span>
            </div>
            <span class="text-[9px] text-gray-600 uppercase font-black tracking-widest">${room.status === 'waiting' ? 'Waiting' : 'Live'}</span>
          </div>
          <button class="btn-primary py-2 px-4 !text-[9px]">
            ${playerCount >= maxPlayers ? 'FULL' : 'JOIN'}
          </button>
        </div>
      `;
      div.onclick = () => {
        if (playerCount < maxPlayers) {
          joinRoom(roomId);
          sounds.playClick();
        }
      };
      roomListContainer.appendChild(div);
    });
  });
}

async function joinRoom(roomId: string) {
  currentRoomId = roomId;
  const roomRef = doc(db, "rooms", roomId);
  const snap = await doc(db, "rooms", roomId); // dummy to get ref

  // Sync Room Data
  unsubscribeRoom = onSnapshot(roomRef, (docSnap) => {
    if (!docSnap.exists()) {
      exitRoomUI();
      return;
    }
    const data = docSnap.data();
    currentRoomData = data;
    
    // Auto-update attendance if not in list
    if (!data.players.includes(myId) && data.players.length < 2) {
        updateDoc(roomRef, {
            players: arrayUnion(myId),
            [`playerNicks.${myId}`]: myNickname,
            status: data.players.length + 1 >= 2 ? "playing" : "waiting"
        });
    }

    renderRoom(data);
  });

  // Sync Chat
  const chatQ = query(collection(db, "rooms", roomId, "messages"), orderBy("timestamp", "asc"));
  chatMessages.innerHTML = "";
  unsubscribeChat = onSnapshot(chatQ, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        const div = document.createElement("div");
        const isMe = data.senderId === myId;
        div.className = `flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade mb-2`;
        div.innerHTML = `
          <div class="chat-bubble ${isMe ? 'bg-accent/20 border border-accent/30 text-accent' : 'bg-neutral-800 text-gray-300'}">
            <div class="flex justify-between items-center gap-4 mb-0.5">
              <span class="font-black text-[10px] uppercase tracking-widest ${isMe ? 'text-accent' : 'text-gray-500'}">${data.senderName}</span>
              <span class="text-[9px] opacity-40">${data.timestamp?.toDate().toLocaleTimeString() || "..."}</span>
            </div>
            <span class="text-[13px] leading-relaxed">${data.message}</span>
          </div>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        if (!isMe) sounds.playNotify();
      }
    });
  });

  lobbyScreen.classList.add("hidden");
  roomScreen.classList.remove("hidden");
}

function renderRoom(room: any) {
  roomScreen.classList.add("animate-fade");
  
  const controls = document.getElementById("game-over-controls");
  if (controls) controls.remove();

  playerList.innerHTML = "";
  room.players.forEach((pid: string) => {
    const nick = room.playerNicks?.[pid] || "Oyuncu";
    const li = document.createElement("li");
    li.className = "panel p-3 flex items-center justify-between mb-2 group";
    li.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center font-bold text-xs text-accent">
          ${nick.charAt(0).toUpperCase()}
        </div>
        <span class="text-sm font-bold text-white">${nick}</span>
      </div>
      ${pid === room.hostId ? '<span class="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20 font-bold uppercase">Host</span>' : ''}
    `;
    playerList.appendChild(li);
  });

  if (room.players.length >= 2) {
    if (room.gameType === "tictactoe") {
      renderTicTacToe(room);
    } else if (room.gameType === "rps") {
      renderRPS(room);
    }
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

function renderTicTacToe(room: any) {
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
          ${room.winner ? `<span class="text-success text-2xl">${room.playerNicks[room.winner] || 'Birisi'} Kazandı!</span>` : 
            (room.state?.turn === myId ? '<span class="text-success animate-neon">Sizin Sıranız</span>' : '<span class="text-gray-600">Rakip Sırası</span>')}
       </div>
    </div>
  `;

  if (room.winner) {
      renderGameOver(room);
      return;
  }

  document.querySelectorAll(".cell").forEach(cell => {
    (cell as HTMLElement).onclick = async () => {
       if (room.state.turn !== myId) return;
       const index = Number((cell as HTMLElement).dataset.index);
       if (board[index]) return;

       const mark = myId === room.hostId ? "X" : "O";
       const newBoard = [...board];
       newBoard[index] = mark;

       const winner = checkTicTacToeWinner(newBoard);
       const nextTurn = room.players.find((p: string) => p !== myId);

       await updateDoc(doc(db, "rooms", currentRoomId!), {
         "state.board": newBoard,
         "state.turn": nextTurn,
         "winner": winner || null,
         "status": winner ? "finished" : "playing"
       });
       sounds.playMove();
    };
  });
}

function checkTicTacToeWinner(board: any[]) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (let line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return currentRoomData.players[board[a] === "X" ? 0 : 1];
    }
  }
  return null;
}

function renderGameOver(room: any) {
    const status = document.getElementById("game-status")!;
    const isMeWinner = room.winner === myId;

    const controls = document.createElement("div");
    controls.className = "mt-8 flex gap-3 justify-center animate-fade";
    controls.id = "game-over-controls";

    const retryBtn = document.createElement("button");
    retryBtn.innerText = "TEKRAR OYNA";
    retryBtn.className = "btn-primary py-2 px-6 text-xs";
    retryBtn.onclick = async () => {
        await updateDoc(doc(db, "rooms", currentRoomId!), {
            status: "playing",
            winner: null,
            state: room.gameType === "tictactoe" ? { board: Array(9).fill(null), turn: room.hostId } : { round: 1, scores: {}, moves: {} }
        });
        sounds.playClick();
    };

    const lobiBtn = document.createElement("button");
    lobiBtn.innerText = "LOBİYE DÖN";
    lobiBtn.className = "btn-secondary py-2 px-6 text-xs";
    lobiBtn.onclick = () => {
        exitRoomUI();
    };

    controls.appendChild(retryBtn);
    controls.appendChild(lobiBtn);
    status.parentNode?.appendChild(controls);
}

function renderRPS(room: any) {
  const state = room.state || { scores: {}, round: 1, moves: {} };
  const moves = ["rock", "paper", "scissors"];
  const moveIcons: any = { rock: "✊", paper: "✋", scissors: "✌️" };

  gameContainer.innerHTML = `
    <div class="flex flex-col items-center space-y-12">
      <div class="flex justify-between w-full max-w-md px-4">
        ${room.players.map((pid: string) => `
          <div class="flex flex-col items-center">
            <div id="ready-${pid}" class="w-2 h-2 rounded-full mb-2 ${state.moves?.[pid] ? 'bg-success animate-pulse' : 'bg-gray-700'}"></div>
            <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500">${room.playerNicks[pid] || '...'}</span>
            <span id="score-${pid}" class="text-3xl font-black text-white">${state.scores?.[pid] || 0}</span>
          </div>
        `).join('<div class="h-10 w-px bg-white/5 my-auto"></div>')}
      </div>

      <div id="rps-result-area" class="h-32 flex items-center justify-center text-6xl gap-12 animate-fade">
         <span class="text-gray-800 italic text-sm font-mono">SEÇİMİNİ YAP</span>
      </div>

      <div class="flex gap-4">
        ${moves.map(m => `
          <button data-move="${m}" class="rps-btn w-20 h-20 panel neon-border flex items-center justify-center text-3xl hover:scale-110 active:scale-90 transition-all ${state.moves?.[myId] ? 'opacity-50 pointer-events-none' : ''}">
            ${moveIcons[m]}
          </button>
        `).join('')}
      </div>
      
      <div id="game-status" class="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-accent animate-pulse">
         TUR ${state.round}
      </div>
    </div>
  `;

  document.querySelectorAll(".rps-btn").forEach(btn => {
    (btn as HTMLElement).onclick = async () => {
      const move = (btn as HTMLElement).dataset.move;
      const newMoves = { ...state.moves, [myId]: move };
      
      if (Object.keys(newMoves).length === 2) {
          // Resolve Round
          const p1 = room.players[0];
          const p2 = room.players[1];
          const m1 = newMoves[p1];
          const m2 = newMoves[p2];
          
          let winnerId = null;
          if (m1 !== m2) {
              if ((m1 === "rock" && m2 === "scissors") || (m1 === "paper" && m2 === "rock") || (m1 === "scissors" && m2 === "paper")) {
                  winnerId = p1;
              } else {
                  winnerId = p2;
              }
          }
          
          const newScores = { ...state.scores };
          if (winnerId) newScores[winnerId] = (newScores[winnerId] || 0) + 1;
          
          await updateDoc(doc(db, "rooms", currentRoomId!), {
              "state.moves": {},
              "state.scores": newScores,
              "state.round": state.round + 1,
              "state.lastResult": { moves: newMoves, winnerId }
          });
          sounds.playSuccess();
      } else {
          await updateDoc(doc(db, "rooms", currentRoomId!), {
              [`state.moves.${myId}`]: move
          });
          sounds.playClick();
      }
    };
  });
}
