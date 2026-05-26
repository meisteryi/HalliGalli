// === 게임 로직 및 흐름 제어 ===

// 카드 생성 및 셔플
function generateDeck() {
  let deck = [];
  for (let fruit of fruits) {
    for (let count of cardDistribution) {
      deck.push({ fruit, count });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function resetToStartScreen() {
  document.getElementById('mode-screen').classList.remove('hidden');
  document.getElementById('difficulty-screen').classList.add('hidden');
  document.getElementById('multi-entry-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('multi-lobby-screen').classList.add('hidden');
  document.getElementById('turn-screen').classList.add('hidden');
  document.getElementById('game-container').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  domStartBtn.classList.add('hidden');
  domMessage.innerText = '게임 시작 버튼을 눌러주세요!';
  isPlaying = false;
  isPaused = false;
  clearTimeout(comFlipTimer);
  clearTimeout(comReactionTimer);
}

function pauseGame() {
  if (!isPlaying) {
    resetToStartScreen();
    return;
  }
  isPaused = true;
  clearTimeout(comFlipTimer);
  clearTimeout(comReactionTimer);
  document.getElementById('pause-screen').classList.remove('hidden');
  updateUI();
}

function resumeGame() {
  isPaused = false;
  document.getElementById('pause-screen').classList.add('hidden');
  updateUI();
  if (!isPlaying) return;

  if (isExactlyFive() && !isLocked) {
    checkAndScheduleComReaction();
  }
  if (currentTurn !== 0 && !isLocked) {
    scheduleComFlip();
  }
}

function quitGame() {
  document.getElementById('pause-screen').classList.add('hidden');
  resetToStartScreen();
}

function goBackToMode() {
  document.getElementById('difficulty-screen').classList.add('hidden');
  document.getElementById('mode-screen').classList.remove('hidden');
}

function goBackToModeFromNickname() {
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('mode-screen').classList.remove('hidden');
}

function goBackToNicknameFromMulti() {
  document.getElementById('multi-entry-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.remove('hidden');
}

function goBackToDifficulty() {
  if (hasSelectedTurn) {
    clearTimeout(turnTransitionTimer);
    hasSelectedTurn = false;
  }
  document.getElementById('turn-screen').classList.add('hidden');
  document.getElementById('difficulty-screen').classList.remove('hidden');
}

function selectGameMode(mode) {
  gameMode = mode;
  if (mode === 'solo') {
    document.getElementById('mode-screen').classList.add('hidden');
    document.getElementById('difficulty-screen').classList.remove('hidden');
  } else {
    document.getElementById('mode-screen').classList.add('hidden');
    document.getElementById('nickname-screen').classList.remove('hidden');
  }
}

// === 멀티 플레이 (PvP) 로직 뼈대 ===

let tempNickname = '';

function confirmNickname() {
  const nickname = document.getElementById('nickname-input').value.trim();
  if (!nickname) return alert('닉네임을 입력해주세요!');

  tempNickname = nickname;
  document.getElementById('confirm-desc').innerText =
    `'${nickname}' (으)로 정말 참가하시겠습니까?`;
  document.getElementById('confirm-screen').classList.remove('hidden');
}

function proceedWithNickname() {
  myNickname = tempNickname;
  document.getElementById('confirm-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('multi-entry-screen').classList.remove('hidden');
}

function cancelNickname() {
  document.getElementById('confirm-screen').classList.add('hidden');
}

function createRoom() {
  isHost = true;

  // 6자리 영문+숫자 랜덤 방 코드 생성
  currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();

  // [로컬 상태] 방을 생성하면서 내 정보를 방장으로 세팅
  roomState = {
    status: 'waiting',
    players: {},
  };
  roomState.players[myNickname] = { isHost: true };

  // Firebase에 방 생성 및 입장
  db.ref('rooms/' + currentRoomId)
    .set(roomState)
    .then(() => {
      enterLobby();
    })
    .catch((error) => {
      alert('방 생성에 실패했습니다: ' + error.message);
    });
}

function joinRoom() {
  const code = document
    .getElementById('room-code-input')
    .value.trim()
    .toUpperCase();

  if (code.length !== 6) return alert('6자리 방 코드를 정확히 입력해주세요!');

  isHost = false;
  currentRoomId = code;

  // Firebase에서 방 존재 여부 확인 후 입장
  db.ref('rooms/' + currentRoomId)
    .once('value')
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.status !== 'waiting')
          return alert('이미 게임이 시작된 방입니다!');
        if (data.players && data.players[myNickname])
          return alert('이미 방에 같은 닉네임이 있습니다!');

        // 내 정보를 Firebase에 추가 후 입장
        db.ref('rooms/' + currentRoomId + '/players/' + myNickname)
          .set({
            isHost: false,
          })
          .then(() => enterLobby());
      } else {
        alert('존재하지 않는 방 코드입니다!');
      }
    });
}

function enterLobby() {
  document.getElementById('multi-entry-screen').classList.add('hidden');
  document.getElementById('multi-lobby-screen').classList.remove('hidden');
  document.getElementById('lobby-room-code').innerText = currentRoomId;

  const startBtn = document.getElementById('lobby-start-btn');
  if (isHost) {
    startBtn.disabled = false;
    startBtn.innerText = '게임 시작 (방장)';
  } else {
    startBtn.disabled = true;
    startBtn.innerText = '방장의 시작 대기중...';
  }

  // Firebase 실시간 플레이어 접속 감지 (리스너 등록)
  db.ref('rooms/' + currentRoomId + '/players').on('value', (snapshot) => {
    const playersData = snapshot.val();
    if (playersData) {
      roomState.players = playersData; // 로컬 상태 업데이트
      updateLobbyUI(); // 화면 갱신
    } else {
      // 방이 폭파된 경우 예외 처리 (나중에 추가)
    }
  });
}

// 데이터(roomState)를 기반으로 화면을 다시 그리는 전용 함수
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
  // 대기실 퇴장 시 Firebase에서 내 데이터 삭제 및 리스너 해제
  db.ref('rooms/' + currentRoomId + '/players').off();
  db.ref('rooms/' + currentRoomId + '/players/' + myNickname).remove();

  // 방 퇴장 시 내 정보를 데이터에서 삭제
  if (roomState.players && roomState.players[myNickname]) {
    delete roomState.players[myNickname];
  }

  document.getElementById('multi-lobby-screen').classList.add('hidden');
  document.getElementById('multi-entry-screen').classList.remove('hidden');
}

function startMultiGame() {
  alert(
    `방 [${currentRoomId}] 게임을 시작합니다!\n(Firebase 연동 후 진행 예정)`,
  );
}

// === 싱글 플레이 전용 로직 ===
function selectDifficulty(level) {
  difficulty = level;
  document.getElementById('difficulty-screen').classList.add('hidden');

  let num = 2;
  if (level === 'easy') {
    num = 2;
  } else if (level === 'normal') {
    num = Math.floor(Math.random() * 2) + 3; // 3명 또는 4명
  } else if (level === 'hard') {
    num = Math.floor(Math.random() * 2) + 5; // 5명 또는 6명
  }

  startGameWithPlayers(num);
}

function startGameWithPlayers(num) {
  numPlayers = num;
  showTurnSelectScreen();
}

function showTurnSelectScreen() {
  document.getElementById('turn-screen').classList.remove('hidden');
  const container = document.getElementById('turn-cards');
  container.innerHTML = '';
  document.getElementById('turn-result').innerText = '';
  hasSelectedTurn = false;

  turnCards = Array(numPlayers).fill('');
  turnCards[Math.floor(Math.random() * numPlayers)] = '先';

  for (let i = 0; i < numPlayers; i++) {
    let card = document.createElement('div');
    card.className = 'turn-card card-back';
    card.onclick = () => selectTurnCard(i);
    container.appendChild(card);
  }
}

function selectTurnCard(selectedIndex) {
  if (hasSelectedTurn) return;
  hasSelectedTurn = true;

  let cardsDom = document.getElementById('turn-cards').children;
  let sunPlayer = -1;
  let compId = 1;

  for (let i = 0; i < numPlayers; i++) {
    cardsDom[i].classList.remove('card-back');
    cardsDom[i].classList.add('revealed');
    cardsDom[i].innerText = turnCards[i];

    let owner = i === selectedIndex ? 0 : compId++;

    if (turnCards[i] === '先') {
      sunPlayer = owner;
      cardsDom[i].style.color = '#d32f2f';
    }
  }

  let resultText =
    sunPlayer === 0
      ? "🎉 내가 '先'을 뽑았습니다! 먼저 시작합니다."
      : `💻 컴퓨터 ${sunPlayer}가 '先'을 뽑았습니다!`;
  document.getElementById('turn-result').innerText = resultText;

  turnTransitionTimer = setTimeout(() => {
    document.getElementById('turn-screen').classList.add('hidden');
    startGamePhase(sunPlayer);
  }, 2500);
}

function startGamePhase(sunPlayer) {
  players = [];
  const fullDeck = generateDeck();

  for (let i = 0; i < numPlayers; i++) {
    players.push({
      id: i,
      isUser: i === 0,
      deck: [],
      table: [],
      isActive: true,
      domCard: i === 0 ? domUserCard : null,
      domDeck: i === 0 ? domUserDeck : null,
      domCount: i === 0 ? domUserCount : null,
      domInfo: i === 0 ? domUserInfo : null,
      name: i === 0 ? '🙋‍♂️ 내 카드' : `💻 컴퓨터 ${i}`,
    });
  }

  let turn = 0;
  while (fullDeck.length > 0) {
    players[turn % numPlayers].deck.push(fullDeck.shift());
    turn++;
  }

  currentTurn = sunPlayer;
  isPlaying = true;
  isLocked = false;

  clearTimeout(comFlipTimer);
  clearTimeout(comReactionTimer);

  setupOpponentsUI();

  document.getElementById('game-container').classList.remove('hidden');
  domStartBtn.classList.add('hidden');

  updateUI();
  if (sunPlayer === 0) {
    showMessage('내 차례입니다! 카드를 뒤집으세요.');
  } else {
    showMessage(`컴퓨터 ${sunPlayer}의 차례입니다.`);
    scheduleComFlip();
  }
}

function userFlip() {
  if (!isPlaying || currentTurn !== 0 || isLocked || isPaused) return;
  let p = players[0];
  if (p.deck.length > 0) {
    p.table.push(p.deck.shift());
    flipSound.currentTime = 0;
    flipSound.play().catch(() => {});
  }
  advanceTurnAndCheck();
}

function comFlip() {
  if (!isPlaying || currentTurn === 0 || isLocked || isPaused) return;
  let p = players[currentTurn];
  if (p.deck.length > 0 && p.isActive) {
    p.table.push(p.deck.shift());
    flipSound.currentTime = 0;
    flipSound.play().catch(() => {});
  }
  advanceTurnAndCheck();
}

function advanceTurnAndCheck() {
  updateUI();
  if (checkGameOver()) return;
  checkAndScheduleComReaction();

  let startingTurn = currentTurn;
  let found = false;
  do {
    currentTurn = (currentTurn + 1) % numPlayers;
    if (players[currentTurn].isActive && players[currentTurn].deck.length > 0) {
      found = true;
      break;
    }
  } while (currentTurn !== startingTurn);

  if (!found) {
    // 뒤집을 카드는 없지만 정답(5개)이 깔렸다면 종 칠 시간(Reaction)을 기다림
    return;
  }

  updateUI();
  if (currentTurn !== 0) {
    scheduleComFlip();
  }
}

function scheduleComFlip() {
  comFlipTimer = setTimeout(
    () => {
      comFlip();
    },
    Math.random() * 500 + 1000,
  );
}

function isExactlyFive() {
  let totals = { '🍎': 0, '🍌': 0, '🍇': 0, '🍓': 0, '🍒': 0 };
  players.forEach((p) => {
    if (p.isActive && p.table.length > 0) {
      let topCard = p.table[p.table.length - 1];
      totals[topCard.fruit] += topCard.count;
    }
  });
  return Object.values(totals).includes(5);
}

function checkAndScheduleComReaction() {
  if (isExactlyFive()) {
    clearTimeout(comFlipTimer);
    let fastestTime = 99999;
    let fastestCom = -1;

    players.forEach((p) => {
      if (!p.isUser && p.isActive) {
        let time;
        if (difficulty === 'easy') {
          time = Math.random() * 800 + 1000; // 1.0초 ~ 1.8초
        } else if (difficulty === 'hard') {
          time = Math.random() * 400 + 300; // 0.3초 ~ 0.7초
        } else {
          time = Math.random() * 600 + 600; // 0.6초 ~ 1.2초
        }

        if (time < fastestTime) {
          fastestTime = time;
          fastestCom = p.id;
        }
      }
    });

    if (fastestCom !== -1) {
      comReactionTimer = setTimeout(() => {
        executeRingBell(fastestCom);
      }, fastestTime);
    }
  }
}

function userRingBell() {
  if (!isPlaying || !players[0].isActive || isLocked || isPaused) return;
  executeRingBell(0);
}

function executeRingBell(player) {
  if (isLocked) return; // 이미 누군가 종을 쳤다면 무시
  isLocked = true; // 추가 입력 방지 잠금

  clearTimeout(comReactionTimer);
  clearTimeout(comFlipTimer);
  bellSound.currentTime = 0;
  bellSound.play().catch(() => {});
  let correct = isExactlyFive();
  let tableCards = [];

  players.forEach((p) => {
    tableCards = tableCards.concat(p.table);
  });

  let ringMsg = '';
  if (correct) {
    animateCardsToWinner(player); // 승자에게 카드 날아가는 애니메이션 실행
    if (player === 0) {
      ringMsg = '🎉 내가 가장 먼저 정답을 맞췄습니다!';
    } else {
      ringMsg = `💻 컴퓨터 ${player}가 가장 먼저 정답을 맞췄습니다!`;
    }
  } else {
    let p = players[player];
    if (p.deck.length > 0) {
      players.forEach((other) => {
        // 나(player)를 제외한 덱이 남아있는 사람들에게 카드를 줌
        if (other.id !== player && other.isActive) {
          other.deck.unshift(p.deck.shift());
        }
      });
      if (player === 0) {
        ringMsg = '❌ 실수! 컴퓨터들에게 카드를 1장씩 줍니다.';
      } else {
        ringMsg = `💻 컴퓨터 ${player}가 실수했습니다! 카드를 나눠 받습니다.`;
      }
    }
  }

  if (ringMsg) {
    showMessage(ringMsg);
    setTimeout(() => {
      if (domMessage.innerText === ringMsg) {
        showMessage('');
      }
    }, 3000);
  }

  // 카운트다운 시작
  const domCountdown = document.getElementById('countdown');
  domCountdown.innerText = '2';
  domCountdown.classList.remove('hidden');
  setTimeout(() => {
    domCountdown.innerText = '1';
  }, 1000);

  // 2초의 텀을 두고 화면 갱신 및 턴 재개
  setTimeout(() => {
    if (!isPlaying) return; // 뒤로가기를 눌러 게임이 종료되었다면 실행 중단
    domCountdown.classList.add('hidden'); // 카운트다운 숨기기
    if (correct) {
      players.forEach((p) => (p.table = []));
      players[player].deck = players[player].deck.concat(tableCards);
      currentTurn = player; // 맞춘 사람이 다음 턴 선공
    }

    if (checkGameOver()) {
      isLocked = false;
      return;
    }

    let startingTurn = currentTurn;
    while (
      !players[currentTurn].isActive ||
      players[currentTurn].deck.length === 0
    ) {
      currentTurn = (currentTurn + 1) % numPlayers;
      if (currentTurn === startingTurn) break;
    }

    isLocked = false;
    updateUI();

    if (currentTurn !== 0 && !isPaused) {
      scheduleComFlip();
    } else {
      showMessage('내 차례입니다! 카드를 뒤집으세요.');
    }
  }, 2000);
}

function checkGameOver() {
  players.forEach((p) => {
    if (p.isActive && p.deck.length === 0 && p.table.length === 0) {
      p.isActive = false;
    }
  });

  if (!players[0].isActive) {
    isPlaying = false;
    updateUI();
    showGameOverModal('패배', '😭 패배했습니다... (내 카드 소진)');
    return true;
  }

  let activeOpponents = players.filter((p) => !p.isUser && p.isActive);
  if (activeOpponents.length === 0) {
    isPlaying = false;
    updateUI();
    showGameOverModal('승리!', '🏆 승리했습니다! 축하합니다!');
    return true;
  }

  // 4. "뒤집을 수 있는 카드(deck)"가 남은 플레이어를 기준으로 게임 승패 즉시 판정
  // 바닥에 정답(5개)이 깔려있지 않아 종을 칠 기회가 없다면 덱이 없는 사람은 즉시 패배 처리
  let ableToFlip = players.filter((p) => p.isActive && p.deck.length > 0);

  if (!isExactlyFive()) {
    if (ableToFlip.length === 1) {
      isPlaying = false;
      updateUI();
      if (ableToFlip[0].isUser) {
        showGameOverModal(
          '승리!',
          '🏆 상대방이 모두 뒤집을 카드를 소진했습니다. 승리!',
        );
      } else {
        showGameOverModal('패배', '😭 내 카드가 모두 소진되었습니다. 패배!');
      }
      return true;
    } else if (ableToFlip.length === 0) {
      isPlaying = false;
      updateUI();
      showGameOverModal(
        '무승부',
        '모든 플레이어가 뒤집을 카드를 소진했습니다.',
      );
      return true;
    }
  }

  return false;
}

function showGameOverModal(title, desc) {
  document.getElementById('game-over-title').innerText = title;
  document.getElementById('game-over-desc').innerText = desc;
  document.getElementById('game-over-screen').classList.remove('hidden');
}
