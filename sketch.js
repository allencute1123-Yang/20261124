// ============================================================
// 角色動畫 (圖片精靈) - p5.js
// 操作：
//   A / D   : 向左 / 向右走路 (角色會朝向移動方向)
//   空白鍵  : 跳躍
//   滑鼠左鍵: 施放技能 (技能前方會出現特效)
// chara2：
//   ↑ ↓ ← →  : 移動 (←→ 左右走、↑↓ 在地面上前後走)
//   chara1 碰到 chara2 -> chara2 出招 (atta) 並出一題 Minecraft 常識題，按 1/2/3 或點選答案
//   答完題目 -> chara2 退開 -> chara1 施放魔法 (magic + magic_effect)
//   魔法命中 chara2 -> chara2 倒地 (lose) -> 戰鬥結束
// ============================================================

// ---------- ① 精靈圖設定 ----------
// frames: null  -> 自動偵測每一格 (依「完全透明的直行」切開，適合透明背景的橫向精靈圖)
// frames: 數字  -> 手動指定格數，圖片寬度平均切成 N 格
// 如果自動偵測切得不對，請直接改成正確的格數
const SPRITES = {
  walk:  { path: 'chara1/walk/walk.png',                 frames: 8,  fps: 12 },
  jump:  { path: 'chara1/jump/jump.png',                 frames: 13, fps: 16 },
  magic: { path: 'chara1/magic/magic.png',               frames: 4,  fps: 8  },
  fx:    { path: 'chara1/magic_effect/magic_effect.png', frames: 5,  fps: 15 },

  // ★ chara2 (路徑相對於 index.html，檔名請依你的實際檔案修改)
  walk2: { path: 'chara2/walk/walk.png',                frames: 6,  fps: 10 },
  atta2: { path: 'chara2/atta/atta.png',                  frames: 9,  fps: 10 },
  lose2: { path: 'chara2/lose/lose.png',                  frames: 11, fps: 8  },
};

// 自動偵測參數
const ALPHA_THRESHOLD = 10; // alpha 大於此值才算有像素
const MIN_GAP = 2;          // 連續幾排透明直行才算兩格之間的間隔
const MIN_FRAME_W = 8;      // 寬度小於此值的碎片會被忽略

// ---------- 背景設定 ----------
// ╔══════════════════════════════════════════════════════════╗
// ║  ★★★ 把你的背景圖片位置貼在下面三行的引號裡 ★★★          ║
// ║  路徑是「相對於 index.html」，例如：                      ║
// ║     'bg1.png'          (圖片和 index.html 在同一層)       ║
// ║     'bg/bg1.png'       (圖片在 bg 資料夾裡)               ║
// ║  ※ 不能貼 C:\Users\... 這種電腦完整路徑，瀏覽器讀不到   ║
// ║  執行時按 1 / 2 / 3 可切換背景                            ║
// ╚══════════════════════════════════════════════════════════╝
const BG_FILES = [
  'bg/bg1.png',   // ★ 背景 1 的位置貼這裡
  'bg/bg2.png',   // ★ 背景 2 的位置貼這裡
  'bg/bg3.png',   // ★ 背景 3 的位置貼這裡
];
// 若其中一個檔案其實是「三張併在一起」的 5410×1200 原圖，程式會自動切成三張
const SHEET_W = 5410, SHEET_H = 1200;
const SHEET_PANELS = [      // 每張的 [x, y, 寬, 高]，已避開原圖外圍的深灰色邊框
  [37, 114, 1729, 971],
  [1842, 116, 1725, 969],
  [3648, 116, 1724, 968],
];

// 自動去除背景圖外圍的深灰色邊框 (避免拼接處出現黑線)；沒有邊框的圖不受影響
const BORDER_COLOR = [51, 58, 68];
const BORDER_TOL = 40;   // 與邊框色的 RGB 差距總和小於此值就算邊框
const BORDER_MAX = 40;   // 每一邊最多檢查/裁掉幾個像素
const BORDER_EXTRA = 2;  // 發現邊框時，多往內裁幾個像素 (去掉過渡色)
const BG_MIRROR = true; // true：相鄰的背景左右鏡像拼接，接縫不會突兀；false：直接重複

// 去除白邊 (原圖邊緣有一圈淺色殘邊，載入後自動清掉；不會修改你的 png 檔)
const REMOVE_HALO_FOR = ['walk', 'jump', 'magic']; // 要處理的精靈圖 (特效圖不處理)
const HALO_PASSES = 3;    // 由外往內清幾圈，白邊還在就加大，輪廓被吃掉就減小
const HALO_MIN_LIGHT = 140; // RGB 三個值都大於此值才算「淺色」
const HALO_MAX_SAT = 40;    // 最大與最小色差小於此值才算「偏白/灰」

// ---------- ② 其他參數 ----------
const CHAR_HEIGHT_RATIO = 1 / 3; // 角色高度 = 畫布高度的 1/3
const REF_SPRITE = 'walk';       // 以此精靈圖的高度當作「角色標準高度」
let SCALE = 1;                   // 放大倍率 (自動計算，等比例縮放，寬高比不變)
const SPRITE_FACES_RIGHT = true; // 原圖角色是否朝右？若原圖朝左請改成 false
const WALK_SPEED = 2.5;          // 走路速度 (以原圖像素為單位，會乘上 SCALE)
const GRAVITY = 0.45;            // 重力 (同上)
const JUMP_POWER = 9;            // 跳躍初速 (同上)
const MAGIC_FIRE_FRAME = 2;      // 施法動畫第幾格時放出特效 (從 0 開始)
const FX_SPEED = 5;              // 特效往前飛的速度 (同上)
const FX_LIFE = 90;              // 特效存活的 frame 數
const FX_OFFSET = 115;           // 特效中心與角色中心的水平距離 (原圖像素，會乘上 SCALE)
const FX_HEIGHT = 0.6;           // 特效高度 (佔施法角色高度的比例，從腳底算起)
const FX_SCALE = 1;              // 特效相對於角色的放大倍率

// ---------- chara2 / 戰鬥設定 ----------
const NPC_START_OFFSET = 0.35;   // chara2 起始位置 = 畫布寬度 * 此值 (在 chara1 右側)
const NPC_DEPTH_UP = 0.08;       // 按 ↑ 最多往上走多遠 (畫布高度比例)
const NPC_DEPTH_DOWN = 0.05;     // 按 ↓ 最多往下走多遠
const NPC_Y_SPEED_RATIO = 0.6;   // 上下移動速度相對於左右速度
const HIT_HALF_W = 0.20;         // 碰撞盒半寬 (佔角色高度比例)，越大越容易碰到
const HIT_DEPTH = 0.35;          // 上下相差多少以內算碰到 (佔角色高度比例)；chara1 跳起來可跳過 chara2
const ATTACK_HIT_FRAMES = [4, 5, 6]; // atta 動畫中「踢中」的格，chara1 這幾格會閃紅
const BATTLE_RESULT_MS = 1500;   // 顯示「答對 / 答錯」的時間
const BATTLE_COOLDOWN_MS = 2500; // 戰鬥結束後多久內不會再觸發

// 答完題目後的魔法攻擊
const MAGIC_ONLY_IF_CORRECT = false; // true：只有答對才會放魔法；false：不論對錯都放魔法
const MAGIC_DISTANCE = 1.5;      // 放魔法前 chara2 先退到離 chara1 多遠 (單位：角色高度)
const RETREAT_SPEED_RATIO = 3;   // chara2 後退速度 (相對於走路速度)
const FX_HIT_HALF = 0.10;        // 魔法特效的命中半寬 (單位：角色高度)，與 HIT_HALF_W 相加判定命中
const MAGIC_TIMEOUT_MS = 3500;   // 魔法放出後這麼久都沒命中就結束戰鬥 (保險用)

// ╔══════════════════════════════════════════════════════════╗
// ║  Minecraft 常識題題庫                                    ║
// ║  q：題目　a：正確答案　w：錯誤答案 (至少 2 個，每次隨機抽 2 個) ║
// ║  想新增題目，照格式多加一行即可；選項建議 12 個字以內      ║
// ╚══════════════════════════════════════════════════════════╝
const QUESTION_BANK = [
  { q: '苦力怕靠近玩家後會做什麼？', a: '爆炸', w: ['噴火', '召喚殭屍', '發射箭矢'] },
  { q: '苦力怕會躲避哪種動物？', a: '貓', w: ['狗', '豬', '雞'] },
  { q: '要用哪種鎬子（或更好的）才能挖到鑽石礦？', a: '鐵鎬', w: ['木鎬', '石鎬', '金鎬'] },
  { q: '用木板可以合成哪個方塊，來製作大部分道具？', a: '工作台', w: ['熔爐', '附魔台', '鐵砧'] },
  { q: '熔爐是用哪種材料製作的？', a: '圓石', w: ['沙子', '泥土', '木板'] },
  { q: '要建造地獄傳送門，需要用什麼方塊？', a: '黑曜石', w: ['鑽石塊', '玻璃', '圓石'] },
  { q: '擊敗哪一個 Boss 通常被視為遊戲通關？', a: '終界龍', w: ['凋零怪', '苦力怕', '村民'] },
  { q: '終界使者會被什麼東西傷害？', a: '水', w: ['陽光', '沙子', '草方塊'] },
  { q: '直視終界使者的眼睛會怎樣？', a: '它會對你發動攻擊', w: ['它會變成朋友', '它會消失', '它會送你禮物'] },
  { q: '殭屍在陽光下會怎樣？', a: '著火燃燒', w: ['變得更強', '變成村民', '隱形'] },
  { q: '骷髏死亡時會掉落什麼？', a: '骨頭', w: ['鑽石', '羊毛', '皮革'] },
  { q: '可以用骨頭馴服哪種動物？', a: '狼', w: ['貓', '馬', '豬'] },
  { q: '雞會掉落哪種物品？', a: '羽毛', w: ['皮革', '羊毛', '骨頭'] },
  { q: '用剪刀可以從哪種動物身上取得羊毛？', a: '羊', w: ['牛', '豬', '雞'] },
  { q: '拿著桶子對牛按右鍵會得到什麼？', a: '牛奶', w: ['水', '岩漿', '蜂蜜'] },
  { q: '紅石粉主要用來做什麼？', a: '製作電路與機關', w: ['當作食物', '製作盔甲', '染色'] },
  { q: '用鋤頭對草方塊使用，會變成什麼？', a: '農地', w: ['沙子', '石頭', '水'] },
  { q: '製作鐵魔像需要 4 個鐵塊和一個什麼？', a: '雕刻過的南瓜', w: ['西瓜', '蘋果', '金塊'] },
  { q: '召喚凋零怪需要幾顆凋零骷髏頭顱？', a: '3 顆', w: ['1 顆', '2 顆', '5 顆'] },
  { q: '大部分方塊在背包中，一疊最多可以堆疊幾個？', a: '64 個', w: ['16 個', '32 個', '100 個'] },
  { q: '工作台的合成格是幾乘幾？', a: '3 × 3', w: ['2 × 2', '4 × 4', '1 × 1'] },
  { q: '玩家背包裡的合成格是幾乘幾？', a: '2 × 2', w: ['3 × 3', '4 × 4', '1 × 1'] },
  { q: '鞘翅可以讓玩家做什麼？', a: '滑翔飛行', w: ['水下呼吸', '隱形', '瞬間移動'] },
  { q: '鞘翅可以在哪裡找到？', a: '終界船', w: ['沙漠神殿', '村莊', '海底神殿'] },
  { q: '拿著不死圖騰時遇到致命傷害會怎樣？', a: '免於一死並恢復生命', w: ['傳送回出生點', '變成隱形', '什麼也不會發生'] },
  { q: '地獄要塞位於哪個維度？', a: '地獄', w: ['終界', '主世界'] },
  { q: '哪種生物會掉落烈焰棒？', a: '烈焰使者', w: ['地獄幽靈', '苦力怕', '豬布林'] },
  { q: '附魔台的合成材料包含哪種寶石？', a: '鑽石', w: ['綠寶石', '紅石', '煤炭'] },
  { q: '村民交易時主要使用哪種貨幣？', a: '綠寶石', w: ['鑽石', '金錠', '鐵錠'] },
  { q: '在水中太久會因為缺少什麼而受傷？', a: '空氣', w: ['食物', '陽光', '溫度'] },
  { q: '睡在什麼上面可以跳過夜晚？', a: '床', w: ['營火', '木門', '工作台'] },
  { q: '豬布林喜歡哪種金屬？', a: '金', w: ['鐵', '銅'] },
  { q: '可以用什麼來馴服貓？', a: '生魚', w: ['骨頭', '小麥', '胡蘿蔔'] },
  { q: '要騎馬並控制方向，需要先裝備什麼？', a: '馬鞍', w: ['蘋果', '鞘翅', '頭盔'] },
  { q: '擊敗凋零怪會掉落什麼？', a: '地獄之星', w: ['龍蛋', '烈焰棒', '鑽石'] },
  { q: '終界龍死亡後，會出現哪個特別的方塊？', a: '龍蛋', w: ['信標', '鑽石塊', '地獄之星'] },
  { q: '挖泥土用哪種工具最快？', a: '鏟子', w: ['斧頭', '鎬子', '鋤頭'] },
  { q: '砍樹用哪種工具最快？', a: '斧頭', w: ['鏟子', '鎬子', '鋤頭'] },
  { q: '玩家滿血時有幾顆心？', a: '10 顆', w: ['5 顆', '15 顆', '20 顆'] },
  { q: '在地獄裡睡覺，床會發生什麼事？', a: '爆炸', w: ['變成鑽石', '什麼事也沒有'] },
  { q: '遊戲中的一天(日夜循環)約是現實的幾分鐘？', a: '20 分鐘', w: ['10 分鐘', '30 分鐘', '60 分鐘'] },
  { q: '把水倒在岩漿「源頭」上，會變成什麼？', a: '黑曜石', w: ['玻璃', '沙子', '鑽石'] },
  { q: 'Minecraft 最初是由誰開發的？', a: 'Notch', w: ['Herobrine', 'Steve', 'Alex'] },
  { q: '遊戲預設的男性角色叫什麼名字？', a: 'Steve', w: ['Alex', 'Herobrine', 'Notch'] },
  { q: '蜘蛛在白天通常是什麼態度？', a: '中立', w: ['友善', '會變成村民', '會消失'] },
  { q: '小麥可以用來餵哪種動物？', a: '牛', w: ['豬', '雞', '狼'] },
  { q: '胡蘿蔔可以用來餵哪種動物？', a: '豬', w: ['牛', '羊', '雞'] },
  { q: '喝下什麼可以清除身上的所有藥水效果？', a: '牛奶', w: ['水', '蜂蜜', '蘋果'] },
  { q: '丟出終界珍珠會發生什麼事？', a: '傳送到落點', w: ['飛上天空', '召喚終界使者', '變成隱形'] },
];
let questionDeck = []; // 還沒出過的題目 (出完會重新洗牌，確保不會一直重複)

// ---------- 全域變數 ----------
let imgs = {};
let frameList = {}; // frameList[key] = [{sx, sw}, ...]
let player = {
  x: 0,
  y: 0,          // 腳底相對地面的高度偏移 (0 = 站在地上，負值 = 在空中)
  vy: 0,
  facing: 1,     // 1 = 右, -1 = 左
  state: 'idle', // idle / walk / jump / magic
  stateStart: 0,
  fired: false,
};
let effects = [];
let bgImgs = [];   // bgImgs[i] = 第 i 張背景 (載入完成前為 undefined)
let bgIndex = 0;
let bgFromSheet = false;

let SCALE2 = 1;     // chara2 的放大倍率 (自動計算)
let npc = {         // chara2
  x: 0,             // 世界座標
  dy: 0,            // 相對地面的上下偏移 (像素；負值 = 往畫面上方)
  facing: -1,
  moving: false,
  lose: null,       // 被魔法打中時為 { start }，播放 lose 動畫
};
let battle = null;  // 戰鬥狀態：null 或 { phase: 'attack' | 'question' | 'result', start, q, picked, correct, buttons }
let battleCooldownUntil = 0;
let score = { right: 0, total: 0 };

// ============================================================
function preload() {
  for (let key in SPRITES) {
    imgs[key] = loadImage(SPRITES[key].path);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight); // 全螢幕
  noSmooth();
  for (let key of REMOVE_HALO_FOR) removeHalo(imgs[key]);
  for (let key in SPRITES) {
    frameList[key] = buildFrames(key);
    console.log(key + ' 偵測到 ' + frameList[key].length + ' 格', frameList[key]);
  }
  updateScale();
  loadBackgrounds();
  player.x = 0; // 角色在「世界」中的位置；畫面上角色固定在中央，由背景捲動
  npc.x = width * NPC_START_OFFSET;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateScale();
}

// ============================================================
// 背景載入 (依上方 BG_FILES 的路徑)
// ============================================================
function loadBackgrounds() {
  BG_FILES.forEach((path, i) => {
    loadImage(
      path,
      img => onBgLoaded(i, img, path),
      () => console.warn('背景載入失敗，請檢查 BG_FILES 的路徑：' + path)
    );
  });
}

function onBgLoaded(index, img, path) {
  console.log('背景 ' + (index + 1) + ' 載入成功：' + path);
  if (bgFromSheet) return;

  // 載入的是三張併在一起的原圖 -> 切成三張
  if (img.width === SHEET_W && img.height === SHEET_H) {
    bgImgs = SHEET_PANELS.map(([x, y, w, h]) => img.get(x, y, w, h));
    bgFromSheet = true;
    return;
  }
  bgImgs[index] = trimBorder(img);
}

// 去除圖片四周的深灰色邊框：由外往內，整排(列)大多是邊框色就裁掉
function trimBorder(img) {
  const w = img.width, h = img.height;
  img.loadPixels();
  const px = img.pixels;
  const isBorder = i =>
    abs(px[i] - BORDER_COLOR[0]) + abs(px[i + 1] - BORDER_COLOR[1]) + abs(px[i + 2] - BORDER_COLOR[2]) < BORDER_TOL;

  const colIsBorder = x => {
    let c = 0, n = 0;
    for (let y = 0; y < h; y += 3) { n++; if (isBorder((y * w + x) * 4)) c++; }
    return c / n > 0.5;
  };
  const rowIsBorder = y => {
    let c = 0, n = 0;
    for (let x = 0; x < w; x += 3) { n++; if (isBorder((y * w + x) * 4)) c++; }
    return c / n > 0.5;
  };

  let l = 0, r = 0, t = 0, b = 0;
  while (l < BORDER_MAX && colIsBorder(l)) l++;
  while (r < BORDER_MAX && colIsBorder(w - 1 - r)) r++;
  while (t < BORDER_MAX && rowIsBorder(t)) t++;
  while (b < BORDER_MAX && rowIsBorder(h - 1 - b)) b++;

  if (l + r + t + b === 0) return img; // 沒有邊框
  if (l) l += BORDER_EXTRA;
  if (r) r += BORDER_EXTRA;
  if (t) t += BORDER_EXTRA;
  if (b) b += BORDER_EXTRA;
  console.log('背景邊框已裁掉 (左 右 上 下)：', l, r, t, b);
  return img.get(l, t, w - l - r, h - t - b);
}

// 角色高度固定為畫布高度的 1/3，寬度依原圖比例等比例縮放
function updateScale() {
  SCALE = (height * CHAR_HEIGHT_RATIO) / imgs[REF_SPRITE].height;
  SCALE2 = (height * CHAR_HEIGHT_RATIO) / imgs.walk2.height; // chara2 也是畫布高度的 1/3
}

// ============================================================
// 去除白邊：由外往內，把「貼著透明區、顏色偏白或淺灰」的像素變成透明
// ============================================================
function removeHalo(img) {
  const w = img.width;
  const h = img.height;
  img.loadPixels();
  const px = img.pixels;

  for (let pass = 0; pass < HALO_PASSES; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (px[i + 3] === 0) continue;

        const r = px[i], g = px[i + 1], b = px[i + 2];
        const lo = min(r, g, b);
        const hi = max(r, g, b);
        if (lo <= HALO_MIN_LIGHT || hi - lo >= HALO_MAX_SAT) continue; // 不是白邊色

        // 8 個鄰居中是否有透明像素
        let nearEmpty = false;
        for (let dy = -1; dy <= 1 && !nearEmpty; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (px[(ny * w + nx) * 4 + 3] === 0) { nearEmpty = true; break; }
          }
        }
        if (nearEmpty) kill.push(i);
      }
    }
    if (kill.length === 0) break;
    for (const i of kill) px[i + 3] = 0;
  }
  img.updatePixels();
}

// ============================================================
// 切割精靈圖
// ============================================================
function buildFrames(key) {
  const img = imgs[key];
  const cfg = SPRITES[key];
  const w = img.width;
  const h = img.height;
  const list = [];

  // 手動：平均切
  if (typeof cfg.frames === 'number') {
    const fw = w / cfg.frames;
    for (let i = 0; i < cfg.frames; i++) {
      list.push({ sx: i * fw, sw: fw });
    }
    return list;
  }

  // 自動：找出有像素的連續直行
  img.loadPixels();
  let start = -1;
  let lastFilled = -1;

  for (let x = 0; x < w; x++) {
    let filled = false;
    for (let y = 0; y < h; y++) {
      if (img.pixels[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD) {
        filled = true;
        break;
      }
    }
    if (filled) {
      if (start === -1) start = x;
      lastFilled = x;
    } else if (start !== -1 && x - lastFilled > MIN_GAP) {
      pushRun(list, start, lastFilled);
      start = -1;
    }
  }
  if (start !== -1) pushRun(list, start, lastFilled);

  // 偵測失敗 (例如圖片沒有透明背景) -> 整張當作 1 格
  if (list.length === 0) list.push({ sx: 0, sw: w });
  return list;
}

function pushRun(list, x0, x1) {
  const sw = x1 - x0 + 1;
  if (sw >= MIN_FRAME_W) list.push({ sx: x0, sw: sw });
}

// ============================================================
function draw() {
  const groundY = height * 0.8;

  updatePlayer();
  updateNPC();
  updateLose();
  updateBattle();
  checkTouch();
  drawBackground();
  updateEffects();
  checkMagicHit();

  // 依「腳底位置」決定先後：越靠畫面上方 (越遠) 的先畫
  if (npc.dy < 0) {
    drawNPC(groundY);
    drawPlayer(groundY);
  } else {
    drawPlayer(groundY);
    drawNPC(groundY);
  }
  drawEffects(groundY);
  drawOffscreenHint(groundY);
  drawQuiz();

  fill(255);
  stroke(0);
  strokeWeight(3);
  textSize(16);
  textAlign(LEFT, TOP);
  text('chara1：A / D 移動、空白鍵跳躍、滑鼠左鍵施放技能　chara2：方向鍵 ↑↓←→ 移動　1 / 2 / 3：切換背景', 20, 20);
  text('碰到 chara2 -> Minecraft 常識題 -> chara1 放魔法打倒 chara2　　答對 ' + score.right + ' / 作答 ' + score.total, 20, 44);
  noStroke();
}

// ============================================================
// 捲動式背景：背景高度 = 畫布高度，寬度依原圖比例；
// 依角色在世界中的位置 (player.x) 往左右無限拼接，角色往右走背景就往左捲
// ============================================================
function drawBackground() {
  // 選到的背景還沒載入 / 找不到時，改用任何一張已載入的
  const img = bgImgs[bgIndex] || bgImgs.find(b => b);
  if (!img) {
    background(30, 34, 48);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(18);
    text('找不到背景圖 bg1 / bg2 / bg3，請確認檔案放在 index.html 旁邊 (按 F12 看 Console)', width / 2, height / 2);
    return;
  }
  const bgH = height;
  const bgW = ceil(height * img.width / img.height);
  const left = player.x - width / 2; // 畫面左緣對應的世界座標

  background(0);
  for (let i = floor(left / bgW); i * bgW < left + width; i++) {
    const sx = round(i * bgW - left);
    const mirrored = BG_MIRROR && ((i % 2) + 2) % 2 === 1;
    if (mirrored) {
      push();
      translate(sx + bgW + 1, 0);
      scale(-1, 1);
      image(img, 0, 0, bgW + 1, bgH);
      pop();
    } else {
      image(img, sx, 0, bgW + 1, bgH);
    }
  }
}

// ============================================================
// 狀態與移動
// ============================================================
function setState(s) {
  if (player.state !== s) {
    player.state = s;
    player.stateStart = millis();
    if (s === 'magic') player.fired = false;
  }
}

function onGround() {
  return player.y >= 0;
}

function updatePlayer() {
  const frozen = battle !== null;     // 戰鬥中 chara1 不能操作
  const left = !frozen && keyIsDown(65);  // A
  const right = !frozen && keyIsDown(68); // D

  // 施法中：不能移動，等動畫播完
  if (player.state === 'magic') {
    const n = frameList.magic.length;
    const elapsed = (millis() - player.stateStart) / 1000;
    const idx = floor(elapsed * SPRITES.magic.fps);

    if (!player.fired && idx >= min(MAGIC_FIRE_FRAME, n - 1)) {
      spawnEffect();
      player.fired = true;
    }
    if (idx >= n) {
      setState('idle');
    }
    return;
  }

  let moving = false;
  if (left && !right) {
    player.x -= WALK_SPEED * SCALE;
    player.facing = -1;
    moving = true;
  } else if (right && !left) {
    player.x += WALK_SPEED * SCALE;
    player.facing = 1;
    moving = true;
  }

  player.vy += GRAVITY * SCALE;
  player.y += player.vy;
  if (player.y >= 0) {
    player.y = 0;
    player.vy = 0;
  }


  if (!onGround()) {
    setState('jump');
  } else if (moving) {
    setState('walk');
  } else {
    setState('idle');
  }
}

function keyPressed() {
  // 戰鬥中：1 / 2 / 3 用來作答，其他按鍵不處理
  if (battle) {
    if (battle.phase === 'question' && (key === '1' || key === '2' || key === '3')) {
      answerQuestion(int(key) - 1);
    }
    return false;
  }

  // 方向鍵不要讓網頁捲動
  if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW || keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
    return false;
  }

  if (key === '1' || key === '2' || key === '3') {
    bgIndex = int(key) - 1;
  }
  if (keyCode === 32) {
    if (onGround() && player.state !== 'magic') {
      player.vy = -JUMP_POWER * SCALE;
      player.y = -1;
      setState('jump');
    }
    return false; // 避免網頁捲動
  }
}

function mousePressed() {
  // 戰鬥中：點選答案按鈕
  if (battle) {
    if (battle.phase === 'question') {
      for (const b of battle.buttons || []) {
        if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
          answerQuestion(b.idx);
          break;
        }
      }
    }
    return;
  }
  if (mouseButton === LEFT && onGround() && player.state !== 'magic') {
    setState('magic');
  }
}

// ============================================================
// 特效
// ============================================================
function maxFrameW(key) {
  let m = 0;
  for (let f of frameList[key]) m = max(m, f.sw);
  return m;
}

function spawnEffect() {
  effects.push({
    x: player.x + player.facing * FX_OFFSET * SCALE, // 角色前方
    dir: player.facing,
    born: millis(),
    life: FX_LIFE,
  });
}

function updateEffects() {
  for (let e of effects) {
    e.x += e.dir * FX_SPEED * SCALE;
    e.life--;
  }
  effects = effects.filter(e => e.life > 0 && abs(e.x - player.x) < width);
}

function drawEffects(groundY) {
  const img = imgs.fx;
  const frames = frameList.fx;
  const fh = img.height;
  const charH = imgs.magic.height * SCALE;

  for (let e of effects) {
    const idx = floor(((millis() - e.born) / 1000) * SPRITES.fx.fps) % frames.length;
    const f = frames[idx];

    push();
    translate(e.x - player.x + width / 2, groundY - charH * FX_HEIGHT); // 約在角色雙手高度
    scale(e.dir * (SPRITE_FACES_RIGHT ? 1 : -1), 1);
    image(
      img,
      -f.sw * SCALE * FX_SCALE / 2, -fh * SCALE * FX_SCALE / 2,
      f.sw * SCALE * FX_SCALE, fh * SCALE * FX_SCALE,
      f.sx, 0, f.sw, fh
    );
    pop();
  }
}

// ============================================================
// 繪製角色
// ============================================================
function drawPlayer(groundY) {
  let key, loop;
  switch (player.state) {
    case 'walk':  key = 'walk';  loop = true;  break;
    case 'jump':  key = 'jump';  loop = false; break;
    case 'magic': key = 'magic'; loop = false; break;
    default:      key = 'walk';  loop = true;  break; // 待機：顯示走路第 0 格
  }

  const img = imgs[key];
  const frames = frameList[key];
  const n = frames.length;
  const fh = img.height;

  let idx = 0;
  if (player.state !== 'idle') {
    const elapsed = (millis() - player.stateStart) / 1000;
    idx = floor(elapsed * SPRITES[key].fps);
    idx = loop ? idx % n : min(idx, n - 1);
  }
  const f = frames[idx];

  push();
  translate(width / 2, groundY + player.y); // 角色固定在畫面中央，原點在腳底
  scale(player.facing * (SPRITE_FACES_RIGHT ? 1 : -1), 1);
  if (isHitFlash()) tint(255, 110, 110); // 被 chara2 踢中時閃紅
  image(
    img,
    -f.sw * SCALE / 2, -fh * SCALE,
    f.sw * SCALE, fh * SCALE,
    f.sx, 0, f.sw, fh
  );
  pop();
}

// ============================================================
// chara2：方向鍵控制
// ============================================================
function updateNPC() {
  npc.moving = false;
  if (npc.lose) return; // 倒地動畫中不能操作

  // 戰鬥中 chara2 不能操作；放魔法前的 'retreat' 階段會自動後退
  if (battle) {
    if (battle.phase === 'retreat' || battle.phase === 'magic') {
      const away = npc.x >= player.x ? 1 : -1; // 遠離 chara1 的方向
      const targetDist = MAGIC_DISTANCE * height * CHAR_HEIGHT_RATIO;
      if (abs(npc.x - player.x) < targetDist) {
        npc.x += away * WALK_SPEED * SCALE * RETREAT_SPEED_RATIO;
        npc.moving = true;
      }
      npc.facing = -away; // 面向 chara1 倒退走
    }
    return;
  }

  const l = keyIsDown(LEFT_ARROW);
  const r = keyIsDown(RIGHT_ARROW);
  const u = keyIsDown(UP_ARROW);
  const d = keyIsDown(DOWN_ARROW);
  const sp = WALK_SPEED * SCALE; // 與 chara1 相同的畫面速度

  if (l && !r) { npc.x -= sp; npc.facing = -1; npc.moving = true; }
  else if (r && !l) { npc.x += sp; npc.facing = 1; npc.moving = true; }

  if (u && !d) { npc.dy -= sp * NPC_Y_SPEED_RATIO; npc.moving = true; }
  else if (d && !u) { npc.dy += sp * NPC_Y_SPEED_RATIO; npc.moving = true; }

  npc.dy = constrain(npc.dy, -height * NPC_DEPTH_UP, height * NPC_DEPTH_DOWN);
}

function npcAttackIndex() {
  if (!battle) return -1;
  return floor(((millis() - battle.start) / 1000) * SPRITES.atta2.fps);
}

function isHitFlash() {
  return battle !== null && battle.phase === 'attack' && ATTACK_HIT_FRAMES.includes(npcAttackIndex());
}

function drawNPC(groundY) {
  const sx = npc.x - player.x + width / 2; // chara2 在畫面上的 x
  if (sx < -500 || sx > width + 500) return;

  let key = 'walk2';
  let idx = 0;
  if (npc.lose) {
    key = 'lose2';
    idx = min(floor(((millis() - npc.lose.start) / 1000) * SPRITES.lose2.fps), frameList.lose2.length - 1);
  } else if (battle && battle.phase === 'attack') {
    key = 'atta2';
    idx = min(npcAttackIndex(), frameList.atta2.length - 1);
  } else if (npc.moving) {
    idx = floor((millis() / 1000) * SPRITES.walk2.fps) % frameList.walk2.length;
  }

  const img = imgs[key];
  const f = frameList[key][idx];
  const fh = img.height;

  push();
  translate(sx, groundY + npc.dy);
  scale(npc.facing, 1); // chara2 的原圖朝右
  image(
    img,
    -f.sw * SCALE2 / 2, -fh * SCALE2,
    f.sw * SCALE2, fh * SCALE2,
    f.sx, 0, f.sw, fh
  );
  pop();
}

// chara2 跑出畫面時，在畫面邊緣提示方向
function drawOffscreenHint(groundY) {
  const sx = npc.x - player.x + width / 2;
  if (sx >= 0 && sx <= width) return;
  push();
  fill(255, 220, 80);
  stroke(0);
  strokeWeight(3);
  textSize(20);
  textAlign(sx < 0 ? LEFT : RIGHT, CENTER);
  text(sx < 0 ? '◀ chara2' : 'chara2 ▶', sx < 0 ? 20 : width - 20, groundY - height * CHAR_HEIGHT_RATIO / 2);
  pop();
}

// ============================================================
// 碰撞與戰鬥
// ============================================================
function checkTouch() {
  if (battle || npc.lose || millis() < battleCooldownUntil) return;

  const h3 = height * CHAR_HEIGHT_RATIO;          // 角色高度
  const closeX = abs(npc.x - player.x) < 2 * HIT_HALF_W * h3;
  const closeY = abs(player.y - npc.dy) < HIT_DEPTH * h3; // 腳底高度差 (chara1 跳起來時會變大)
  if (closeX && closeY) startBattle();
}

function startBattle() {
  battle = {
    phase: 'attack',   // attack：chara2 出招 -> question：出題 -> result：顯示對錯
    start: millis(),
    q: makeQuestion(),
    picked: null,
    correct: false,
    buttons: [],
  };
  // 雙方面對面
  npc.facing = player.x >= npc.x ? 1 : -1;
  player.facing = -npc.facing;
}

function updateBattle() {
  if (!battle) return;
  const t = millis() - battle.start;

  if (battle.phase === 'attack') {
    // atta 動畫播完 -> 出題
    if (npcAttackIndex() >= frameList.atta2.length) {
      battle.phase = 'question';
      battle.start = millis();
    }
  } else if (battle.phase === 'result') {
    // 顯示完對錯 -> chara2 後退，準備吃魔法
    if (t >= BATTLE_RESULT_MS) {
      if (MAGIC_ONLY_IF_CORRECT && !battle.correct) {
        endBattle();
      } else {
        battle.phase = 'retreat';
        battle.start = millis();
      }
    }
  } else if (battle.phase === 'retreat') {
    // chara2 退到定位、chara1 站在地上 -> chara1 施放魔法
    const h3 = height * CHAR_HEIGHT_RATIO;
    if (abs(npc.x - player.x) >= MAGIC_DISTANCE * h3 && onGround()) {
      battle.phase = 'magic';
      battle.start = millis();
      player.facing = npc.x >= player.x ? 1 : -1; // 面向 chara2
      setState('magic');                           // 之後由 updatePlayer 播放動畫並在指定格放出特效
    }
  } else if (battle.phase === 'magic') {
    // 保險：魔法一直沒命中就直接結束
    if (t > MAGIC_TIMEOUT_MS && !npc.lose) endBattle();
  }
  // 'lose' 階段由 updateLose() 負責結束
}

function endBattle() {
  battle = null;
  battleCooldownUntil = millis() + BATTLE_COOLDOWN_MS;
  // 若 chara2 離 chara1 太近，推開一段距離，避免馬上又碰到
  const h3 = height * CHAR_HEIGHT_RATIO;
  if (abs(npc.x - player.x) < h3) {
    const dir = npc.x >= player.x ? 1 : -1;
    npc.x = player.x + dir * h3;
  }
}

// ============================================================
// 魔法命中 -> chara2 倒地 (lose)
// ============================================================
function checkMagicHit() {
  if (npc.lose) return;
  if (battle && battle.phase !== 'magic') return; // 戰鬥中只有「答題後的魔法」才算
  const h3 = height * CHAR_HEIGHT_RATIO;
  if (abs(npc.dy) >= HIT_DEPTH * h3) return;       // 特效在地面那條線上飛，chara2 走得太遠(上下)就打不到

  for (const e of effects) {
    if (e.life > 0 && abs(e.x - npc.x) < (HIT_HALF_W + FX_HIT_HALF) * h3) {
      e.life = 0; // 特效命中後消失
      startLose(e.dir);
      break;
    }
  }
  effects = effects.filter(e => e.life > 0);
}

function startLose(effectDir) {
  npc.lose = { start: millis() };
  npc.facing = -effectDir; // 面向魔法飛來的方向
  if (battle) battle.phase = 'lose';
}

function updateLose() {
  if (!npc.lose) return;
  const idx = floor(((millis() - npc.lose.start) / 1000) * SPRITES.lose2.fps);
  if (idx >= frameList.lose2.length) {   // lose 動畫播完
    npc.lose = null;
    if (battle) endBattle();
  }
}

// ============================================================
// Minecraft 常識題：從題庫抽題 (出完一輪才會重複)，選項順序隨機
// ============================================================
function makeQuestion() {
  if (questionDeck.length === 0) {
    questionDeck = shuffle(QUESTION_BANK.map((_, i) => i));
  }
  const item = QUESTION_BANK[questionDeck.pop()];
  const options = shuffle([item.a, ...shuffle(item.w).slice(0, 2)]);
  return { text: item.q, answer: item.a, options: options };
}

function answerQuestion(i) {
  if (!battle || battle.phase !== 'question' || i < 0 || i >= battle.q.options.length) return;
  battle.picked = i;
  battle.correct = battle.q.options[i] === battle.q.answer;
  score.total++;
  if (battle.correct) score.right++;
  battle.phase = 'result';
  battle.start = millis();
}

// 依寬度自動換行 (逐字判斷，中英文都適用)；呼叫前要先設好 textSize
function wrapText(str, maxW) {
  const lines = [];
  let line = '';
  for (const ch of str) {
    if (line !== '' && textWidth(line + ch) > maxW) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// 以 (cx, cy) 為中心繪製自動換行的文字
function drawWrapped(str, cx, cy, maxW, leading) {
  const lines = wrapText(str, maxW);
  const y0 = cy - ((lines.length - 1) * leading) / 2;
  lines.forEach((ln, i) => text(ln, cx, y0 + i * leading));
}

function drawQuiz() {
  if (!battle || (battle.phase !== 'question' && battle.phase !== 'result')) return;

  const q = battle.q;
  const k = constrain(height / 800, 0.7, 1.1); // 依畫面高度縮放版面
  const pw = min(width * 0.94, 640);
  const fk = k * min(1, pw / 640);              // 窄螢幕時文字再縮小一點
  const ph = 300 * k;
  const px = width / 2 - pw / 2;
  const py = max(64, height * 0.06);

  push();
  // 面板
  noStroke();
  fill(20, 24, 36, 225);
  rect(px, py, pw, ph, 16);

  textAlign(CENTER, CENTER);
  fill(255, 220, 80);
  textSize(20 * k);
  text('Minecraft 常識挑戰！', width / 2, py + 26 * k);

  // 題目
  fill(255);
  textSize(26 * fk);
  drawWrapped(q.text, width / 2, py + 100 * k, pw - 40, 34 * k);

  // 三個答案按鈕
  const gap = 14;
  const bw = (pw - gap * 4) / 3;
  const bh = 76 * k;
  const by = py + 158 * k;
  battle.buttons = [];

  for (let i = 0; i < q.options.length; i++) {
    const bx = px + gap + i * (bw + gap);
    battle.buttons.push({ x: bx, y: by, w: bw, h: bh, idx: i });

    let c = color(70, 90, 140);
    if (battle.phase === 'question') {
      const hover = mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;
      if (hover) c = color(100, 130, 200);
    } else {
      if (q.options[i] === q.answer) c = color(60, 160, 90);          // 正確答案 -> 綠
      else if (i === battle.picked) c = color(190, 70, 70);            // 選錯的 -> 紅
      else c = color(60, 66, 84);
    }
    fill(c);
    rect(bx, by, bw, bh, 12);

    fill(255);
    textSize(22 * fk);
    drawWrapped((i + 1) + '. ' + q.options[i], bx + bw / 2, by + bh / 2, bw - 16, 28 * k);
  }

  // 提示 / 結果
  textSize(20 * k);
  const ty = by + bh + 32 * k;
  if (battle.phase === 'question') {
    fill(210);
    text('按 1 / 2 / 3 或點選答案', width / 2, ty);
  } else if (battle.correct) {
    fill(120, 230, 140);
    text('答對了！', width / 2, ty);
  } else {
    fill(255, 130, 130);
    drawWrapped('答錯了，正確答案是「' + q.answer + '」', width / 2, ty, pw - 40, 26 * k);
  }
  pop();
}