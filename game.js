// === 게임 로직 및 흐름 제어 ===

function switchScreen(hideId, showId) {
  if (hideId) document.getElementById(hideId).classList.add('hidden');
  if (showId) document.getElementById(showId).classList.remove('hidden');
}

function generateDeck() {
  if (gameType === 'standard') return generateStandardDeck();
  return generateExtendedDeck();
}

function setGameType(type) {
  gameType = type;
  const titleText =
    type === 'standard' ? '할리갈리 Standard' : '할리갈리 Extended';

  const modeScreenH1 = document.querySelector('#mode-screen h1');
  const diffScreenH1 = document.querySelector('#difficulty-screen h1');
  if (modeScreenH1) modeScreenH1.innerText = titleText;
  if (diffScreenH1) diffScreenH1.innerText = titleText;

  const domLobbyType = document.getElementById('lobby-game-type');
  if (domLobbyType)
    domLobbyType.innerText = type === 'standard' ? 'Standard' : 'Extended';

  if (type === 'extended') applyExtendedTheme();
  else applyStandardTheme();
}

function resetToStartScreen() {
  [
    'mode-screen',
    'difficulty-screen',
    'multi-entry-screen',
    'nickname-screen',
    'multi-lobby-screen',
    'turn-screen',
    'game-container',
    'game-over-screen',
  ].forEach((id) => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('type-screen').classList.remove('hidden');
  setGameType('standard'); // 초기화 시 내부 상태(gameType)까지 완벽하게 스탠다드로 원복
  players = [];
  domStartBtn.classList.add('hidden');
  domMessage.innerText = '게임 시작 버튼을 눌러주세요!';
  isPlaying = false;
  isPaused = false;
  clearTimeout(comFlipTimer);
  clearTimeout(comReactionTimer);

  // 멀티 플레이 종료 시 파이어베이스 통신 및 상태 완벽 초기화
  if (currentRoomId) {
    if (gameMode === 'multi') {
      if (isHost) {
        db.ref('rooms/' + currentRoomId)
          .onDisconnect()
          .cancel();
      } else {
        db.ref('rooms/' + currentRoomId + '/gameState/leftPlayer')
          .onDisconnect()
          .cancel();
        db.ref('rooms/' + currentRoomId + '/turnState/leftPlayer')
          .onDisconnect()
          .cancel();
      }
    }
    db.ref('rooms/' + currentRoomId + '/gameState').off();
    db.ref('rooms/' + currentRoomId + '/players').off();
    db.ref('rooms/' + currentRoomId + '/status').off();
    db.ref('rooms/' + currentRoomId + '/turnState').off();
    currentRoomId = '';
    isHost = false;
  }
}

function pauseGame() {
  if (!isPlaying) {
    resetToStartScreen();
    return;
  }

  // 멀티 플레이일 경우 파이어베이스로 일시정지 상태 전송
  if (gameMode === 'multi') {
    db.ref('rooms/' + currentRoomId + '/gameState').update({
      isPaused: true,
      pausedBy: myNickname,
    });
    return;
  }

  isPaused = true;
  clearTimeout(comFlipTimer);
  clearTimeout(comReactionTimer);

  // 싱글 플레이용 일시정지 UI 초기화 (멀티 플레이 잔재 제거)
  const domPauseTitle = document.getElementById('pause-title');
  if (domPauseTitle) {
    domPauseTitle.innerText = '일시정지';
    domPauseTitle.style.fontSize = '';
    domPauseTitle.style.whiteSpace = '';
    document.getElementById('resume-btn').classList.remove('hidden');
    document.getElementById('quit-btn').classList.remove('hidden');
  }

  switchScreen(null, 'pause-screen');
  updateUI();
}

function resumeGame() {
  // 멀티 플레이일 경우 파이어베이스로 계속하기 상태 전송
  if (gameMode === 'multi') {
    if (roomState.status === 'selectingTurn') {
      db.ref('rooms/' + currentRoomId + '/turnState').update({
        isPaused: false,
        pausedBy: '',
      });
      return;
    }

    db.ref('rooms/' + currentRoomId + '/gameState').update({
      isPaused: false,
      pausedBy: '',
    });
    return;
  }

  isPaused = false;
  switchScreen('pause-screen', null);
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
  // 멀티 플레이일 경우
  if (gameMode === 'multi') {
    if (roomState.status === 'selectingTurn') {
      if (isHost) {
        db.ref('rooms/' + currentRoomId + '/turnState').update({
          hostQuit: true,
        });
      } else {
        db.ref('rooms/' + currentRoomId + '/turnState').update({
          leftPlayer: myNickname,
        });
        db.ref('rooms/' + currentRoomId + '/players/' + myNickname).remove();
        switchScreen('pause-screen', null);
        resetToStartScreen();
      }
      return;
    }

    if (isHost) {
      // 방장일 경우: 방 전체 종료 신호 전송
      db.ref('rooms/' + currentRoomId + '/gameState').update({
        hostQuit: true,
        message: '방장에 의해 게임이 종료되었습니다.',
      });
    } else {
      // 방장이 아닐 경우: 탈주 기록을 남기고 나감
      db.ref('rooms/' + currentRoomId + '/gameState').update({
        leftPlayer: myNickname,
      });
      db.ref('rooms/' + currentRoomId + '/players/' + myNickname).remove();
      switchScreen('pause-screen', null);
      resetToStartScreen();
    }
    return;
  }

  switchScreen('pause-screen', null);
  resetToStartScreen();
}

function selectGameType(type) {
  setGameType(type);
  switchScreen('type-screen', 'mode-screen');
}

function goBackToType() {
  setGameType('standard');
  switchScreen('mode-screen', 'type-screen');
}

function goBackToMode() {
  switchScreen('difficulty-screen', 'mode-screen');
}

function goBackToModeFromNickname() {
  switchScreen('nickname-screen', 'mode-screen');
}

function goBackToNicknameFromMulti() {
  switchScreen('multi-entry-screen', 'nickname-screen');
}

function goBackToDifficulty() {
  if (hasSelectedTurn) {
    clearTimeout(turnTransitionTimer);
    hasSelectedTurn = false;
  }
  switchScreen('turn-screen', 'difficulty-screen');
}

function selectGameMode(mode) {
  gameMode = mode;
  if (mode === 'solo') {
    switchScreen('mode-screen', 'difficulty-screen');
  } else {
    switchScreen('mode-screen', 'nickname-screen');
  }
}

// === 싱글 플레이 전용 로직 ===
function selectDifficulty(level) {
  difficulty = level;
  switchScreen('difficulty-screen', 'turn-screen');

  let num = 2;
  if (level === 'normal')
    num = Math.floor(Math.random() * 2) + 3; // 3명 또는 4명
  else if (level === 'hard') num = Math.floor(Math.random() * 2) + 5; // 5명 또는 6명

  numPlayers = num;
  showTurnSelectScreen();
}

function showTurnSelectScreen() {
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

    let owner = i === selectedIndex ? 0 : compId++;
    let ownerName = owner === 0 ? '🙋‍♂️ 나' : `컴퓨터 ${owner}`;

    cardsDom[i].innerHTML =
      `<span class="turn-card-title">${turnCards[i]}</span><span class="turn-card-subtitle">${ownerName}</span>`;

    if (turnCards[i] === '先') {
      sunPlayer = owner;
      cardsDom[i].style.color = '#d32f2f';
    } else {
      cardsDom[i].style.color = '#000';
    }
  }

  let resultText =
    sunPlayer === 0
      ? "🎉 내가 '先'을 뽑았습니다! 먼저 시작합니다."
      : `💻 컴퓨터 ${sunPlayer}가 '先'을 뽑았습니다!`;
  document.getElementById('turn-result').innerText = resultText;

  turnTransitionTimer = setTimeout(() => {
    switchScreen('turn-screen', null);
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

  switchScreen(null, 'game-container');
  domStartBtn.classList.add('hidden');

  updateUI();
  if (sunPlayer === 0) {
    showMessage('내 차례입니다! 카드를 뒤집으세요.');
  } else {
    showMessage(`컴퓨터 ${sunPlayer}의 차례입니다.`);
    scheduleComFlip();
  }
}

// 사용자 액션 분배기 (디스패처)
function userFlip() {
  if (!isPlaying || isLocked || isPaused) return;
  if (gameMode === 'multi') {
    userFlipMulti();
  } else {
    if (currentTurn !== 0) return;
    userFlipSingle();
  }
}

function userFlipSingle() {
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
  if (gameType === 'standard') return checkStandardRule(players);
  return checkExtendedRule(players);
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
  if (gameMode === 'multi') {
    userRingBellMulti();
  } else {
    executeRingBell(0);
  }
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
  switchScreen(null, 'game-over-screen');

  // 승리했을 경우 폭죽 이펙트 실행
  if (title.includes('승리')) {
    if (typeof showFireworks === 'function') showFireworks();
  }
}
