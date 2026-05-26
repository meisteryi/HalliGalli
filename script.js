const fruits = ['🍎', '🍌', '🍇', '🍓'];
// 각 과일별 14장 구성 (1개:5장, 2개:3장, 3개:3장, 4개:2장, 5개:1장)
const cardDistribution = [1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5];

let numPlayers = 2;
let players = [];

let currentTurn = 0; // 0: User, 1~N: Computers
let isPlaying = false;

let comFlipTimer = null;
let comReactionTimer = null;

// DOM Elements
const domUserCount = document.getElementById('user-deck-count');
const domUserCard = document.getElementById('user-card');
const domMessage = document.getElementById('message');
const domUserInfo = document.getElementById('info-0');
const domFlipBtn = document.getElementById('flip-btn');
const domStartBtn = document.getElementById('start-btn');

function showMessage(msg) {
  domMessage.innerText = msg;
}

// 카드 생성 및 셔플
function generateDeck() {
  let deck = [];
  for (let fruit of fruits) {
    for (let count of cardDistribution) {
      deck.push({ fruit, count });
    }
  }
  // Fisher-Yates 셔플
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 시작 화면으로 돌아가기
function resetToStartScreen() {
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('turn-screen').classList.add('hidden');
  document.getElementById('game-container').classList.add('hidden');
  domStartBtn.classList.add('hidden');
  domMessage.innerText = '게임 시작 버튼을 눌러주세요!';
}

// 게임 시작 (인원수 선택)
function startGameWithPlayers(num) {
  numPlayers = num;
  document.getElementById('start-screen').classList.add('hidden');
  showTurnSelectScreen();
}

let turnCards = [];
let hasSelectedTurn = false;

function showTurnSelectScreen() {
  document.getElementById('turn-screen').classList.remove('hidden');
  const container = document.getElementById('turn-cards');
  container.innerHTML = '';
  document.getElementById('turn-result').innerText = '';
  hasSelectedTurn = false;

  // 선 카드 1장, 나머지 백지
  turnCards = Array(numPlayers).fill('');
  turnCards[Math.floor(Math.random() * numPlayers)] = '先';

  for (let i = 0; i < numPlayers; i++) {
    let card = document.createElement('div');
    card.className = 'turn-card';
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

  // 고른 카드는 내(User) 카드가 되고, 나머지는 컴퓨터들에게 무작위 배정
  for (let i = 0; i < numPlayers; i++) {
    cardsDom[i].classList.add('revealed');
    cardsDom[i].innerText = turnCards[i];

    let owner = i === selectedIndex ? 0 : compId++;

    if (turnCards[i] === '先') {
      sunPlayer = owner;
      cardsDom[i].style.color = '#d32f2f'; // 붉은색 강조
    }
  }

  let resultText =
    sunPlayer === 0
      ? "🎉 내가 '先'을 뽑았습니다! 먼저 시작합니다."
      : `💻 컴퓨터 ${sunPlayer}가 '先'을 뽑았습니다!`;
  document.getElementById('turn-result').innerText = resultText;

  // 결과 확인 후 게임 화면으로 전환
  setTimeout(() => {
    document.getElementById('turn-screen').classList.add('hidden');
    startGamePhase(sunPlayer);
  }, 2500);
}

function startGamePhase(sunPlayer) {
  players = [];
  const fullDeck = generateDeck();

  // 플레이어 객체 생성
  for (let i = 0; i < numPlayers; i++) {
    players.push({
      id: i,
      isUser: i === 0,
      deck: [],
      table: [],
      isActive: true,
      domCard: i === 0 ? domUserCard : null,
      domCount: i === 0 ? domUserCount : null,
      domInfo: i === 0 ? domUserInfo : null,
      name: i === 0 ? '🙋‍♂️ 내 카드' : `💻 컴퓨터 ${i}`,
    });
  }

  // 카드 분배 (모든 카드 소진 시까지 인원수대로 분배)
  let turn = 0;
  while (fullDeck.length > 0) {
    players[turn % numPlayers].deck.push(fullDeck.shift());
    turn++;
  }

  currentTurn = sunPlayer;
  isPlaying = true;

  clearTimeout(comFlipTimer);
  clearTimeout(comReactionTimer);

  setupOpponentsUI();

  document.getElementById('game-container').classList.remove('hidden');
  domStartBtn.classList.add('hidden');
  domFlipBtn.classList.remove('hidden');

  updateUI();
  if (sunPlayer === 0) {
    showMessage('내 차례입니다! 카드를 뒤집으세요.');
  } else {
    showMessage(`컴퓨터 ${sunPlayer}의 차례입니다.`);
    scheduleComFlip();
  }
}

// 상대방(컴퓨터) UI 동적 생성
function setupOpponentsUI() {
  const oppContainer = document.getElementById('opponents-container');
  oppContainer.innerHTML = '';
  for (let i = 1; i < numPlayers; i++) {
    let div = document.createElement('div');
    div.className = `opponent-area pos-${numPlayers}-${i}`;
    div.innerHTML = `
            <div class="info" id="info-${i}">${players[i].name}: <span id="com-count-${i}">0</span>장</div>
            <div class="card-slot" id="com-card-${i}"></div>
        `;
    oppContainer.appendChild(div);
    players[i].domCard = document.getElementById(`com-card-${i}`);
    players[i].domCount = document.getElementById(`com-count-${i}`);
    players[i].domInfo = document.getElementById(`info-${i}`);
  }
}

// UI 갱신 (카드 수, 화면에 오픈된 카드 표시 등)
function updateUI() {
  players.forEach((p) => {
    if (p.domCount && p.domCard) {
      p.domCount.innerText = p.deck.length;
      renderCard(p.domCard, p.table[p.table.length - 1]);

      p.domCard.style.opacity = p.isActive ? '1' : '0.3';
      if (p.domInfo) p.domInfo.style.opacity = p.isActive ? '1' : '0.3';

      if (p.domInfo) {
        if (isPlaying && p.isActive && p.id === currentTurn) {
          p.domInfo.classList.add('active-turn');
        } else {
          p.domInfo.classList.remove('active-turn');
        }
      }
    }
  });

  // 내 차례일 때만 버튼 활성화
  domFlipBtn.disabled = currentTurn !== 0 || !isPlaying || !players[0].isActive;
}

function renderCard(element, card) {
  if (!card) {
    element.innerHTML = '';
    return;
  }
  // 이모지를 개수만큼 반복 생성
  let emojis = Array(card.count).fill(card.fruit).join('');
  element.innerHTML = `<div class="card-content">${emojis}</div>`;
}

// 플레이어가 카드 뒤집기
function userFlip() {
  if (!isPlaying || currentTurn !== 0) return;

  let p = players[0];
  if (p.deck.length > 0) {
    p.table.push(p.deck.shift());
  }

  advanceTurnAndCheck();
}

// 컴퓨터가 카드 뒤집기
function comFlip() {
  if (!isPlaying || currentTurn === 0) return;

  let p = players[currentTurn];
  if (p.deck.length > 0 && p.isActive) {
    p.table.push(p.deck.shift());
  }

  advanceTurnAndCheck();
}

// 턴 넘김 및 종 치기 반응 검사
function advanceTurnAndCheck() {
  updateUI();
  if (checkGameOver()) return;
  checkAndScheduleComReaction();

  // 다음 차례 찾기 (카드가 있는 활성 플레이어)
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
    isPlaying = false;
    showMessage('모든 플레이어의 카드가 소진되었습니다.');
    domStartBtn.classList.remove('hidden');
    domStartBtn.innerText = '처음으로';
    return;
  }

  updateUI();

  if (currentTurn !== 0) {
    scheduleComFlip();
  }
}

// 1~1.5초 후 컴퓨터가 카드를 뒤집도록 예약
function scheduleComFlip() {
  comFlipTimer = setTimeout(
    () => {
      comFlip();
    },
    Math.random() * 500 + 1000,
  );
}

// 현재 바닥에 있는 과일 합산이 정확히 5인지 확인
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

// 컴퓨터의 종 치기 AI (5개가 되었을 때 반응)
function checkAndScheduleComReaction() {
  if (isExactlyFive()) {
    clearTimeout(comFlipTimer); // 과일이 5개가 되면 카드 뒤집기를 중단하고 종 칠 준비

    let fastestTime = 99999;
    let fastestCom = -1;

    players.forEach((p) => {
      if (!p.isUser && p.isActive) {
        let time = Math.random() * 600 + 600;
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

// 유저가 종 버튼 클릭
function userRingBell() {
  if (!isPlaying || !players[0].isActive) return;
  executeRingBell(0);
}

// 종 쳤을 때의 처리 (정답 확인 및 카드 분배)
function executeRingBell(player) {
  clearTimeout(comReactionTimer);
  clearTimeout(comFlipTimer);

  let correct = isExactlyFive();
  let tableCards = [];

  players.forEach((p) => {
    tableCards = tableCards.concat(p.table);
  });

  if (correct) {
    // 정답을 맞춘 경우
    players.forEach((p) => (p.table = []));
    players[player].deck = players[player].deck.concat(tableCards);

    if (player === 0) {
      showMessage('🎉 성공! 바닥의 카드를 모두 가져옵니다.');
    } else {
      showMessage(`💻 컴퓨터 ${player}가 먼저 종을 쳤습니다!`);
    }
  } else {
    // 실수한 경우 (패널티: 다른 모든 활성 플레이어에게 카드 1장씩 줌)
    let p = players[player];
    if (p.deck.length > 0) {
      players.forEach((other) => {
        if (other.id !== player && other.isActive && p.deck.length > 0) {
          other.deck.unshift(p.deck.shift());
        }
      });

      if (player === 0) {
        showMessage('❌ 실수! 컴퓨터들에게 카드를 1장씩 줍니다.');
      } else {
        showMessage(`💻 컴퓨터 ${player}가 실수했습니다! 카드를 나눠줍니다.`);
      }
    }
  }

  if (checkGameOver()) return;

  // 종을 쳐서 승리한 사람이 다음 턴을 시작 (오답일 경우 그 다음 턴)
  currentTurn = correct ? player : (player + 1) % numPlayers;

  let startingTurn = currentTurn;
  while (
    !players[currentTurn].isActive ||
    players[currentTurn].deck.length === 0
  ) {
    currentTurn = (currentTurn + 1) % numPlayers;
    if (currentTurn === startingTurn) break; // 무한 반복 방지
  }

  updateUI();

  if (currentTurn !== 0) {
    scheduleComFlip();
  }
}

// 게임 종료 조건 체크
function checkGameOver() {
  // 카드와 바닥이 모두 비어버린 플레이어 아웃 처리
  players.forEach((p) => {
    if (p.isActive && p.deck.length === 0 && p.table.length === 0) {
      p.isActive = false;
    }
  });

  if (!players[0].isActive) {
    isPlaying = false;
    updateUI();
    showMessage('😭 패배했습니다... (내 카드 소진)');
    domStartBtn.classList.remove('hidden');
    domStartBtn.innerText = '처음으로';
    return true;
  }

  // 활성화된 상대 컴퓨터가 없는 경우 승리
  let activeOpponents = players.filter((p) => !p.isUser && p.isActive);
  if (activeOpponents.length === 0) {
    isPlaying = false;
    updateUI();
    showMessage('🏆 승리했습니다! 축하합니다!');
    domStartBtn.classList.remove('hidden');
    domStartBtn.innerText = '처음으로';
    return true;
  }
  return false;
}
