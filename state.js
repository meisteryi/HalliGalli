// === Firebase 초기화 세팅 ===
// TODO: 파이어베이스 콘솔에서 발급받은 본인의 설정값으로 덮어씌워주세요!
const firebaseConfig = {
  apiKey: 'AIzaSyD0zaH94f5kBJb0JXhXjf6sJaEtX_E8OQo',
  authDomain: 'halligalli-80827.firebaseapp.com',
  projectId: 'halligalli-80827',
  storageBucket: 'halligalli-80827.firebasestorage.app',
  databaseURL: 'https://halligalli-80827-default-rtdb.firebaseio.com',
  messagingSenderId: '769030189216',
  appId: '1:769030189216:web:af2830bc676eb1d6ee99c5',
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// === 게임 설정 및 전역 변수 ===
const fruits = ['🍎', '🍌', '🍇', '🍓'];
// 각 과일별 14장 구성 (1개:5장, 2개:3장, 3개:3장, 4개:2장, 5개:1장)
const cardDistribution = [1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5];

let gameMode = 'solo'; // 'solo' | 'multi'
let difficulty = 'normal'; // 'easy' | 'normal' | 'hard'
let numPlayers = 2;
let players = [];

let currentTurn = 0; // 0: User, 1~N: Computers
let isPlaying = false;
let isLocked = false; // 동시 입력 방지 및 딜레이용 잠금 변수
let isPaused = false; // 일시정지 상태 변수

let comFlipTimer = null;
let comReactionTimer = null;

let turnCards = [];
let hasSelectedTurn = false;
let turnTransitionTimer = null;

// 멀티 플레이용 변수
let myProfileFruit = '🍎'; // 선택한 프로필 이모지
let myNickname = '';
let currentRoomId = '';
let isHost = false;

// 멀티 플레이 가상 상태(State) - 이후 파이어베이스 데이터와 1:1 매칭될 구조
let roomState = {
  status: 'waiting', // 'waiting' (대기중) | 'playing' (게임중)
  players: {}, // 예: { "닉네임": { isHost: true }, "친구": { isHost: false } }
};

// 오디오 객체 생성
const flipSound = new Audio(
  'https://www.myinstants.com/media/sounds/click.mp3',
);
const bellSound = new Audio(
  'https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3',
);
const btnSound = new Audio(
  'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
);

const domUserCount = document.getElementById('user-deck-count');
const domUserCard = document.getElementById('user-card');
const domUserDeck = document.getElementById('user-deck');
const domMessage = document.getElementById('message');
const domUserInfo = document.getElementById('info-0');
const domStartBtn = document.getElementById('start-btn');

// 레이아웃 미세 조정 (내 덱과 낸 카드가 겹치지 않게 간격을 250px로 넓히기)
const layoutFix = document.createElement('style');
layoutFix.innerHTML = `
  .player-area .cards-container { width: 250px !important; }
  .player-area .deck-slot { left: 0 !important; }
  .player-area .card-slot { right: 0 !important; }
`;
document.head.appendChild(layoutFix);
