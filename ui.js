// === UI 업데이트 관련 기능 ===

// 모든 버튼 클릭 시 귀여운 소리 재생 (누르는 즉시 반응하도록 pointerdown 사용)
document.addEventListener('pointerdown', (e) => {
  const isButton =
    e.target.closest('.btn') ||
    e.target.closest('.back-btn') ||
    e.target.closest('.turn-card');
  if (isButton && !e.target.closest(':disabled')) {
    btnSound.currentTime = 0;
    btnSound.play().catch(() => {});
  }
});

function showMessage(msg) {
  domMessage.innerText = msg;
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
            <div class="cards-container">
                <div class="card-slot" id="com-card-${i}"></div>
            </div>
        `;
    oppContainer.appendChild(div);
    players[i].domCard = document.getElementById(`com-card-${i}`);
    players[i].domCount = document.getElementById(`com-count-${i}`);
    players[i].domInfo = document.getElementById(`info-${i}`);
  }
}

let lastWarningDeckCount = 999;
let warningTimer = null;

// UI 갱신 (카드 수, 화면에 오픈된 카드 표시 등)
function updateUI() {
  players.forEach((p) => {
    if (p.domCount && p.domCard) {
      p.domCount.innerText = p.deck.length;
      renderCard(p.domCard, p.table[p.table.length - 1]);
      p.domCard.style.opacity = p.isActive ? '1' : '0.3';

      if (p.domDeck) {
        p.domDeck.style.opacity = p.isActive ? '1' : '0.3';
        updateDeckThickness(p.domDeck, p.deck.length);
      }

      if (p.domInfo) p.domInfo.style.opacity = p.isActive ? '1' : '0.3';
      if (p.domInfo) {
        if (isPlaying && p.isActive && p.id === currentTurn) {
          p.domInfo.classList.add('active-turn');
        } else {
          p.domInfo.classList.remove('active-turn');
        }

        if (gameMode === 'multi' && p.isWaitingInLobby) {
          p.domInfo.innerHTML = `${p.name}<br><span style="font-size:0.8em">(대기실로 나감)</span>`;
          p.domInfo.style.opacity = '0.5';
          p.domCard.style.visibility = 'hidden';
          if (p.domDeck) p.domDeck.style.visibility = 'hidden';
        } else {
          if (p.id !== 0) {
            p.domInfo.innerHTML = `${p.name}: <span id="com-count-${p.id}">${p.deck.length}</span>장`;
            p.domCount = document.getElementById(`com-count-${p.id}`);
          } else {
            p.domInfo.innerHTML = `🙋‍♂️ 내 카드: <span id="user-deck-count">${p.deck.length}</span>장`;
            p.domCount = document.getElementById(`user-deck-count`);
          }
        }
      }
    }
  });

  // 덱 잔여 카드 수 경고 표시 (5장 이하일 때)
  if (players.length > 0 && players[0].isActive) {
    let currentCount = players[0].deck.length;
    if (
      currentCount <= 5 &&
      currentCount > 0 &&
      currentCount < lastWarningDeckCount
    ) {
      showWarningMessage(`⚠️ 내 카드가 ${currentCount}장 남았습니다! ⚠️`);
    }
    lastWarningDeckCount = currentCount;
  }
}

function showWarningMessage(msg) {
  const warningEl = document.getElementById('warning-message');
  if (!warningEl) return;
  warningEl.innerText = msg;
  warningEl.classList.remove('hidden');

  clearTimeout(warningTimer);
  warningTimer = setTimeout(() => {
    warningEl.classList.add('hidden');
  }, 1500); // 1.5초 후 자동으로 사라짐
}

// 남은 카드 수에 따라 덱의 3D 그림자 두께를 동적으로 조절
function updateDeckThickness(element, count) {
  if (count === 0) {
    element.style.visibility = 'hidden';
  } else {
    element.style.visibility = 'visible';
    let thickness = Math.min(count, 15); // 최대 두께 15px 제한
    let shadow = '';
    for (let i = 1; i <= thickness; i++) {
      shadow += `${i}px ${i}px 0 #900000, `;
    }
    shadow += `${thickness + 2}px ${thickness + 2}px 5px rgba(0,0,0,0.5)`;
    element.style.boxShadow = shadow;
  }
}

// 바닥에 쌓인 카드 개수에 따라 겹쳐 있는 듯한 그림자 효과를 줌
function updateTableThickness(element, count) {
  if (count <= 1) {
    element.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
  } else {
    let thickness = Math.min(count - 1, 6); // 최대 6장까지 겹친 효과
    let shadow = '';
    // 카드가 살짝 어긋나게 쌓이는 효과를 주기 위한 지그재그 오프셋
    const xOffsets = [-3, 5, -2, 4, -4, 3];
    let currentX = 0;
    let currentY = 0;

    for (let i = 0; i < thickness; i++) {
      currentX += xOffsets[i];
      currentY += 4; // 아래로 4px씩 단층 형성
      // 흰색 바탕(0 0 #fff)과 실선 윤곽선(0 2px #555)을 겹겹이 추가하여 명확하게 구분
      shadow += `${currentX}px ${currentY}px 0 0 #fff, ${currentX}px ${currentY}px 0 2px #555, `;
    }
    // 가장 아래쪽의 최종 그림자
    shadow += `${currentX}px ${currentY + 6}px 10px 2px rgba(0, 0, 0, 0.4)`;
    element.style.boxShadow = shadow;
  }
}

function renderCard(element, card) {
  if (!card) {
    element.innerHTML = '';
    element.style.visibility = 'hidden'; // 카드가 없을 땐 흰 배경 박스 완전히 숨기기
    element.classList.remove('rotten-card');
    return;
  }
  element.style.visibility = 'visible'; // 카드가 등장하면 다시 보이기
  // 각각의 이모지를 개별 span으로 감싸서 줄바꿈(wrap)과 간격(gap)이 작동하게 수정
  let emojis = Array(card.count).fill(`<span>${card.fruit}</span>`).join('');
  let extraClass = ` count-${card.count}`;

  if (card.isRotten) {
    extraClass += ' rotten';
    element.classList.add('rotten-card');
  } else {
    element.classList.remove('rotten-card');
  }

  element.innerHTML = `<div class="card-content${extraClass}">${emojis}</div>`;
}

// 승자에게 카드가 날아가는 애니메이션
function animateCardsToWinner(winnerId) {
  const winnerP = players[winnerId];
  const targetRect = winnerP.domInfo.getBoundingClientRect(); // 카드가 날아갈 목표 위치 (이름표/카드 수)

  players.forEach((p) => {
    if (p.table.length > 0) {
      const rect = p.domCard.getBoundingClientRect();
      const animCard = document.createElement('div');
      animCard.className = p.domCard.className; // 썩은 과일 등의 원본 클래스 그대로 복사
      animCard.innerHTML = p.domCard.innerHTML;

      animCard.style.position = 'fixed';
      animCard.style.left = rect.left + 'px';
      animCard.style.top = rect.top + 'px';
      animCard.style.width = rect.width + 'px';
      animCard.style.height = rect.height + 'px';
      animCard.style.zIndex = '9999';
      animCard.style.transition = 'all 0.6s ease-in-out';
      animCard.style.margin = '0';

      document.body.appendChild(animCard);
      p.domCard.innerHTML = ''; // 원본 카드는 즉시 숨김
      p.domCard.style.visibility = 'hidden'; // 흰 바탕 테두리 등 잔여물 완벽 숨김
      p.domCard.classList.remove('rotten-card'); // 썩은 과일 속성 초기화

      void animCard.offsetWidth; // 브라우저 렌더링 강제 업데이트 (Reflow)

      animCard.style.left = targetRect.left + 'px';
      animCard.style.top = targetRect.top + 'px';
      animCard.style.transform = 'scale(0.2) rotate(360deg)';
      animCard.style.opacity = '0';

      setTimeout(() => {
        if (animCard.parentNode) animCard.remove();
      }, 600);
    }
  });
}

// === 배경 과일 애니메이션 동적 생성 ===
function createFloatingFruits() {
  const bg = document.createElement('div');
  bg.className = 'floating-bg';
  document.body.prepend(bg);

  const fruitIcons = ['🍎', '🍌', '🍇', '🍓'];
  // 과일 20개를 랜덤한 위치와 크기로 생성
  for (let i = 0; i < 20; i++) {
    const fruit = document.createElement('div');
    fruit.className = 'floating-fruit';
    fruit.innerText = fruitIcons[Math.floor(Math.random() * fruitIcons.length)];

    const size = Math.random() * 4 + 2; // 2rem ~ 6rem 크기
    const left = Math.random() * 100; // 가로 0~100%
    const top = Math.random() * 100; // 세로 0~100%
    const duration = Math.random() * 15 + 15; // 15초 ~ 30초 동안 이동
    const delay = Math.random() * -30; // 시작 타이밍 랜덤 (바로 보이도록 음수값)

    fruit.style.fontSize = `${size}rem`;
    fruit.style.left = `${left}%`;
    fruit.style.top = `${top}%`;
    fruit.style.animationDuration = `${duration}s`;
    fruit.style.animationDelay = `${delay}s`;

    bg.appendChild(fruit);
  }
}

document.addEventListener('DOMContentLoaded', createFloatingFruits);

// 승리 시 폭죽 애니메이션 (Confetti)
function showFireworks() {
  const colors = [
    '#fbc02d',
    '#d32f2f',
    '#4caf50',
    '#2196f3',
    '#9c27b0',
    '#ff9800',
  ];
  for (let i = 0; i < 150; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor =
      colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = Math.random() * 2 + 2 + 's';
    confetti.style.animationDelay = Math.random() * 2 + 's';

    // 50% 확률로 동그란 모양 적용
    if (Math.random() > 0.5) confetti.style.borderRadius = '50%';

    document.body.appendChild(confetti);

    // 애니메이션이 끝나면 DOM에서 깔끔하게 제거
    setTimeout(() => confetti.remove(), 5000);
  }
}

// 방 코드 복사 기능
function copyRoomCode() {
  const code = document.getElementById('lobby-room-code').innerText;
  if (code && code !== '------') {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        alert(
          `방 코드 [${code}]가 클립보드에 복사되었습니다! 친구에게 붙여넣기 하세요.`,
        );
      })
      .catch((err) => {
        alert(
          '복사에 실패했습니다. 직접 코드를 선택해서 복사해 주세요: ' + err,
        );
      });
  }
}
