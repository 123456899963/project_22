// 茶·图鉴 原型 Mock 数据
// 说明：原型阶段用内存数据，后续由 Python 后端接口替换。

const CATEGORIES = [
  { name: "绿茶", color: "#6E8F55", soft: "#EDF2E9" },
  { name: "白茶", color: "#B7A57F", soft: "#F5F2EB" },
  { name: "黄茶", color: "#C6A244", soft: "#F8F3E3" },
  { name: "乌龙", color: "#A5713F", soft: "#F5EDE6" },
  { name: "红茶", color: "#9A3B32", soft: "#F6EAE8" },
  { name: "黑茶", color: "#4A3A2E", soft: "#EFEDEA" }
];

// 原型用本地 SVG 占位图，断网也能完整演示；正式项目替换为管理员上传的真实茶图。
function teaImage(name, category) {
  const cat = CATEGORIES.find(function (c) { return c.name === category; }) || CATEGORIES[0];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">' +
      '<rect width="800" height="600" fill="' + cat.soft + '"/>' +
      '<circle cx="400" cy="258" r="132" fill="#FFFFFF" opacity="0.5"/>' +
      '<circle cx="400" cy="258" r="112" fill="none" stroke="' + cat.color + '" stroke-width="5" opacity="0.45"/>' +
      '<ellipse cx="400" cy="248" rx="56" ry="23" fill="' + cat.color + '" opacity="0.82" transform="rotate(-24 400 248)"/>' +
      '<line x1="358" y1="288" x2="440" y2="216" stroke="#FFFFFF" stroke-width="4" opacity="0.7"/>' +
      '<text x="400" y="462" text-anchor="middle" font-size="38" fill="#1B2721" font-family="PingFang SC, Microsoft YaHei, sans-serif">' + name + '</text>' +
      '<text x="400" y="508" text-anchor="middle" font-size="20" fill="#5B6B62" font-family="PingFang SC, Microsoft YaHei, sans-serif">' + category + ' · 原型占位图</text>' +
    '</svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const TEAS = [
  {
    id: "longjing",
    name: "西湖龙井",
    category: "绿茶",
    origin: "浙江杭州",
    season: "明前",
    price: "800-3000 元/斤",
    fermentation: "不发酵",
    shape: "扁平挺直，芽叶成朵",
    liquor: "杏绿明亮",
    aroma: "豆香清高",
    taste: "鲜爽回甘，收敛性弱",
    temp: "80℃",
    amount: "3g",
    time: "1-2 分钟",
    favorites: 128,
    tips: [
      { t: "水温", d: "80℃ 左右，避免沸水烫熟芽叶。" },
      { t: "投茶", d: "150ml 水配 3g 茶，比例约 1:50。" },
      { t: "出汤", d: "首泡 1 分钟，二泡 1.5 分钟。" },
      { t: "存放", d: "密封避光冷藏，开封后尽快喝完。" }
    ]
  },
  {
    id: "biluochun",
    name: "碧螺春",
    category: "绿茶",
    origin: "江苏苏州",
    season: "明前",
    price: "600-2000 元/斤",
    fermentation: "不发酵",
    shape: "卷曲成螺，满披白毫",
    liquor: "嫩绿明亮",
    aroma: "花果香馥郁",
    taste: "鲜甜细腻，回甘持久",
    temp: "80℃",
    amount: "3g",
    time: "1 分钟",
    favorites: 96,
    tips: [
      { t: "水温", d: "80℃ 为宜，高温易出苦涩。" },
      { t: "投茶", d: "上投法更利于观察芽叶舒展。" },
      { t: "出汤", d: "首泡 1 分钟即可，不宜久闷。" },
      { t: "存放", d: "铝箔袋密封，冷藏保存。" }
    ]
  },
  {
    id: "liuan",
    name: "六安瓜片",
    category: "绿茶",
    origin: "安徽六安",
    season: "雨前",
    price: "500-1500 元/斤",
    fermentation: "不发酵",
    shape: "单片叶，形似瓜子",
    liquor: "黄绿明亮",
    aroma: "板栗香",
    taste: "醇厚鲜爽",
    temp: "85℃",
    amount: "4g",
    time: "2 分钟",
    favorites: 74,
    tips: [
      { t: "水温", d: "85℃ 可激发板栗香。" },
      { t: "投茶", d: "200ml 水配 4g 茶。" },
      { t: "出汤", d: "首泡 2 分钟，可续泡 3 次。" },
      { t: "存放", d: "干燥避光，常温密封。" }
    ]
  },
  {
    id: "baihaoyinzhen",
    name: "白毫银针",
    category: "白茶",
    origin: "福建福鼎",
    season: "春茶",
    price: "1200-4000 元/斤",
    fermentation: "微发酵",
    shape: "芽头肥壮，满披白毫",
    liquor: "浅杏黄",
    aroma: "毫香显露",
    taste: "清鲜甘甜",
    temp: "90℃",
    amount: "4g",
    time: "3 分钟",
    favorites: 142,
    tips: [
      { t: "水温", d: "90℃ 左右，老茶可略高。" },
      { t: "投茶", d: "150ml 水配 4g 茶。" },
      { t: "出汤", d: "首泡 3 分钟，其后递减。" },
      { t: "存放", d: "干燥阴凉，适合长期陈放。" }
    ]
  },
  {
    id: "baimudan",
    name: "白牡丹",
    category: "白茶",
    origin: "福建政和",
    season: "春茶",
    price: "300-900 元/斤",
    fermentation: "微发酵",
    shape: "一芽一二叶，毫心显露",
    liquor: "橙黄明亮",
    aroma: "花香清雅",
    taste: "醇和鲜甜",
    temp: "90℃",
    amount: "5g",
    time: "3 分钟",
    favorites: 88,
    tips: [
      { t: "水温", d: "90℃，避免高温闷出涩味。" },
      { t: "投茶", d: "150ml 水配 5g 茶。" },
      { t: "出汤", d: "首泡 3 分钟，可续泡 4 次。" },
      { t: "存放", d: "避光防潮，可陈化。" }
    ]
  },
  {
    id: "shoumei",
    name: "寿眉",
    category: "白茶",
    origin: "福建福鼎",
    season: "秋茶",
    price: "100-400 元/斤",
    fermentation: "微发酵",
    shape: "叶态稍展，毫心较少",
    liquor: "琥珀色",
    aroma: "枣香、陈香",
    taste: "醇厚顺滑",
    temp: "95℃",
    amount: "6g",
    time: "3 分钟",
    favorites: 63,
    tips: [
      { t: "水温", d: "95℃ 更适合粗老叶。" },
      { t: "投茶", d: "150ml 水配 6g 茶。" },
      { t: "出汤", d: "可煮饮，枣香更明显。" },
      { t: "存放", d: "陈放三年以上风味更佳。" }
    ]
  },
  {
    id: "junshan",
    name: "君山银针",
    category: "黄茶",
    origin: "湖南岳阳",
    season: "明前",
    price: "1000-3000 元/斤",
    fermentation: "轻发酵",
    shape: "芽头肥直，金毫显露",
    liquor: "杏黄明净",
    aroma: "清香带甜",
    taste: "鲜爽甘醇",
    temp: "85℃",
    amount: "3g",
    time: "2 分钟",
    favorites: 51,
    tips: [
      { t: "水温", d: "85℃，保持芽头完整。" },
      { t: "投茶", d: "150ml 水配 3g 茶。" },
      { t: "出汤", d: "首泡 2 分钟，可续 2 次。" },
      { t: "存放", d: "密封防潮，避免高温。" }
    ]
  },
  {
    id: "mengding",
    name: "蒙顶黄芽",
    category: "黄茶",
    origin: "四川雅安",
    season: "明前",
    price: "600-1800 元/斤",
    fermentation: "轻发酵",
    shape: "芽叶扁直，色泽嫩黄",
    liquor: "黄亮",
    aroma: "甜香清雅",
    taste: "鲜醇回甘",
    temp: "85℃",
    amount: "3g",
    time: "2 分钟",
    favorites: 47,
    tips: [
      { t: "水温", d: "85℃ 避免涩味。" },
      { t: "投茶", d: "150ml 水配 3g 茶。" },
      { t: "出汤", d: "首泡 2 分钟。" },
      { t: "存放", d: "密封冷藏，尽快饮用。" }
    ]
  },
  {
    id: "huoshanhuangya",
    name: "霍山黄芽",
    category: "黄茶",
    origin: "安徽霍山",
    season: "雨前",
    price: "400-1200 元/斤",
    fermentation: "轻发酵",
    shape: "芽叶挺直，色泽黄绿",
    liquor: "嫩黄明亮",
    aroma: "栗香",
    taste: "醇和鲜爽",
    temp: "85℃",
    amount: "4g",
    time: "2 分钟",
    favorites: 39,
    tips: [
      { t: "水温", d: "85℃ 左右。" },
      { t: "投茶", d: "200ml 水配 4g 茶。" },
      { t: "出汤", d: "首泡 2 分钟，可续 2 次。" },
      { t: "存放", d: "避光密封，防异味。" }
    ]
  },
  {
    id: "rougui",
    name: "武夷肉桂",
    category: "乌龙",
    origin: "福建武夷山",
    season: "春茶",
    price: "800-5000 元/斤",
    fermentation: "半发酵",
    shape: "条索紧结，色泽乌褐",
    liquor: "橙黄透亮",
    aroma: "桂皮香、岩韵",
    taste: "醇厚甘活，回甘明显",
    temp: "100℃",
    amount: "8g",
    time: "30 秒",
    favorites: 168,
    tips: [
      { t: "水温", d: "沸水冲泡，激发岩韵。" },
      { t: "投茶", d: "110ml 盖碗配 8g 茶。" },
      { t: "出汤", d: "首泡 30 秒，逐泡递增。" },
      { t: "存放", d: "密封避光，防潮防异味。" }
    ]
  },
  {
    id: "tieguanyin",
    name: "安溪铁观音",
    category: "乌龙",
    origin: "福建安溪",
    season: "秋茶",
    price: "300-2000 元/斤",
    fermentation: "半发酵",
    shape: "颗粒紧结，色泽砂绿",
    liquor: "金黄明亮",
    aroma: "兰花香",
    taste: "鲜醇甘爽，音韵明显",
    temp: "95℃",
    amount: "7g",
    time: "40 秒",
    favorites: 155,
    tips: [
      { t: "水温", d: "95℃，避免涩感。" },
      { t: "投茶", d: "110ml 盖碗配 7g 茶。" },
      { t: "出汤", d: "首泡 40 秒，可冲 7 泡。" },
      { t: "存放", d: "密封冷藏，防串味。" }
    ]
  },
  {
    id: "dancong",
    name: "凤凰单丛",
    category: "乌龙",
    origin: "广东潮州",
    season: "春茶",
    price: "500-3000 元/斤",
    fermentation: "半发酵",
    shape: "条索挺直，色泽黄褐",
    liquor: "橙黄明亮",
    aroma: "蜜兰香、栀子香",
    taste: "浓醇鲜爽，回甘强",
    temp: "100℃",
    amount: "7g",
    time: "30 秒",
    favorites: 119,
    tips: [
      { t: "水温", d: "沸水高冲，香气更扬。" },
      { t: "投茶", d: "110ml 盖碗配 7g 茶。" },
      { t: "出汤", d: "首泡 30 秒，快出汤。" },
      { t: "存放", d: "密封避光，防潮。" }
    ]
  },
  {
    id: "lapsang",
    name: "正山小种",
    category: "红茶",
    origin: "福建武夷山",
    season: "春茶",
    price: "500-2000 元/斤",
    fermentation: "全发酵",
    shape: "条索肥实，色泽乌润",
    liquor: "红浓明亮",
    aroma: "松烟香、桂圆香",
    taste: "醇厚甜润",
    temp: "90℃",
    amount: "5g",
    time: "3 分钟",
    favorites: 132,
    tips: [
      { t: "水温", d: "90℃ 保留甜感。" },
      { t: "投茶", d: "150ml 水配 5g 茶。" },
      { t: "出汤", d: "首泡 3 分钟，可续 2 次。" },
      { t: "存放", d: "密封防潮，常温避光。" }
    ]
  },
  {
    id: "keemun",
    name: "祁门红茶",
    category: "红茶",
    origin: "安徽祁门",
    season: "春茶",
    price: "400-1500 元/斤",
    fermentation: "全发酵",
    shape: "条索紧细，色泽乌黑",
    liquor: "红艳明亮",
    aroma: "祁门香、花果香",
    taste: "醇厚鲜甜",
    temp: "90℃",
    amount: "4g",
    time: "3 分钟",
    favorites: 107,
    tips: [
      { t: "水温", d: "90℃ 左右。" },
      { t: "投茶", d: "150ml 水配 4g 茶。" },
      { t: "出汤", d: "首泡 3 分钟。" },
      { t: "存放", d: "密封避光，防异味。" }
    ]
  },
  {
    id: "dianhong",
    name: "滇红",
    category: "红茶",
    origin: "云南临沧",
    season: "春茶",
    price: "200-800 元/斤",
    fermentation: "全发酵",
    shape: "条索肥壮，金毫显露",
    liquor: "红浓明亮",
    aroma: "蜜糖香",
    taste: "浓强鲜爽",
    temp: "95℃",
    amount: "5g",
    time: "3 分钟",
    favorites: 95,
    tips: [
      { t: "水温", d: "95℃ 激发蜜香。" },
      { t: "投茶", d: "150ml 水配 5g 茶。" },
      { t: "出汤", d: "首泡 3 分钟。" },
      { t: "存放", d: "密封防潮，避免高温。" }
    ]
  },
  {
    id: "puer",
    name: "普洱熟茶",
    category: "黑茶",
    origin: "云南普洱",
    season: "春茶",
    price: "200-1500 元/饼",
    fermentation: "后发酵",
    shape: "饼形端正，色泽褐红",
    liquor: "红浓明亮",
    aroma: "陈香、枣香",
    taste: "醇厚顺滑",
    temp: "100℃",
    amount: "8g",
    time: "20 秒",
    favorites: 176,
    tips: [
      { t: "水温", d: "沸水冲泡或煮饮。" },
      { t: "投茶", d: "110ml 盖碗配 8g 茶。" },
      { t: "出汤", d: "首泡 20 秒，可冲 10 泡。" },
      { t: "存放", d: "通风干燥，避光防异味。" }
    ]
  },
  {
    id: "qianliang",
    name: "安化千两",
    category: "黑茶",
    origin: "湖南安化",
    season: "陈年",
    price: "300-1200 元/斤",
    fermentation: "后发酵",
    shape: "篾篓紧压，色泽黑褐",
    liquor: "橙红明亮",
    aroma: "松烟香、陈香",
    taste: "醇厚甘爽",
    temp: "100℃",
    amount: "8g",
    time: "30 秒",
    favorites: 58,
    tips: [
      { t: "水温", d: "沸水冲泡，可煮饮。" },
      { t: "投茶", d: "110ml 盖碗配 8g 茶。" },
      { t: "出汤", d: "首泡 30 秒，逐泡递增。" },
      { t: "存放", d: "通风干燥，避免潮湿。" }
    ]
  },
  {
    id: "liubao",
    name: "六堡茶",
    category: "黑茶",
    origin: "广西梧州",
    season: "陈年",
    price: "200-1000 元/斤",
    fermentation: "后发酵",
    shape: "条索紧结，色泽黑褐",
    liquor: "红浓明亮",
    aroma: "槟榔香",
    taste: "醇和爽滑",
    temp: "100℃",
    amount: "8g",
    time: "30 秒",
    favorites: 66,
    tips: [
      { t: "水温", d: "沸水冲泡，陈香更显。" },
      { t: "投茶", d: "110ml 盖碗配 8g 茶。" },
      { t: "出汤", d: "首泡 30 秒，可煮饮。" },
      { t: "存放", d: "通风干燥，越陈越香。" }
    ]
  }
];

// 官方小贴士四块：历史典故、适合人群、冲泡误区、品鉴笔记；空字段在页面隐藏。
const OFFICIAL_TIPS = {
  longjing: {
    history: "清代列入贡茶，乾隆多次题咏，以“色绿、香郁、味甘、形美”著称。",
    suitable: "口味清淡、常饮绿茶的人；胃寒者建议少量淡饮。",
    pitfall: "用沸水直冲会把芽叶烫熟，茶汤发黄发苦。",
    note: "豆香清高，入口鲜爽，回甘快，适合 80℃ 玻璃杯冲泡。"
  },
  biluochun: {
    history: "产于苏州太湖洞庭山，清代已负盛名，卷曲成螺、满披白毫。",
    suitable: "喜欢花果香、口感细腻的人。",
    pitfall: "投茶过多或闷泡过久会掩盖花果香并出涩。",
    note: "花果香馥郁，鲜甜细腻，上投法观赏性最佳。"
  },
  liuan: {
    history: "产于安徽六安，明代即为名茶，去芽去梗、单片形似瓜子。",
    suitable: "偏好醇厚口感、日常办公饮用的人。",
    pitfall: "水温过高会放大苦涩，不宜长时间闷在杯中。",
    note: "板栗香明显，汤色黄绿，耐泡度较好。"
  },
  baihaoyinzhen: {
    history: "福鼎传统名茶，以单芽满披白毫得名，有“茶中美女”之称。",
    suitable: "口味清淡、喜欢毫香与甜感的人。",
    pitfall: "高温久泡会使毫香流失、茶汤变涩。",
    note: "毫香显露，清鲜甘甜，新茶偏清，陈化后更醇。"
  },
  baimudan: {
    history: "创制于福建政和，一芽一二叶，形态舒展似牡丹。",
    suitable: "想入门白茶、兼顾香气与滋味的人。",
    pitfall: "投茶过量会压住花香，出水要干净。",
    note: "花香清雅，汤色橙黄，醇和鲜甜。"
  },
  shoumei: {
    history: "白茶中产量较大的品类，粗老叶带梗，陈放后枣香突出。",
    suitable: "喜欢陈香、煮饮与收藏白茶的人。",
    pitfall: "新茶久闷易出青味，建议先醒茶再冲泡。",
    note: "枣香、陈香明显，醇厚顺滑，可煮饮。"
  },
  junshan: {
    history: "产于湖南岳阳君山，黄茶代表，芽头肥直、金毫显露。",
    suitable: "想尝试黄茶、偏好清淡甜香的人。",
    pitfall: "水温过高会破坏芽头，茶汤易浑浊。",
    note: "杏黄明净，清香带甜，鲜爽甘醇。"
  },
  mengding: {
    history: "四川雅安蒙顶山名茶，自唐代起即为贡茶。",
    suitable: "喜欢甜香、口感鲜醇的人。",
    pitfall: "久泡会出涩，建议即泡即饮。",
    note: "甜香清雅，汤色黄亮，鲜醇回甘。"
  },
  huoshanhuangya: {
    history: "安徽霍山传统黄茶，雨前采摘，芽叶挺直。",
    suitable: "日常口粮茶、偏好栗香的人。",
    pitfall: "密封不严易吸异味，影响栗香。",
    note: "栗香明显，醇和鲜爽，性价比高。"
  },
  rougui: {
    history: "武夷岩茶当家品种之一，以桂皮香与岩韵著称。",
    suitable: "口味偏重、喜欢岩茶焙火香的人。",
    pitfall: "出汤慢会苦涩，需沸水快冲快出。",
    note: "桂皮香辛锐，岩韵足，回甘明显。"
  },
  tieguanyin: {
    history: "原产福建安溪，清代创制，曾风靡闽南与东南亚。",
    suitable: "喜欢兰花香、追求音韵的人。",
    pitfall: "久浸会出涩，忌用保温杯闷泡。",
    note: "兰花香清雅，鲜醇甘爽，七泡有余香。"
  },
  dancong: {
    history: "广东潮州凤凰山单株采制，香型按株系命名。",
    suitable: "喜欢高香、层次变化的人。",
    pitfall: "投茶过多易苦涩，高冲后要快出汤。",
    note: "蜜兰香、栀子香交织，浓醇回甘强。"
  },
  lapsang: {
    history: "福建武夷山桐木关传统红茶，世界红茶鼻祖之一。",
    suitable: "喜欢松烟香、醇厚甜润口感的人。",
    pitfall: "水温过高或久泡会放大烟熏苦味。",
    note: "松烟香与桂圆香并存，汤色红浓，甜润顺滑。"
  },
  keemun: {
    history: "安徽祁门创制于清末，以“祁门香”闻名世界。",
    suitable: "喜欢花果香、清甜口感的人。",
    pitfall: "闷泡会使香气沉闷，建议 90℃ 快速出汤。",
    note: "祁门香优雅，红艳明亮，醇厚鲜甜。"
  },
  dianhong: {
    history: "云南凤庆等地创制，以大叶种为原料，金毫显露。",
    suitable: "喜欢浓强口感、调饮奶茶的人。",
    pitfall: "投茶过多会涩，调饮时注意降低浓度。",
    note: "蜜糖香浓，汤色红浓，浓强鲜爽。"
  },
  puer: {
    history: "云南西双版纳传统后发酵茶，熟茶工艺始于 1970 年代。",
    suitable: "喜欢醇厚陈香、养胃暖饮的人。",
    pitfall: "新熟茶可能有渥堆味，需醒茶；忌用冷水冲泡。",
    note: "陈香、枣香明显，醇厚顺滑，耐泡可煮。"
  },
  qianliang: {
    history: "湖南安化黑茶传统紧压茶，因每支重千两得名。",
    suitable: "喜欢陈香、煮饮与收藏的人。",
    pitfall: "紧压茶需先撬散醒茶，否则滋味释放不均。",
    note: "松烟香与陈香并存，醇厚甘爽。"
  },
  liubao: {
    history: "广西梧州六堡茶，历史上经“茶船古道”外销南洋。",
    suitable: "喜欢槟榔香、陈年黑茶的人。",
    pitfall: "仓储受潮会产生霉味，需通风干燥存放。",
    note: "槟榔香独特，醇和爽滑，越陈越香。"
  }
};

TEAS.forEach(function (tea) {
  tea.official = OFFICIAL_TIPS[tea.id] || {};
  delete tea.tips;
});

// 为每款茶附加图片地址
TEAS.forEach(function (tea) {
  tea.image = teaImage(tea.name, tea.category);
});

function categoryInfo(name) {
  return CATEGORIES.find(function (c) { return c.name === name; }) || CATEGORIES[0];
}

function getTea(id) {
  return TEAS.find(function (t) { return t.id === id; });
}
