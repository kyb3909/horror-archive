/* 모든 위치는 1536 × 1024 원본 픽셀. rect=[왼쪽,위,폭,높이],
 * arrival/path=[발 x,발 y,키]. image에 WebP 파일 이름을 넣으면 임시 무대가 바뀐다. */
const WORLD = {
  width: 1536, height: 1024,
  scenes: {
    gate: {
      name: '산문', parent: null, image: 'temple-gate.webp',
      description: '젖은 돌계단 끝, 기록을 지키는 산사의 첫 문.',
      arrival: [1100, 970, 210], shelves: ['오늘의 공포 소식', '주간 공포 소식'], 
      exits: [{ id: 'hall', to: 'hall', label: '계단 위 일주문 · 법당', rect: [960, 300, 370, 310],
        path: [[1100,970,210],[1135,820,180],[1150,690,145],[1140,585,110],[1080,535,95]] }]
    },
    hall: {
      name: '법당', parent: 'gate', image: 'temple-hall.webp',
      description: '꺼지지 않은 불단. 세 기록실로 이어지는 갈림길.',
      arrival: [880, 955, 235], shelves: [], 
      exits: [
        { id: 'myeongbu', to: 'myeongbu', label: '왼쪽 옆문 · 명부전', rect: [497,340,163,390], path: [[880,955,235],[700,850,205],[570,765,175],[568,680,145]] },
        { id: 'sansin', to: 'sansin', label: '오른쪽 옆문 · 산신각', rect: [1335,335,169,425], path: [[880,955,235],[1170,875,205],[1390,810,175],[1415,715,145]] },
        { id: 'cave', to: 'cave', label: '불단 뒤 계단 · 지하 동굴', rect: [1040,610,245,190], path: [[880,955,235],[1060,875,215],[1170,790,180],[1130,720,140],[1105,665,105]] },
        { id: 'gate', to: 'gate', label: '돌아 나가기 · 산문', rect: [470,970,650,54], instant: true, path: [] }
      ]
    },
    cave: {
      name: '지하 동굴', parent: 'hall', image: 'cave-candle.webp',
      description: '촛농과 물소리의 자리. 쇠문 너머에 마지막 기록실이 있다.',
      arrival: [770,930,215], shelves: [], 
      exits: [
        { id: 'lab', to: 'lab', label: '왼쪽 쇠문 복도 · 지하 실험실', rect: [125,265,225,330], path: [[770,930,215],[560,790,185],[335,700,160],[248,580,125],[255,520,110]] },
        { id: 'deep', label: '더 깊은 굴', locked: '더 깊은 굴 · 아직 열리지 않았다', rect: [740,350,180,230], path: [[770,930,215],[790,740,175],[815,620,130],[820,565,105]] },
        { id: 'cage', label: '무언가 빠져나간 우리', locked: '무언가 빠져나간 우리 · 아직 열리지 않았다', rect: [1220,275,285,425], path: [[770,930,215],[1040,825,195],[1230,735,170],[1325,670,150]] },
        { id: 'hall', to: 'hall', label: '꺼진 마루 계단 · 법당', rect: [475,0,315,125], instant: true, path: [] }
      ]
    },
    myeongbu: {
      name: '명부전', parent: 'hall', image: null,
      description: '범죄와 연쇄살인 기록. 확인된 사실과 남은 질문을 구분하는 서가.',
      arrival: [768,890,215], shelves: ['연쇄살인','미제 사건','실종','재판 기록'],
      
      exits: [{ id: 'hall', to: 'hall', label: '돌아 나가기 · 법당', rect: [450,960,636,64], instant: true, path: [] }]
    },
    sansin: {
      name: '산신각', parent: 'hall', image: null,
      description: '크립티드와 목격담, 민담 속 짐승을 구분하여 읽는 기록실.',
      arrival: [768,890,215], shelves: ['크립티드','목격담','민담 속 짐승'],
      
      exits: [{ id: 'hall', to: 'hall', label: '돌아 나가기 · 법당', rect: [450,960,636,64], instant: true, path: [] }]
    },
    lab: {
      name: '지하 실험실', parent: 'cave', image: null,
      description: 'SCP 문서 읽기와 격리 등급, 창작 기록을 위한 서가.',
      arrival: [768,890,215], shelves: ['SCP 문서 읽기','격리 등급','창작 기록'],
      
      exits: [{ id: 'cave', to: 'cave', label: '돌아 나가기 · 지하 동굴', rect: [450,960,636,64], instant: true, path: [] }]
    }
  }
};

// ?? 1536?1024 ?? ??. watch=[? x, ? y, ?], ? ??.
// ?? ?? ?? ? ?? ? ?? ?? ?? ??? ?? ????.
Object.assign(WORLD.scenes.gate, { spots: {
  pass: [{from:[1000,548],to:[1250,548],h:85}],
  watch: [[1240,535,90],[675,605,145],[300,760,210]],
  eyes: [[610,420],[245,525]], candles: [[910,585,100,115],[1290,565,85,130],[755,835,100,110]]
}});
Object.assign(WORLD.scenes.hall, { spots: {
  pass: [{from:[1360,563],to:[1480,563],h:90}],
  watch: [[1450,565,95],[1120,620,145],[235,795,225]],
  eyes: [[1125,440],[215,540]], candles: [[1250,680,70,80],[1450,735,85,100],[410,625,42,65]]
}});
Object.assign(WORLD.scenes.cave, { spots: {
  pass: [{from:[235,558],to:[310,558],h:115}],
  watch: [[270,555,110],[1395,610,160],[1170,690,205]],
  eyes: [[285,405],[1370,465]], candles: [[420,500,65,55],[885,565,70,60],[560,480,80,75]]
}});
for (const id of ['myeongbu','sansin','lab']) WORLD.scenes[id].spots = {
  eyes: [[330,440],[1190,460]], candles: [[735,520,65,85]]
};

// 원본 그림을 보고 지정한 어두운 틈. x/y는 1536×1024 기준, 불상은 제외.
// walk=true인 자리는 방문자의 발이 90px 안으로 접근해도 발동한다.
const trapSpot = (x,y,label,reactions,walk=false) => ({x,y,label,reactions:reactions.split(' '),walk});
WORLD.scenes.gate.traps = [
  trapSpot(180,350,'왼쪽 숲','eyes peek afterimage'),
  trapSpot(360,470,'나무 뒤','peek lunge afterimage'),
  trapSpot(580,570,'석탑 뒤','peek turn eyes'),
  trapSpot(300,760,'범종 속','hand eyes lunge'),
  trapSpot(650,705,'바위 틈','hand eyes afterimage'),
  trapSpot(820,460,'전각 문틈','peek turn lunge'),
  trapSpot(845,560,'왼쪽 문기둥 뒤','peek lunge afterimage'),
  trapSpot(1110,410,'안쪽 처마','crawler talisman eyes'),
  trapSpot(1255,500,'오른쪽 숲','eyes peek afterimage'),
  trapSpot(1430,415,'오른쪽 기둥 뒤','peek lunge talisman'),
  trapSpot(980,735,'돌계단 틈','hand candle eyes',true),
  trapSpot(1200,875,'아래 계단','hand afterimage candle',true)
];
WORLD.scenes.hall.traps = [
  trapSpot(180,330,'왼쪽 벽 어둠','eyes turn afterimage'),
  trapSpot(280,650,'기둥 뒤','peek lunge afterimage'),
  trapSpot(445,420,'왼쪽 기둥 틈','peek talisman lunge'),
  trapSpot(610,690,'왼쪽 문턱','hand eyes candle',true),
  trapSpot(710,725,'불단 아래 천','hand afterimage eyes'),
  trapSpot(960,740,'불단 아래 오른쪽','hand candle eyes'),
  trapSpot(1120,475,'불단 옆 어둠','turn peek lunge'),
  trapSpot(1150,710,'계단 아래','hand lunge eyes',true),
  trapSpot(1310,520,'오른쪽 기둥 뒤','peek afterimage talisman'),
  trapSpot(1450,665,'오른쪽 문 밖','eyes turn peek',true),
  trapSpot(540,175,'왼쪽 천장 구석','crawler talisman eyes'),
  trapSpot(1180,190,'오른쪽 들보','crawler talisman afterimage')
];
WORLD.scenes.cave.traps = [
  trapSpot(260,410,'쇠문 틈','peek lunge eyes'),
  trapSpot(340,565,'복도 끝','turn afterimage lunge',true),
  trapSpot(125,650,'향로 뒤','hand eyes candle'),
  trapSpot(380,225,'왼쪽 천장','crawler talisman eyes'),
  trapSpot(720,255,'천장 뿌리','crawler talisman afterimage'),
  trapSpot(1120,250,'오른쪽 천장','crawler eyes talisman'),
  trapSpot(640,580,'바위 뒤','peek hand candle',true),
  trapSpot(820,430,'깊은 굴','turn eyes lunge'),
  trapSpot(1125,555,'우리 왼쪽 틈','peek lunge afterimage'),
  trapSpot(1370,495,'우리 안','eyes hand turn'),
  trapSpot(1250,760,'우리 앞 물가','hand afterimage eyes',true),
  trapSpot(570,860,'왼쪽 물웅덩이','hand eyes candle')
];
for (const id of ['myeongbu','sansin','lab']) WORLD.scenes[id].traps = [
  trapSpot(280,370,'왼쪽 어둠','eyes peek afterimage'),
  trapSpot(1220,380,'오른쪽 틈','eyes peek lunge'),
  trapSpot(510,230,'천장 구석','crawler talisman eyes'),
  trapSpot(1050,690,'바닥 틈','hand eyes turn'),
  trapSpot(650,560,'촛불 뒤','candle talisman afterimage'),
  trapSpot(670,840,'입구 옆','eyes hand candle',true)
];
// 촛불 무더기 전체가 아니라 실제 불꽃 중심만 작은 점으로 드러낸다.
WORLD.scenes.gate.spots.candles = [[928,590,20,25],[1320,587,20,25],[794,866,20,25],[1468,535,20,25],[1025,524,20,25]];
WORLD.scenes.hall.spots.candles = [[435,646,20,25],[785,480,20,25],[937,601,20,25],[1200,568,20,25],[1285,696,20,25],[1498,748,20,25]];
WORLD.scenes.cave.spots.candles = [[440,529,20,25],[570,342,20,25],[761,393,20,25],[902,481,20,25],[976,360,20,25],[916,592,20,25]];

// Reviewed against the artwork; never on the Buddha. Placeholder corners have no artwork.
WORLD.scenes.gate.bigTrap = {x:350,y:370,kind:"forest"};
WORLD.scenes.hall.bigTrap = {x:1100,y:690,kind:"hole"};
WORLD.scenes.cave.bigTrap = {x:825,y:425,kind:"ceiling"};
for (const id of ["myeongbu","sansin","lab"]) WORLD.scenes[id].bigTrap = {x:1300,y:260,kind:"corner"};

// Feet / sprite frame bottoms, outside the Buddha's face and body.
WORLD.scenes.gate.castSpots = {pass:[1040,550,100],corner:[310,765,200],pillar:[1280,620,180],hole:[650,720,120],ceiling:[350,330,140]};
WORLD.scenes.hall.castSpots = {pass:[1430,600,100],corner:[235,795,180],pillar:[1340,670,165],hole:[1135,730,120],ceiling:[1180,260,145]};
WORLD.scenes.cave.castSpots = {pass:[270,560,100],corner:[1395,690,190],pillar:[300,610,165],hole:[570,860,120],ceiling:[1100,300,145]};
for (const id of ['myeongbu','sansin','lab']) {
  WORLD.scenes[id].spots.watch = [[1250,590,160],[1200,710,195],[1130,850,245]];
  WORLD.scenes[id].castSpots = {pass:[1250,590,110],corner:[1250,650,180],pillar:[350,680,180],hole:[1100,800,120],ceiling:[1140,300,145]};
}
WORLD.scenes.gate.visions = [[350,470],[650,705]];
WORLD.scenes.hall.visions = [[280,650],[1310,520]];
WORLD.scenes.myeongbu.visions = [[1220,380],[280,370]];
WORLD.scenes.sansin.visions = [[280,370]];
WORLD.scenes.cave.visions = [[720,255],[570,860]];
WORLD.scenes.lab.visions = [[1220,380]];
// Hard exclusion also clips growing sprites, bug flight and full-scene visions.
WORLD.scenes.hall.sacredRect = [665,180,375,485];
