// Oasis Protocol - Asosiy O'yin Balansi va Konfiguratsiyasi

export const GRID_SIZE = 16; // 16x16 maydon (256 katak)
export const TILE_SIZE = 2.0; // 3D olamdagi o'lchami

export const INITIAL_RESOURCES = {
  budget: 2500,          // Boshlang'ich mablag' ($)
  surfaceWater: 6000,    // Daryo/kanal suv zaxirasi (m³)
  aquiferWater: 15000,   // Yer osti suvlari zaxirasi (m³)
  aquiferCapacity: 20000,// Akvifer maksimal sig'imi (m³)
  energy: 100,           // Energiya ishlab chiqarish quvvati (kW)
  energyUsage: 0,        // Hozirgi sarf (kW)
  ecoScore: 15,          // Boshlang'ich Eko-Ball (Oasis Index) 0..100
  day: 1,
  season: 'Bahor',       // Bahor, Yoz, Kuz, Qish
  timeOfDay: 8.0,        // 0..24 soat
  temperature: 28,       // Gradus C
  et0: 4.5,              // Boshlang'ich bug'lanish indeksi (mm/kun)
  salinityRisk: 0,
  waterSavedTotal: 0,
  harvestCountTotal: 0
};

// Sug'orish Texnologiyalari (4 ta Bosqich)
export const IRRIGATION_TECH = {
  furrow: {
    id: 'furrow',
    tier: 1,
    name: "Egatlab / Bostirib sug'orish",
    shortName: 'Egatlab',
    cost: 40,
    waterPerHour: 15,    // m3/h sarfi
    efficiency: 0.45,    // 45% samaradorlik
    evaporationLoss: 0.38, // 38% havoga bug'lanish
    percolationLoss: 0.17,// 17% chuqur qatlamga sizilish
    salinityIncrease: 0.08, // Sho'rlanishni tezlashtiradi
    icon: '🌊',
    color: '#8b6f47',
    description: "An'anaviy qadimiy usul. Xarajati arzon, biroq suvning 55% dan ko'prog'i havoga bug'lanib va sizilib isrof bo'ladi. Tuproqni tez sho'rlantiradi.",
    unlockedByDefault: true
  },
  sprinkler: {
    id: 'sprinkler',
    tier: 2,
    name: "Yomg'irlatib sug'orish",
    shortName: "Yomg'irlatgich",
    cost: 160,
    energyUsage: 1.2,    // kW
    waterPerHour: 9,
    efficiency: 0.70,
    evaporationLoss: 0.22,
    percolationLoss: 0.08,
    salinityIncrease: 0.02,
    icon: '🌧️',
    color: '#4fc3f7',
    description: "Mexanizatsiyalashgan purkagich. 30-45% suvni tejaydi. Shamolda suv sochiladi va issiq havoda qisman bug'lanadi.",
    unlockedByDefault: false
  },
  drip_surface: {
    id: 'drip_surface',
    tier: 2,
    name: "Er usti tomchilatib sug'orish",
    shortName: "Tomchilatkich",
    cost: 220,
    energyUsage: 0.8,
    waterPerHour: 6,
    efficiency: 0.80,
    evaporationLoss: 0.15,
    percolationLoss: 0.05,
    salinityIncrease: 0.01,
    icon: '💧',
    color: '#00b0ff',
    description: "Shlanglar orqali ildiz atrofiga suv tomiziladi. Yuqori haroratda shlanglar qiziydi va quyoshda eskirishi mumkin.",
    unlockedByDefault: false
  },
  sdi: {
    id: 'sdi',
    tier: 3,
    name: "Er ostidan tomchilatish (SDI)",
    shortName: "SDI (Er osti)",
    cost: 450,
    energyUsage: 1.5,
    waterPerHour: 4.2,
    efficiency: 0.93,
    evaporationLoss: 0.02, // Deyarli 0 bug'lanish
    percolationLoss: 0.05,
    salinityIncrease: 0.00,
    icon: '🌱',
    color: '#00e676',
    description: "Subsurface Drip Irrigation — suv 30-40 sm chuqurlikdagi ildiz zonasiga yuboriladi. Bug'lanish nolga teng, suv 60-75% tejaladi.",
    unlockedByDefault: false
  },
  scada_ai: {
    id: 'scada_ai',
    tier: 4,
    name: "Smart SCADA + AI (IoT Node)",
    shortName: "Smart SCADA + AI",
    cost: 950,
    energyUsage: 2.2,
    waterPerHour: 3.0,
    efficiency: 0.98,
    evaporationLoss: 0.01,
    percolationLoss: 0.01,
    salinityIncrease: -0.01, // Tuproqni tozalashga yordam beradi
    icon: '🤖',
    color: '#d500f9',
    description: "IoT datchiklar, ob-havo prognozi (ET₀) va Fuzzy-PID chastotali nasos (VFD) integratsiyasi. Suvni ekin ehtiyojiga qarab grammigacha avtomatik dozalaydi.",
    unlockedByDefault: false
  }
};

// Ekin Turlari
export const CROP_TYPES = {
  cotton: {
    id: 'cotton',
    name: "Paxta (G'o'za)",
    category: 'Sanoat ekini',
    seedCost: 60,
    waterNeed: 7.5,        // Har bir sikldagi suv talabi (VWC %/s)
    optimalMoistureMin: 50,// % VWC
    optimalMoistureMax: 75,
    growDays: 6,           // Pishish davri (kun)
    revenue: 320,          // Hosil daromadi ($)
    ecoValue: 4,           // Eko-ball hissasi
    salinityTolerance: 0.45,// 45% dan oshsa nobud bo'ladi
    icon: '☁️',
    color: '#ffffff'
  },
  wheat: {
    id: 'wheat',
    name: "Bug'doy",
    category: 'Don ekini',
    seedCost: 40,
    waterNeed: 4.8,
    optimalMoistureMin: 45,
    optimalMoistureMax: 70,
    growDays: 4,
    revenue: 190,
    ecoValue: 6,
    salinityTolerance: 0.35,
    icon: '🌾',
    color: '#fbc02d'
  },
  corn: {
    id: 'corn',
    name: "Makkajo'xori",
    category: 'Don va ozuqa',
    seedCost: 50,
    waterNeed: 6.0,
    optimalMoistureMin: 50,
    optimalMoistureMax: 80,
    growDays: 5,
    revenue: 250,
    ecoValue: 7,
    salinityTolerance: 0.30,
    icon: '🌽',
    color: '#ffea00'
  },
  orchard: {
    id: 'orchard',
    name: "Intensiv Mevali Bog'",
    category: 'Bogdorchilik',
    seedCost: 180,
    waterNeed: 4.2,
    optimalMoistureMin: 55,
    optimalMoistureMax: 75,
    growDays: 8,
    revenue: 650,
    ecoValue: 20,          // Yuqori bioxilma-xillik
    salinityTolerance: 0.25,// Nozik ekin
    icon: '🍎',
    color: '#ff5252'
  },
  oasis_tree: {
    id: 'oasis_tree',
    name: "Saksovul & Xurmo (Agroo'rmon)",
    category: 'Ekologik himoya',
    seedCost: 90,
    waterNeed: 2.0,
    optimalMoistureMin: 25,
    optimalMoistureMax: 60,
    growDays: 7,
    revenue: 80,
    ecoValue: 35,          // Cho'lni to'xtatuvchi asosiy daraxt
    salinityTolerance: 0.85,// Sho'rga juda chidamli
    icon: '🌴',
    color: '#2e7d32'
  }
};

// Infratuzilma Inshootlari
export const BUILDINGS = {
  canal_intake: {
    id: 'canal_intake',
    name: "Kanal Suv Qabul Qiluvchi",
    cost: 300,
    waterSupplyPerHour: 80,
    energyUsage: 1.5,
    type: 'source',
    sourceType: 'surface',
    icon: '🏞️',
    description: "Er usti kanali yoki daryodan arzon suv tortib beradi."
  },
  deep_well: {
    id: 'deep_well',
    name: "Arteziyan Quduq (VFD Nasos)",
    cost: 650,
    waterSupplyPerHour: 120,
    energyUsage: 4.0,
    type: 'source',
    sourceType: 'aquifer',
    icon: '🏗️',
    description: "Yer osti akviferidan chuqur nasos yordamida suv chiqaradi. Ortiqcha ishlatilsa akvifer sathi tushadi."
  },
  pipe: {
    id: 'pipe',
    name: "Gidravlik Quvur Tarmog'i",
    cost: 15,
    capacity: 100,
    type: 'pipe',
    icon: '🚰',
    description: "Suvni nasoslardan sug'orish klasterlariga taqsimlaydi."
  },
  iot_tower: {
    id: 'iot_tower',
    name: "SCADA & Ob-havo Stansiyasi",
    cost: 400,
    energyUsage: 1.0,
    radius: 4, // 4 katak radiusdagi barcha sensorlarni qamrab oladi
    type: 'iot',
    icon: '📡',
    description: "Atrofdagi tuproq datchiklari ma'lumotlarini to'playdi va AI dozalashni faollashtiradi."
  },
  solar_array: {
    id: 'solar_array',
    name: "Quyosh Fotoelektr Stansiyasi",
    cost: 500,
    energyGen: 8.0, // +8 kW toza energiya
    type: 'energy',
    icon: '☀️',
    description: "Nasoslar va SCADA tizimini bepul quyosh energiyasi bilan ta'minlaydi."
  }
};

// Texnologiyalar Daraxti (Tech Tree)
export const TECH_NODES = [
  {
    id: 'tech_sprinkler',
    tier: 2,
    name: "Yomg'irlatish Tizimi",
    cost: 350,
    ecoRequirement: 20,
    prerequisites: [],
    unlocks: ['sprinkler'],
    description: "Purkagichli apparatlar orqali sug'orishga o'tish (suv isrofi 30% kamayadi)."
  },
  {
    id: 'tech_surface_drip',
    tier: 2,
    name: "Er Usti Tomchilatish",
    cost: 500,
    ecoRequirement: 30,
    prerequisites: ['tech_sprinkler'],
    unlocks: ['drip_surface'],
    description: "Tomchilatish shlanglari va filtrlar orqali ekin qatoriga suv berish."
  },
  {
    id: 'tech_sdi',
    tier: 3,
    name: "Yer Osti Tomchilatish (SDI)",
    cost: 900,
    ecoRequirement: 45,
    prerequisites: ['tech_surface_drip'],
    unlocks: ['sdi'],
    description: "Kapillyar namlantirish texnologiyasi: bug'lanish deyarli nolga tushadi, 70% tejamkorlik."
  },
  {
    id: 'tech_iot_sensors',
    tier: 3,
    name: "IoT Tuproq Sensorlari",
    cost: 750,
    ecoRequirement: 50,
    prerequisites: ['tech_surface_drip'],
    unlocks: ['iot_tower'],
    description: "VWC% va sho'rlanish datchiklari bilan qurollangan SCADA minoralari."
  },
  {
    id: 'tech_solar_power',
    tier: 3,
    name: "Agro-Voltaik Quyosh Panellari",
    cost: 650,
    ecoRequirement: 40,
    prerequisites: [],
    unlocks: ['solar_array'],
    description: "Nasoslarni toza qayta tiklanuvchi energiya bilan quvvatlantirish."
  },
  {
    id: 'tech_ai_scada',
    tier: 4,
    name: "AI & Fuzzy-PID Avtomatik Dozalash",
    cost: 1600,
    ecoRequirement: 70,
    prerequisites: ['tech_sdi', 'tech_iot_sensors'],
    unlocks: ['scada_ai'],
    description: "Inson aralashuvisiz real vaqtda evapotranspiratsiyani (ET₀) hisoblab suvni taqsimlovchi sun'iy intellekt."
  }
];

// Dinamik Inqirozlar (Crisis Events)
export const CRISIS_TYPES = {
  heatwave: {
    id: 'heatwave',
    name: "Qattiq Issiqlik To'lqini (Heatwave)",
    duration: 35, // soniya
    temperatureMod: +14,
    et0Mod: 2.2, // Bug'lanish 220% ga oshadi
    description: "Harorat keskin ko'tarildi (+42°C)! An'anaviy egatli ekinlarda suv tez bug'lanmoqda. Tomchilatkich va SDI tizimlari zarur!",
    icon: '🔥',
    color: '#ff3d00'
  },
  drought: {
    id: 'drought',
    name: "Kanalda Suv Kamayishi (Qurg'oqchilik)",
    duration: 40,
    surfaceReduction: 0.70, // Kanal suvi 70% kamayadi
    description: "Daryoning yuqori qismida suv kamayishi sababli kanal kvotasi keskin cheklandi! Akviferdan me'yorida foydalaning.",
    icon: '☀️',
    color: '#ff9100'
  },
  pipe_burst: {
    id: 'pipe_burst',
    name: "Magistral Truba Yorilishi!",
    duration: 25,
    waterWastePerSec: 25,
    description: "Yuqori bosim tufayli quvur yorildi! Suv favvora bo'lib oqmoqda. Klapanni yoping yoki ta'mirlang!",
    icon: '⚠️',
    color: '#d50000'
  },
  salinity_bloom: {
    id: 'salinity_bloom',
    name: "Tuproq Sho'rlanishi Xavfi",
    duration: 30,
    salinityRate: 0.05,
    description: "Egatlab sug'orilgan hududlarda yer osti sho'r suvi ko'tarildi. Hosil nobud bo'lmasligi uchun drenaj va tejamkor usul kerak!",
    icon: '🧂',
    color: '#e0e0e0'
  }
};
