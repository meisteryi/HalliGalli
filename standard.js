// === 스탠다드 모드 전용 로직 ===

function generateStandardDeck() {
  let deck = [];
  for (let fruit of fruits) {
    for (let count of cardDistribution) {
      deck.push({ fruit, count, isRotten: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function checkStandardRule(currentPlayers) {
  let totals = { '🍎': 0, '🍌': 0, '🍇': 0, '🍓': 0 };
  currentPlayers.forEach((p) => {
    if (p.isActive && p.table.length > 0) {
      let topCard = p.table[p.table.length - 1];
      totals[topCard.fruit] += topCard.count;
    }
  });
  return Object.values(totals).includes(5);
}

function applyStandardTheme() {
  document.documentElement.style.setProperty('--bg-color', '#2e7d32');
  document.documentElement.style.setProperty('--btn-bg', '#fbc02d');
  document.documentElement.style.setProperty('--btn-shadow', '#f9a825');
  document.documentElement.style.setProperty('--btn-text', '#000000');
  document.documentElement.style.setProperty(
    '--main-font',
    "'Jua', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif",
  );
  document.documentElement.style.setProperty(
    '--title-anim',
    'titleBounce 2s infinite ease-in-out',
  );
  document.documentElement.style.setProperty('--main-spacing', 'normal');
  document.documentElement.style.setProperty('--main-font-weight', 'bold');
  document.documentElement.style.setProperty('--title-font-weight', '900');
  document.querySelectorAll('.floating-fruit').forEach((fruit) => {
    const duration = Math.random() * 15 + 15;
    fruit.style.animationDuration = `${duration}s`;
  });
}
