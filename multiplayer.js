// === 멀티 플레이 (PvP) 로직 ===

let tempNickname = '';

function selectProfileFruit(fruit, element) {
  myProfileFruit = fruit;
  const btns = document.querySelectorAll('.fruit-btn');
  btns.forEach((btn) => btn.classList.remove('selected'));
  element.classList.add('selected');
}

function confirmNickname() {
  const nickname = document.getElementById('nickname-input').value.trim();
  if (!nickname) return alert('닉네임을 입력해주세요!');

  tempNickname = myProfileFruit + ' ' + nickname;
  document.getElementById('confirm-desc').innerText =
    `'${nickname}' (으)로 정말 참가하시겠습니까?`;
  document.getElementById('confirm-screen').classList.remove('hidden');
}

function proceedWithNickname() {
  myNickname = tempNickname;
  document.getElementById('confirm-screen').classList.add('hidden');
  switchScreen('nickname-screen', 'multi-entry-screen');
}

function cancelNickname() {
  document.getElementById('confirm-screen').classList.add('hidden');
}

function createRoom() {
  isHost = true;
  currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();

  roomState = {
    status: 'waiting',
    players: {},
  };
  roomState.players[myNickname] = { isHost: true };

  db.ref('rooms/' + currentRoomId)
    .set(roomState)
    .then(() => {
      db.ref('rooms/' + currentRoomId)
        .onDisconnect()
        .remove();
      enterLobby();
    })
    .catch((error) => alert('방 생성에 실패했습니다: ' + error.message));
}

function joinRoom() {
  const code = document
    .getElementById('room-code-input')
    .value.trim()
    .toUpperCase();
  if (code.length !== 6) return alert('6자리 방 코드를 정확히 입력해주세요!');

  isHost = false;
  currentRoomId = code;

  db.ref('rooms/' + currentRoomId)
    .once('value')
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.status !== 'waiting')
          return alert('이미 게임이 시작된 방입니다!');
        if (data.players && data.players[myNickname])
          return alert('이미 방에 같은 닉네임이 있습니다!');

        db.ref('rooms/' + currentRoomId + '/players/' + myNickname)
          .set({ isHost: false })
          .then(() => enterLobby());
      } else {
        alert('존재하지 않는 방 코드입니다!');
      }
    });
}

function enterLobby() {
  switchScreen('multi-entry-screen', 'multi-lobby-screen');
  document.getElementById('lobby-room-code').innerText = currentRoomId;

  const startBtn = document.getElementById('lobby-start-btn');
  startBtn.disabled = !isHost;
  startBtn.innerText = isHost ? '게임 시작 (방장)' : '방장의 시작 대기중...';

  db.ref('rooms/' + currentRoomId + '/status').on('value', (snapshot) => {
    if (!snapshot.exists() && currentRoomId !== '') {
      alert('방장이 퇴장하여 대기실이 폭파되었습니다.');
      resetToStartScreen();
      return;
    }

    if (snapshot.val() === 'selectingTurn') {
      transitionToTurnSelectionMulti();
    } else if (snapshot.val() === 'playing') {
      db.ref('rooms/' + currentRoomId + '/status').off();
      db.ref('rooms/' + currentRoomId + '/players').off();
      db.ref('rooms/' + currentRoomId + '/turnState').off();
      transitionToMultiGame();
    }
  });

  db.ref('rooms/' + currentRoomId + '/players').on('value', (snapshot) => {
    if (snapshot.val()) {
      roomState.players = snapshot.val();
      updateLobbyUI();
    }
  });
}

function updateLobbyUI() {
  const playerList = Object.keys(roomState.players).map((key) => ({
    name: key,
    isHost: roomState.players[key].isHost,
  }));
  renderLobbyPlayers(playerList);
}

function renderLobbyPlayers(playerList) {
  const container = document.getElementById('lobby-players');
  container.innerHTML = '';
  playerList.forEach((p) => {
    const div = document.createElement('div');
    div.style.color = '#fff';
    div.style.fontSize = '1.2rem';
    div.style.fontWeight = 'bold';
    div.innerText = `${p.name} ${p.isHost ? '👑' : ''}`;
    container.appendChild(div);
  });
}

function leaveRoom() {
  db.ref('rooms/' + currentRoomId + '/players').off();
  db.ref('rooms/' + currentRoomId + '/players/' + myNickname).remove();

  if (roomState.players && roomState.players[myNickname]) {
    delete roomState.players[myNickname];
  }
  switchScreen('multi-lobby-screen', 'multi-entry-screen');
}

function startMultiGame() {
  if (!isHost) return;
  const playerNames = Object.keys(roomState.players);
  if (playerNames.length < 2)
    return alert('최소 2명 이상의 플레이어가 접속해야 시작할 수 있습니다!');

  const turnCardsArray = Array(playerNames.length).fill('');
  turnCardsArray[Math.floor(Math.random() * playerNames.length)] = '先';

  db.ref('rooms/' + currentRoomId).update({
    status: 'selectingTurn',
    turnState: {
      cards: turnCardsArray,
      selections: {},
    },
  });
}

function transitionToTurnSelectionMulti() {
  switchScreen('multi-lobby-screen', 'turn-screen');
  document.getElementById('turn-result').innerText = '';
  document.getElementById('turn-cards').innerHTML = '';

  roomState.status = 'selectingTurn';

  if (!isHost) {
    db.ref('rooms/' + currentRoomId + '/turnState/leftPlayer')
      .onDisconnect()
      .set(myNickname);
  }

  db.ref('rooms/' + currentRoomId + '/turnState').on('value', (snapshot) => {
    if (!snapshot.exists() && currentRoomId !== '') {
      alert('방장이 퇴장하여 게임이 종료되었습니다.');
      resetToStartScreen();
      return;
    }
    if (snapshot.val()) renderTurnSelectionMulti(snapshot.val());
  });
}

function renderTurnSelectionMulti(tState) {
  if (tState.hostQuit) {
    db.ref('rooms/' + currentRoomId + '/turnState').off();
    document.getElementById('pause-screen').classList.add('hidden');
    alert('방장에 의해 게임이 종료되었습니다.');
    if (isHost) db.ref('rooms/' + currentRoomId).remove();
    resetToStartScreen();
    return;
  }

  if (tState.leftPlayer && isHost) {
    let remainingPlayers = Object.keys(roomState.players).filter(
      (p) => p !== tState.leftPlayer,
    );
    if (remainingPlayers.length < 2) {
      db.ref('rooms/' + currentRoomId + '/turnState').update({
        hostQuit: true,
      });
      return;
    }
    const turnCardsArray = Array(remainingPlayers.length).fill('');
    turnCardsArray[Math.floor(Math.random() * remainingPlayers.length)] = '先';

    db.ref('rooms/' + currentRoomId + '/turnState').update({
      cards: turnCardsArray,
      selections: {},
      leftPlayer: null,
      isPaused: false,
      pausedBy: '',
    });
    return;
  }

  if (tState.isPaused) {
    isPaused = true;
    switchScreen(null, 'pause-screen');
    const domPauseTitle = document.getElementById('pause-title');
    if (tState.pausedBy === myNickname) {
      domPauseTitle.innerText = '일시정지';
      domPauseTitle.style.fontSize = '';
      domPauseTitle.style.whiteSpace = '';
      document.getElementById('resume-btn').classList.remove('hidden');
      document.getElementById('quit-btn').classList.remove('hidden');
    } else {
      domPauseTitle.innerText = `${tState.pausedBy}님이\n게임을 일시정지했습니다.`;
      domPauseTitle.style.fontSize = '2.5rem';
      domPauseTitle.style.whiteSpace = 'pre-wrap';
      document.getElementById('resume-btn').classList.add('hidden');
      document.getElementById('quit-btn').classList.toggle('hidden', !isHost);
    }
  } else {
    isPaused = false;
    switchScreen('pause-screen', null);
  }

  const container = document.getElementById('turn-cards');
  const totalPlayers = (tState.cards || []).length;
  let playerNames = Object.keys(roomState.players);

  if (playerNames.length !== totalPlayers) return;

  const selections = tState.selections || {};
  const numSelections = Object.keys(selections).length;

  if (container.children.length !== totalPlayers) {
    container.innerHTML = '';
    for (let i = 0; i < totalPlayers; i++) {
      let card = document.createElement('div');
      card.className = 'turn-card card-back';
      card.onclick = () => selectTurnCardMulti(i);
      container.appendChild(card);
    }
  }

  let cardsDom = container.children;
  let mySelectionExists = Object.values(selections).includes(myNickname);
  let sunPlayer = null;

  for (let i = 0; i < totalPlayers; i++) {
    if (selections[i]) {
      cardsDom[i].onclick = null;
      cardsDom[i].classList.replace('card-back', 'revealed');

      if (numSelections === totalPlayers) {
        cardsDom[i].innerHTML =
          `<span class="turn-card-title">${tState.cards[i]}</span><span class="turn-card-subtitle">${selections[i]}</span>`;
        if (tState.cards[i] === '先') {
          sunPlayer = selections[i];
          cardsDom[i].style.color = '#d32f2f';
        } else {
          cardsDom[i].style.color = '#000';
        }
      } else {
        cardsDom[i].innerHTML =
          `<span class="turn-card-subtitle" style="margin-top: 40px; font-size: 1.2rem; color: #666;">선택완료<br>${selections[i]}</span>`;
      }
    } else {
      cardsDom[i].innerHTML = '';
      cardsDom[i].classList.add('card-back');
      cardsDom[i].classList.remove('revealed');
      cardsDom[i].onclick = mySelectionExists
        ? null
        : () => selectTurnCardMulti(i);
    }
  }

  if (isHost && numSelections === totalPlayers - 1) {
    let missingIndex = -1;
    for (let i = 0; i < totalPlayers; i++) if (!selections[i]) missingIndex = i;
    let missingPlayer = playerNames.find(
      (p) => !Object.values(selections).includes(p),
    );
    if (missingIndex !== -1 && missingPlayer) {
      db.ref(
        'rooms/' + currentRoomId + '/turnState/selections/' + missingIndex,
      ).set(missingPlayer);
    }
  }

  if (numSelections === totalPlayers && sunPlayer) {
    document.getElementById('turn-result').innerText =
      sunPlayer === myNickname
        ? "🎉 내가 '先'을 뽑았습니다! 먼저 시작합니다."
        : `👤 ${sunPlayer}님이 '先'을 뽑았습니다!`;

    if (isHost) {
      setTimeout(() => {
        db.ref('rooms/' + currentRoomId + '/turnState')
          .once('value')
          .then((snap) => {
            const state = snap.val();
            if (
              !state.leftPlayer &&
              state.selections &&
              Object.keys(state.selections).length === totalPlayers
            ) {
              startMultiGamePhase(sunPlayer);
            }
          });
      }, 3000);
    }
  }
}

function selectTurnCardMulti(index) {
  db.ref(
    'rooms/' + currentRoomId + '/turnState/selections/' + index,
  ).transaction((currentVal) => {
    return currentVal === null ? myNickname : undefined;
  });
}

function startMultiGamePhase(firstTurn) {
  const playerNames = Object.keys(roomState.players);
  const fullDeck = generateDeck();
  let turn = 0;
  let playersData = {};

  playerNames.forEach((name, index) => {
    playersData[name] = { id: index, name: name, deck: [], isActive: true };
  });

  while (fullDeck.length > 0) {
    playersData[playerNames[turn % playerNames.length]].deck.push(
      fullDeck.shift(),
    );
    turn++;
  }

  db.ref('rooms/' + currentRoomId).update({
    status: 'playing',
    gameState: {
      players: playersData,
      currentTurn: firstTurn,
      lastBellRinger: '',
      message: '게임이 시작되었습니다!',
      isPaused: false,
      pausedBy: '',
      hostQuit: false,
    },
  });
}

function transitionToMultiGame() {
  switchScreen('turn-screen', 'game-container');
  document.getElementById('multi-lobby-screen').classList.add('hidden');

  roomState.status = 'playing';

  if (!isHost) {
    db.ref('rooms/' + currentRoomId + '/gameState/leftPlayer')
      .onDisconnect()
      .set(myNickname);
  }

  db.ref('rooms/' + currentRoomId + '/gameState').on('value', (snapshot) => {
    if (!snapshot.exists() && currentRoomId !== '') {
      alert('방장이 퇴장하여 게임이 종료되었습니다.');
      resetToStartScreen();
      return;
    }
    if (snapshot.val()) updateMultiUI(snapshot.val());
  });
}

let localBellRinger = '';
let pendingGameState = null;
let previousTableCount = 0;
let isLocalFlip = false;
let localFlipTimer = null;
let isLocalBell = false;
let localBellTimer = null;

function updateMultiUI(gameState) {
  try {
    if (gameState.leftPlayer && isHost) return handlePlayerLeftMulti(gameState);

    if (gameState.hostQuit) {
      db.ref('rooms/' + currentRoomId + '/gameState').off();
      switchScreen('pause-screen', null);
      showMessage(gameState.message || '방장에 의해 게임이 종료되었습니다.');
      setTimeout(() => {
        if (isHost) db.ref('rooms/' + currentRoomId).remove();
        resetToStartScreen();
      }, 3000);
      return;
    }

    if (gameState.isPaused) {
      isPaused = true;
      switchScreen(null, 'pause-screen');
      const domPauseTitle = document.getElementById('pause-title');
      if (gameState.pausedBy === myNickname) {
        domPauseTitle.innerText = '일시정지';
        domPauseTitle.style.fontSize = '';
        domPauseTitle.style.whiteSpace = '';
        document.getElementById('resume-btn').classList.remove('hidden');
        document.getElementById('quit-btn').classList.remove('hidden');
      } else {
        domPauseTitle.innerText = `${gameState.pausedBy}님이\n게임을 일시정지했습니다.`;
        domPauseTitle.style.fontSize = '2.5rem';
        domPauseTitle.style.whiteSpace = 'pre-wrap';
        document.getElementById('resume-btn').classList.add('hidden');
        document.getElementById('quit-btn').classList.toggle('hidden', !isHost);
      }
    } else {
      isPaused = false;
      switchScreen('pause-screen', null);
    }

    if (players.length === 0) setupMultiplayerUI(gameState);

    if (
      gameState.lastBellRinger &&
      gameState.lastBellRinger !== localBellRinger
    ) {
      localBellRinger = gameState.lastBellRinger;
      handleBellRingEventMulti(gameState.lastBellRinger);
    } else if (!gameState.lastBellRinger && localBellRinger !== '') {
      localBellRinger = '';
    }

    if (isLocked) {
      pendingGameState = gameState;
      return;
    }

    applyGameStateMulti(gameState);
  } catch (error) {
    showMessage('오류 발생: ' + error.message);
    console.error(error);
  }
}

function handlePlayerLeftMulti(gameState) {
  let leftName = gameState.leftPlayer;
  let pData = gameState.players[leftName];

  if (!pData || !pData.isActive) {
    db.ref('rooms/' + currentRoomId + '/gameState/leftPlayer').remove();
    return;
  }

  let cardsToDistribute = [...(pData.deck || []), ...(pData.table || [])];
  pData.deck = [];
  pData.table = [];
  pData.isActive = false;

  let activePlayers = Object.keys(gameState.players).filter(
    (k) => gameState.players[k].isActive,
  );

  if (activePlayers.length === 1 && activePlayers[0] === myNickname) {
    db.ref('rooms/' + currentRoomId + '/gameState').update({
      hostQuit: true,
      message: '모든 플레이어가 게임을 종료했습니다. 게임을 종료합니다.',
      leftPlayer: null,
    });
    return;
  }

  let idx = 0;
  while (cardsToDistribute.length > 0) {
    let pName = activePlayers[idx % activePlayers.length];
    if (!gameState.players[pName].deck) gameState.players[pName].deck = [];
    gameState.players[pName].deck.push(cardsToDistribute.shift());
    idx++;
  }

  let nextTurn = gameState.currentTurn;
  if (nextTurn === leftName && players.length > 0) {
    let turnIndex = players.findIndex((p) => p.name === leftName);
    if (turnIndex !== -1) {
      let startIdx = turnIndex;
      do {
        turnIndex = (turnIndex + 1) % numPlayers;
        let nextName = players[turnIndex].name;
        if (
          gameState.players[nextName].isActive &&
          (gameState.players[nextName].deck || []).length > 0
        ) {
          nextTurn = nextName;
          break;
        }
      } while (turnIndex !== startIdx);
    }
  } else if (nextTurn === leftName) {
    nextTurn = myNickname;
  }

  let updates = {
    players: gameState.players,
    message: `${leftName}님이 게임을 떠났습니다.`,
    leftPlayer: null,
    currentTurn: nextTurn,
  };

  if (gameState.isPaused) {
    updates.isPaused = false;
    updates.pausedBy = '';
  }

  db.ref('rooms/' + currentRoomId + '/gameState').update(updates);
}

function applyGameStateMulti(gameState) {
  let newTableCount = 0;

  players.forEach((p) => {
    const sData = gameState.players[p.name];
    if (sData) {
      p.deck = sData.deck || [];
      p.table = sData.table || [];
      p.isActive = sData.isActive;
      newTableCount += p.table.length;
    }
  });

  if (newTableCount > previousTableCount) {
    if (!isLocalFlip) {
      flipSound.currentTime = 0;
      flipSound.play().catch(() => {});
    }
  }
  previousTableCount = newTableCount;

  const turnIndex = players.findIndex((p) => p.name === gameState.currentTurn);
  if (turnIndex !== -1) currentTurn = turnIndex;

  if (gameState.message) showMessage(gameState.message);

  updateUI();
  checkGameOver();
}

function handleBellRingEventMulti(ringerName) {
  isLocked = true;

  if (!isLocalBell) {
    bellSound.currentTime = 0;
    bellSound.play().catch(() => {});
  }

  let ringerId = players.findIndex((p) => p.name === ringerName);
  let correct = isExactlyFive();

  let ringMsg = '';
  if (correct) {
    animateCardsToWinner(ringerId);
    ringMsg =
      ringerId === 0
        ? '🎉 내가 가장 먼저 정답을 맞췄습니다!'
        : `👤 ${ringerName}님이 가장 먼저 정답을 맞췄습니다!`;
  } else {
    ringMsg =
      ringerId === 0
        ? '❌ 실수! 상대방들에게 카드를 1장씩 줍니다.'
        : `👤 ${ringerName}님이 실수했습니다! 카드를 나눠 받습니다.`;
  }

  showMessage(ringMsg);

  const domCountdown = document.getElementById('countdown');
  domCountdown.innerText = '2';
  domCountdown.classList.remove('hidden');
  setTimeout(() => {
    domCountdown.innerText = '1';
  }, 1000);

  setTimeout(() => {
    domCountdown.classList.add('hidden');
    if (domMessage.innerText === ringMsg) showMessage('');
    isLocked = false;
    if (pendingGameState) {
      applyGameStateMulti(pendingGameState);
      pendingGameState = null;
    }
  }, 2000);
}

function setupMultiplayerUI(gameState) {
  isPlaying = true;
  isLocked = false;
  players = [];
  previousTableCount = 0;

  const playerNames = Object.keys(gameState.players);
  numPlayers = playerNames.length;
  const myIndex = playerNames.indexOf(myNickname);

  for (let i = 0; i < numPlayers; i++) {
    const targetName = playerNames[(myIndex + i) % numPlayers];
    players.push({
      id: i,
      isUser: i === 0,
      name: targetName,
      deck: [],
      table: [],
      isActive: true,
      domCard: i === 0 ? domUserCard : null,
      domDeck: i === 0 ? domUserDeck : null,
      domCount: i === 0 ? domUserCount : null,
      domInfo: i === 0 ? domUserInfo : null,
    });
  }

  setupOpponentsUI();
  document.getElementById('start-btn').classList.add('hidden');
}

function userFlipMulti() {
  let p = players[0];
  if (p.deck.length === 0) return;

  let newDeck = [...p.deck];
  let newTable = [...p.table];
  newTable.push(newDeck.shift());

  db.ref('rooms/' + currentRoomId + '/gameState').update({
    [`players/${myNickname}/deck`]: newDeck,
    [`players/${myNickname}/table`]: newTable,
    currentTurn: getNextTurnMulti(),
    message: '',
  });

  flipSound.currentTime = 0;
  flipSound.play().catch(() => {});
  isLocalFlip = true;
  clearTimeout(localFlipTimer);
  localFlipTimer = setTimeout(() => {
    isLocalFlip = false;
  }, 300);
}

function getNextTurnMulti() {
  let nextTurn = currentTurn;
  let startingTurn = currentTurn;
  let found = false;
  do {
    nextTurn = (nextTurn + 1) % numPlayers;
    if (players[nextTurn].isActive && players[nextTurn].deck.length > 0) {
      found = true;
      break;
    }
  } while (nextTurn !== startingTurn);
  return found ? players[nextTurn].name : players[startingTurn].name;
}

function userRingBellMulti() {
  if (isLocked) return;

  bellSound.currentTime = 0;
  bellSound.play().catch(() => {});
  isLocalBell = true;
  clearTimeout(localBellTimer);
  localBellTimer = setTimeout(() => {
    isLocalBell = false;
  }, 500);

  db.ref('rooms/' + currentRoomId + '/gameState/lastBellRinger').transaction(
    (currentValue) => {
      if (!currentValue || currentValue === '') return myNickname;
      return;
    },
    (error, committed, snapshot) => {
      if (committed && snapshot.val() === myNickname) executeRingBellMulti();
    },
  );
}

function executeRingBellMulti() {
  let correct = isExactlyFive();
  let updates = {};

  if (correct) {
    let allTableCards = [];
    players.forEach((p) => {
      allTableCards = allTableCards.concat(p.table);
      updates[`players/${p.name}/table`] = []; // 정답일 때만 바닥 비우기
    });
    updates[`players/${myNickname}/deck`] = [
      ...players[0].deck,
      ...allTableCards,
    ];
    updates[`currentTurn`] = myNickname; // 맞춘 사람이 다음 턴
  } else {
    let myNewDeck = [...players[0].deck];
    players.forEach((p) => {
      if (!p.isUser && p.isActive && myNewDeck.length > 0) {
        let pNewDeck = [...p.deck];
        pNewDeck.unshift(myNewDeck.shift());
        updates[`players/${p.name}/deck`] = pNewDeck;
      }
    });
    updates[`players/${myNickname}/deck`] = myNewDeck;
  }

  setTimeout(() => {
    updates[`lastBellRinger`] = '';
    db.ref('rooms/' + currentRoomId + '/gameState').update(updates);
  }, 2000);
}
