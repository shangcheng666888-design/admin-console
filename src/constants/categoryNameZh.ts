/**
 * 分类英文名 -> 中文名映射（用于下拉、列表等展示）
 * 未映射的仍显示英文
 */
export const CATEGORY_NAME_ZH: Record<string, string> = {
  /* 大分类 */
  'Luxury': '奢侈品',
  'virtual goods': '虚拟商品',
  'Sports & Outdoors': '户外运动',
  'Epidemic Prevention Supplies': '防疫物品',
  'Computer Peripherals': '电脑配件',
  'Office Stationery': '办公文具',
  'Digital Products': '数码产品',
  'Home Appliances': '家用电器',
  'Health Beauty & Hair': '美妆护肤',
  'Kids & Babies': '儿童母婴',
  'Men\'s Clothing': '男士服装',
  'Women\'s Clothing': '女士服装',
  'Phones & Accessories': '手机配件',
  'Jewelry & Watches': '珠宝手表',
  'Food & Beverage': '饮品酒水',
  'Snack Dessert': '零食甜点',
  'Kids Toys': '儿童玩具',
  'Recreational Fishing Gear': '休闲鱼具',
  'Men\'s Bag': '男士包',
  'Ladies Bag': '女士包',
  'Holiday decoration': '节日装饰',
  'Gift Card': '礼品卡',
  /* 细分类示例（常见） */
  'Bags': '包袋',
  'Clothing': '服装',
  'Watches': '手表',
  'Art': '艺术',
  'Jewelry': '珠宝',
  'Card&Giftcard': '卡券/礼品卡',
  'Software': '软件',
  'DigitalGame': '数字游戏',
  'Office Accessories': '办公配件',
  'Small Office Appliances': '小型办公电器',
  'Office Binding Supplies': '装订用品',
  'Desk Storage Classification': '桌面收纳',
  'Tapes Adhesives and Fasteners': '胶带粘合剂',
  'Art Supplies': '美术用品',
  'Calendar Goal Card': '日历目标卡',
  'Writing & Correcting Supplies': '书写与修正用品',
  'Stationery Stickers & Labels': '文具贴纸标签',
  'Mail & Shipping Supplies': '邮寄包装用品',
  'Paper & Notebook': '纸品笔记本',
  'Laptop': '笔记本',
  'Printers & Scanners': '打印机扫描仪',
  'Computer Assembly Accessories': '电脑组装配件',
  'Keyboard & Mouse': '键鼠',
  'Networked Device': '网络设备',
  'Tablet': '平板',
  'Desktop': '台式机',
  'Projectors & Accessories': '投影仪及配件',
  'Monitor': '显示器',

  /* 户外运动 / Sports & Outdoors 细分类 */
  'Camping & Hiking': '露营与徒步',
  'Outdoor Shoes': '户外鞋靴',
  'Outdoor Backpacks': '户外背包',
  'Cycling': '骑行装备',
  'Fishing': '钓鱼装备',
  'Fitness Equipment': '健身器材',
  'Tents': '帐篷',
  'Sleeping Bags': '睡袋',
  'Trekking Poles': '登山杖',
  'Winter Sports': '冬季运动',
  'Golf': '高尔夫',
  'Outdoor Generator': '户外发电机',
  'Outdoor Clothing & Shoes': '户外服装与鞋靴',
  'Outdoor Leisure': '户外休闲',
  'Fitness & Bodybuilding': '健身与塑形',
  'Travel Goods': '旅行用品',
  'Flashlight': '手电筒',
  'Water Sports': '水上运动',

  /* 防疫物品 / Epidemic Prevention Supplies 细分类 */
  'Disposable Masks': '一次性口罩',
  'KN95 Masks': 'KN95 口罩',
  'Hand Sanitizer': '洗手液',
  'Disinfectant': '消毒液',
  'Alcohol Wipes': '酒精湿巾',
  'Thermometer': '体温计',
  'Protective Clothing': '防护服',
  'Goggles': '护目镜',
  'Gloves': '一次性手套',
  'Face Shield': '防护面罩',

  /* 数码产品 / Digital Products 细分类 */
  'Mobile Phones': '手机',
  'Smartphones': '智能手机',
  'Phone Accessories': '手机配件',
  'Tablets': '平板',
  'Cameras': '相机',
  'Headphones': '耳机',
  'Earphones': '耳机',
  'Bluetooth Headphones': '蓝牙耳机',
  'Speakers': '音箱',
  'Speaker': '音箱',
  'Game Consoles': '游戏机',
  'Drones': '无人机',
  'Smart Watches': '智能手表',
  'E-book Readers': '电子书阅读器',
  'Microphone': '麦克风',
  'Camera': '相机',
  'Camera Accessories': '相机配件',
  'Camera配件': '相机配件',
  'Smart Watches & Accessories': '智能手表及配件',
  'Smart手表配件': '智能手表配件',
  'Smart Tracker': '智能防丢器',
  'SmartTracker': '智能防丢器',
  'Home Theater System': '家庭影院系统',
  'HomeTheaterSystem': '家庭影院系统',
  'TV Box': '电视盒子',
  'TVBox': '电视盒子',
  'TVs & Accessories': '电视及配件',
  'TVs配件': '电视配件',
  'Video Game Equipment': '游戏设备',
  'VideoGameEquipment': '游戏设备',
  'Other Smart Devices': '其他智能设备',
  'OtherSmartDevices': '其他智能设备',

  /* 家用电器 / Home Appliances 细分类 */
  'Refrigerators': '冰箱',
  'Washing Machines': '洗衣机',
  'Air Conditioners': '空调',
  'Vacuum Cleaners': '吸尘器',
  'Rice Cookers': '电饭煲',
  'Microwave Ovens': '微波炉',
  'Electric Kettles': '电热水壶',
  'Air Fryers': '空气炸锅',
  'Dishwashers': '洗碗机',

  /* 美妆护肤 / Health Beauty & Hair 细分类 */
  'Skincare': '护肤品',
  'Makeup': '化妆品',
  'Face Masks': '面膜',
  'Lipsticks': '口红',
  'Foundation': '粉底',
  'Eyeshadow': '眼影',
  'Mascara': '睫毛膏',
  'Blush': '腮红',
  'Cleansers': '洁面',
  'Serums': '精华',
  'Creams': '面霜',
  'Sunscreen': '防晒',
  'Shampoo': '洗发水',
  'Conditioner': '护发素',
  'Hair Care': '头发护理',

  /* 儿童母婴 / Kids & Babies 细分类 */
  'Baby Clothing': '婴儿服装',
  'Baby Shoes': '婴儿鞋',
  'Baby Care': '婴儿护理',
  'Diapers': '纸尿裤',
  'Baby Strollers': '婴儿推车',
  'Baby Car Seats': '安全座椅',
  'Baby Toys': '婴儿玩具',
  'Feeding Supplies': '喂养用品',
  // 数据库中出现的混合中英写法兜底
  'Baby & Mother': '母婴用品',
  'Baby cart': '婴儿推车',
  'Baby Clothes': '婴儿服装',
  'Baby hats': '婴儿帽子',
  'Milk powder': '奶粉',
  'Saliva napkins, food clothes': '口水巾/饭衣',
  '婴儿Clothes': '婴儿服装',
  '婴儿Mother': '母婴用品',
  '婴儿hats': '婴儿帽子',
  '婴儿cart': '婴儿推车',
  'Milkpowder': '奶粉',
  'Bellybandage': '收腹带',
  'Salivanapkinsfoodclothes': '口水巾/饭衣',
  'Gloves and feet': '一次性手套脚套',
  '一次性手套andfeet': '一次性手套脚套',

  /* 男士服装 / Men\'s Clothing 细分类 */
  'Men T-Shirts': '男士 T 恤',
  'Men Shirts': '男士衬衫',
  'Men Jackets': '男士夹克',
  'Men Coats': '男士外套',
  'Men Suits': '男士西装',
  'Men Pants': '男士长裤',
  'Men Shorts': '男士短裤',
  'Men Shoes': '男士鞋子',
  'Men Underwear': '男士内衣',
  'Men Socks': '男士袜子',
  'Men Belts': '男士皮带',

  /* 女士服装 / Women\'s Clothing 细分类 */
  'Women Dresses': '连衣裙',
  'Women Skirts': '裙子',
  'Women Tops': '女士上衣',
  'Women Shirts': '女士衬衫',
  'Women Pants': '女士长裤',
  'Women Shorts': '女士短裤',
  'Women Coats': '女士外套',
  'Women Jackets': '女士夹克',
  'Women Suits': '女士西装',
  'Women Shoes': '女士鞋子',
  'Women Underwear': '女士内衣',
  'Women Socks': '女士袜子',
  'Women Belts': '女士腰带',

  /* 手机配件 / Phones & Accessories 细分类 */
  'Phone Cases': '手机壳',
  'Screen Protectors': '手机膜',
  'Chargers': '充电器',
  'Data Cables': '数据线',
  'USB Cables': '数据线',
  'Power Banks': '移动电源',
  'Car Mounts': '车载支架',
  'Phone Holders': '手机支架',
  'Phone Lenses': '手机镜头',

  /* 珠宝手表 / Jewelry & Watches 细分类 */
  'Necklaces': '项链',
  'Bracelets': '手链',
  'Rings': '戒指',
  'Earrings': '耳环',
  'Brooches': '胸针',
  'Hair Accessories': '发饰',
  'Smart Bands': '智能手环',
  'Jewelry Boxes': '珠宝盒',
  'LadiesWatch': '女士手表',
  "Men'sWatch": '男士手表',
  'Jewelry Set': '珠宝套装',
  'LadiesBracelet': '女士手链',
  'Necklaces & Pendants': '项链与吊坠',
  'Tiaras & Brooches': '头饰与胸针',
  'Keychains & Trinkets': '钥匙扣与小饰品',
  'KeychainsTrinkets': '钥匙扣与小饰品',
  '珠宝Set': '珠宝套装',
  '项链Pendants': '项链与吊坠',
  'Tiaras胸针': '头饰与胸针',

  /* 饮品酒水 / Food & Beverage 细分类 */
  'Water': '矿泉水',
  'Juice': '果汁',
  'Soft Drinks': '碳酸饮料',
  'Tea': '茶类',
  'Beer': '啤酒',
  'Wine': '葡萄酒',
  'Spirits': '白酒',

  /* 零食甜点 / Snack Dessert 细分类 */
  'Snacks': '零食',
  'Biscuits': '饼干',
  'Chips': '薯片',
  'Chocolate': '巧克力',
  'Candy': '糖果',
  'Nuts': '坚果',
  'Cakes': '蛋糕',
  'Desserts': '甜点',

  /* 儿童玩具 / Kids Toys 细分类 */
  'Building Blocks': '积木',
  'Dolls': '玩偶',
  'Educational Toys': '益智玩具',
  'RC Cars': '遥控车',
  'Puzzles': '拼图',
  'Plush Toys': '毛绒玩具',
  'Scooters': '滑板车',
  'Beach Toys': '沙滩玩具',

  /* 休闲鱼具 / Recreational Fishing Gear 细分类 */
  'Fishing Rods': '鱼竿',
  'Fishing Lines': '鱼线',
  'Fishing Hooks': '鱼钩',
  'Fishing Bait': '鱼饵',
  'Floats': '鱼漂',
  'Keep Nets': '鱼护',
  'Tackle Boxes': '钓箱',
  'Landing Nets': '抄网',
  'Fishing Chairs': '钓椅',
  'Fishing Clothing': '钓鱼服',

  /* 男士包 / Men\'s Bag 细分类 */
  'Men Backpacks': '男士双肩包',
  'Men Shoulder Bags': '男士单肩包',
  'Men Crossbody Bags': '男士斜挎包',
  'Men Waist Bags': '男士腰包',

  /* 女士包 / Ladies Bag 细分类 */
  'Women Handbags': '女士手提包',
  'Women Shoulder Bags': '女士单肩包',
  'Women Crossbody Bags': '女士斜挎包',
  'Women Backpacks': '女士双肩包',

  /* 节日装饰 / Holiday decoration 细分类 */
  'Christmas Decorations': '圣诞装饰',
  'Halloween Decorations': '万圣节装饰',
  'Party Supplies': '派对用品',
  'New Year Decorations': '新年装饰',
}

// 常见英文词根 -> 中文，用于兜底自动翻译分类名
const CATEGORY_TOKEN_ZH: Record<string, string> = {
  Outdoor: '户外',
  Sports: '运动',
  Winter: '冬季',
  Water: '水上',
  Travel: '旅行',
  Goods: '用品',
  Clothing: '服装',
  Shoes: '鞋靴',
  Leisure: '休闲',
  Fitness: '健身',
  Bodybuilding: '塑形',
  Generator: '发电机',
  Kids: '儿童',
  Baby: '婴儿',
  Men: '男士',
  Women: '女士',
  Bag: '包',
  Bags: '包',
  Accessories: '配件',
  Flashlight: '手电筒',
  Masks: '口罩',
}

export function getCategoryNameZh(nameEn: string | null | undefined): string {
  if (nameEn == null || nameEn === '') return ''
  const trimmed = String(nameEn).trim()
  // 1) 直接映射
  const direct = CATEGORY_NAME_ZH[trimmed]
  if (direct) return direct
  // 2) 已经是中文，直接返回
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed
  // 3) 尝试按空格、&、/ 等拆分词根做简单组合翻译
  const parts = trimmed.split(/[\s/&,+-]+/).filter(Boolean)
  if (parts.length === 0) return trimmed
  const zhParts = parts.map((p) => {
    const token = p.trim()
    if (!token) return ''
    // 优先用全量映射，其次用词根映射
    return CATEGORY_NAME_ZH[token] || CATEGORY_TOKEN_ZH[token] || token
  }).filter(Boolean)
  const joined = zhParts.join('')
  return joined || trimmed
}
