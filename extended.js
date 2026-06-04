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
  currentPlayers.forEach((p) => {
    if (p.isActive && p.table.length > 0) {
      let topCard = p.table[p.table.length - 1];
      if (topCard.isRotten) {
        totals[topCard.fruit] -= topCard.count;
      } else {
        totals[topCard.fruit] += topCard.count;
      }
    }
  });
  return Object.values(totals).includes(5);
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
