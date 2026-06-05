// === 익스텐디드 모드 전용 로직 ===

function generateExtendedDeck() {
  let deck = [];
  for (let fruit of fruits) {
    for (let count of extendedNormalDistribution) {
      deck.push({ fruit, count, isRotten: false });
    }
    for (let count of extendedRottenDistribution) {
      deck.push({ fruit, count, isRotten: true });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function checkExtendedRule(currentPlayers) {
  let totals = { '🍎': 0, '🍌': 0, '🍇': 0, '🍓': 0 };
  let visibleCount = { '🍎': 0, '🍌': 0, '🍇': 0, '🍓': 0 }; // 깔린 카드 장수 카운트

  currentPlayers.forEach((p) => {
    if (p.isActive && p.table.length > 0) {
      let topCard = p.table[p.table.length - 1];
      visibleCount[topCard.fruit]++;

      if (topCard.isRotten) {
        totals[topCard.fruit] -= topCard.count;
      } else {
        totals[topCard.fruit] += topCard.count;
      }
    }
  });

  // 1. 합산이 정확히 5개일 때
  if (Object.values(totals).includes(5)) return true;

  // 2. 완전 상쇄 룰: 바닥에 과일이 존재하는데 합산이 정확히 0이 될 때
  for (let fruit in totals) {
    if (visibleCount[fruit] > 0 && totals[fruit] === 0) {
      return true;
    }
  }

  return false;
}

function applyExtendedTheme() {
  document.documentElement.style.setProperty('--bg-color', '#0a0f1c');
  document.documentElement.style.setProperty('--btn-bg', '#00e5ff');
  document.documentElement.style.setProperty('--btn-shadow', '#00b8d4');
  document.documentElement.style.setProperty('--btn-text', '#000000');
  document.documentElement.style.setProperty(
    '--main-font',
    "'Black Han Sans', sans-serif",
  );
  document.documentElement.style.setProperty(
    '--title-anim',
    'titleSporty 0.5s infinite ease-in-out',
  );
  document.documentElement.style.setProperty('--main-spacing', '2px');
  document.documentElement.style.setProperty('--main-font-weight', 'normal');
  document.documentElement.style.setProperty('--title-font-weight', 'normal');
  document.querySelectorAll('.floating-fruit').forEach((fruit) => {
    const duration = Math.random() * 3 + 2;
    fruit.style.animationDuration = `${duration}s`;
  });
}

// 썩은 과일 룰 설명 팝업 (모달)
function showExtendedRuleModal(callback) {
  let modal = document.getElementById('extended-rule-modal');

  // 모달 엘리먼트가 없으면 동적으로 생성
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'extended-rule-modal';
    modal.className = 'screen hidden';
    modal.style.position = 'absolute';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    modal.style.zIndex = '1000';

    modal.innerHTML = `
      <h2 style="font-size: 2.5rem; color: #ff5252; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); text-align: center; margin: 0;">⚠️ 썩은 과일 룰 ⚠️</h2>
      <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 12px; font-size: 1.3rem; line-height: 1.8; font-weight: normal; font-family: 'Jua', sans-serif; text-align: center; width: 85%; max-width: 400px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); margin: 0;">
        익스텐디드 모드에는 테두리가 있는<br><strong style="color:#8bc34a;">썩은 과일</strong> 카드가 등장합니다.<br><br>
        썩은 과일이 바닥에 펼쳐져 있다면,<br>
        해당 과일의 총 개수에서<br>
        <strong>썩은 과일의 개수만큼 빼야 합니다.</strong><br><br>
        <span style="font-size:1rem; color:#bbb;">(예: 일반 🍎 4개 + 썩은 🍎 2개 = 총 🍎 2개)</span><br><br>
        합산이 정확히 <strong>5개</strong>가 되거나,<br>
        <strong style="color:#ffeb3b;">합산이 정확히 0개(상쇄)</strong>가 되면 종을 치세요!
      </div>
      <button id="btn-confirm-rule" class="btn" style="flex: none; width: 140px; height: 40px; padding: 0; font-size: 1rem; margin: 0; line-height: 40px;">이해했습니다!</button>
    `;
    document.body.appendChild(modal);
  }

  // 모달 표시
  modal.classList.remove('hidden');

  // 확인 버튼 클릭 시 모달 닫고 다음 화면으로 이동
  document.getElementById('btn-confirm-rule').onclick = () => {
    modal.classList.add('hidden');
    if (callback) callback();
  };
}
