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

// Professional Meteorologik Ob-Havo Turlari va Tabiiy Ketma-ketlik (State Machine)
export const WEATHER_PRESETS = {
  sunny: {
    id: 'sunny',
    name: "Quyoshli va Ochiq Havo",
    icon: '☀️',
    color: '#ffb300',
    tempMod: 0,
    et0Mod: 1.0,
    windSpeed: 3,
    rainRate: 0,
    cloudCover: 0.1,
    skyColor: '#101826',
    fogColor: '#101826',
    sunIntensity: 1.4,
    description: "Iliq va ochiq havo. Evapotranspiratsiya me'yorida.",
    nextTransitions: [
      { id: 'cloudy', weight: 60 },
      { id: 'humid_sun', weight: 25 },
      { id: 'windy', weight: 15 }
    ]
  },
  cloudy: {
    id: 'cloudy',
    name: "Bulutli & Salqin Havo",
    icon: '☁️',
    color: '#90a4ae',
    tempMod: -4,
    et0Mod: 0.6,
    windSpeed: 5,
    rainRate: 0,
    cloudCover: 0.85,
    skyColor: '#1e293b',
    fogColor: '#1e293b',
    sunIntensity: 0.85,
    description: "Qalin bulutlar to'planmoqda, havo salqinladi. Yomg'ir ehtimoli ortmoqda.",
    nextTransitions: [
      { id: 'rain', weight: 50 },
      { id: 'storm_flood', weight: 20 },
      { id: 'humid_sun', weight: 20 },
      { id: 'sunny', weight: 10 }
    ]
  },
  rain: {
    id: 'rain',
    name: "Mayin Yomg'ir",
    icon: '🌧️',
    color: '#4fc3f7',
    tempMod: -6,
    et0Mod: 0.35,
    windSpeed: 7,
    rainRate: 14,
    cloudCover: 1.0,
    skyColor: '#0f172a',
    fogColor: '#0f172a',
    sunIntensity: 0.6,
    moistureGainRate: 2.8,
    description: "Foydali yomg'ir yog'moqda! Barcha dalalar tabiiy namlik bilan to'yinmoqda.",
    nextTransitions: [
      { id: 'fresh_cloudy', weight: 55 },
      { id: 'storm_flood', weight: 25 },
      { id: 'humid_sun', weight: 20 }
    ]
  },
  storm_flood: {
    id: 'storm_flood',
    name: "Kuchli Sel & Jala",
    icon: '⛈️',
    color: '#7c4dff',
    tempMod: -9,
    et0Mod: 0.15,
    windSpeed: 22,
    rainRate: 45,
    cloudCover: 1.0,
    skyColor: '#0a0e17',
    fogColor: '#0a0e17',
    sunIntensity: 0.35,
    moistureGainRate: 7.5,
    riverSurgeRate: 85,
    description: "XAVFLI METEO: Kuchli sel va jala! Daryo toshishi mumkin, rezervuarlar suv bilan to'lmoqda.",
    nextTransitions: [
      { id: 'rain', weight: 60 },
      { id: 'fresh_cloudy', weight: 40 }
    ]
  },
  fresh_cloudy: {
    id: 'fresh_cloudy',
    name: "Yomg'irdan So'ng Salqin",
    icon: '🌤️',
    color: '#81d4fa',
    tempMod: -3,
    et0Mod: 0.7,
    windSpeed: 4,
    rainRate: 0,
    cloudCover: 0.55,
    skyColor: '#1a2332',
    fogColor: '#1a2332',
    sunIntensity: 1.0,
    moistureGainRate: 0,
    description: "Yomg'irdan keyingi salqin va toza shabada. Tuproq nami asta-sekin bug'lanmoqda.",
    nextTransitions: [
      { id: 'humid_sun', weight: 65 },
      { id: 'sunny', weight: 20 },
      { id: 'cloudy', weight: 15 }
    ]
  },
  humid_sun: {
    id: 'humid_sun',
    name: "Bulutli Dim Havo",
    icon: '⛅',
    color: '#ffe082',
    tempMod: +2,
    et0Mod: 0.85,
    windSpeed: 2,
    rainRate: 0,
    cloudCover: 0.5,
    skyColor: '#212d40',
    fogColor: '#212d40',
    sunIntensity: 1.25,
    moistureGainRate: 0,
    description: "Qalin bulutlar orasidan quyosh chiqdi. Tuproqdagi namlik bug'lanib, havo dimlashmoqda.",
    nextTransitions: [
      { id: 'cloudy', weight: 45 },
      { id: 'sunny', weight: 45 },
      { id: 'rain', weight: 10 }
    ]
  },
  windy: {
    id: 'windy',
    name: "Quruq Garmsel Shamoli",
    icon: '💨',
    color: '#ffb74d',
    tempMod: +6,
    et0Mod: 1.9,
    windSpeed: 19,
    rainRate: 0,
    cloudCover: 0.2,
    skyColor: '#261b14',
    fogColor: '#261b14',
    sunIntensity: 1.3,
    moistureGainRate: 0,
    description: "Quruq va issiq garmsel shamoli esmoqda. Tuproq namligi tez bug'lanmoqda!",
    nextTransitions: [
      { id: 'sunny', weight: 50 },
      { id: 'cloudy', weight: 50 }
    ]
  }
};

// Sug'orish Texnologiyalari (4 ta Bosqich)
export const IRRIGATION_TECH = {
  furrow: {
    id: 'furrow',
    tier: 1,
    name: "Egatlab / Bostirib sug'orish",
    shortName: 'Egatlab',
    cost: 0,             // 100% BEPUL boshlang'ich sug'orish
    waterPerHour: 15,    // m3/h sarfi
    efficiency: 0.45,    // 45% samaradorlik
    evaporationLoss: 0.38, // 38% havoga bug'lanish
    percolationLoss: 0.17,// 17% chuqur qatlamga sizilish
    salinityIncrease: 0.08, // Sho'rlanishni tezlashtiradi
    icon: '🌊',
    color: '#8b6f47',
    description: "An'anaviy qadimiy usul (BEPUL). Xarajatsiz, biroq suvning 55% havoga bug'lanadi. Yangi texnologiyalar bilan almashtiring.",
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
    unlockedByDefault: true,
    icon: '🏞️',
    description: "Daryo yoki kanal ustiga/qirg'og'iga o'rnatiladi. Yer usti daryo suvini tortadi."
  },
  well: {
    id: 'well',
    name: "Yer Osti Quduq (Qazish)",
    cost: 160,
    waterSupplyPerHour: 40,
    energyUsage: 0,
    type: 'source',
    sourceType: 'aquifer',
    unlockedByDefault: true,
    icon: '🕳️',
    description: "Cho'lning istalgan joyida yer osti akviferiga quduq qazish. Boshlang'ich arzon suv manbai."
  },
  windmill_pump: {
    id: 'windmill_pump',
    name: "Shamol Quduq Nasosi (Eko)",
    cost: 260,
    waterSupplyPerHour: 75,
    energyUsage: 0,
    type: 'source',
    sourceType: 'aquifer',
    unlockedByDefault: true,
    icon: '💨',
    description: "Shamol generatori bilan ishlovchi avtomatik nasos. 0 elektr sarfi! Shamol kuchi bilan yer osti suvini chiqaradi."
  },
  deep_well: {
    id: 'deep_well',
    name: "Elektr VFD Chuqur Nasos",
    cost: 480,
    waterSupplyPerHour: 150,
    energyUsage: 2.5,
    type: 'source',
    sourceType: 'aquifer',
    unlockedByDefault: true,
    icon: '⚡',
    description: "Kuchli elektr nasos stansiyasi. Katta maydonlarni yuqori bosimli yer osti suvi bilan ta'minlaydi."
  },
  pipe: {
    id: 'pipe',
    name: "Gidravlik Quvur Tarmog'i",
    cost: 15,
    capacity: 100,
    type: 'pipe',
    unlockedByDefault: true,
    icon: '🚰',
    description: "Suvni nasoslardan sug'orish klasterlariga taqsimlaydi."
  },
  iot_tower: {
    id: 'iot_tower',
    name: "SCADA & Ob-havo Stansiyasi",
    cost: 400,
    energyUsage: 1.0,
    radius: 4,
    type: 'iot',
    unlockedByDefault: false,
    icon: '📡',
    description: "Atrofdagi tuproq datchiklari ma'lumotlarini to'playdi va AI dozalashni faollashtiradi."
  },
  solar_array: {
    id: 'solar_array',
    name: "Quyosh Fotoelektr Stansiyasi",
    cost: 500,
    energyGen: 8.0,
    type: 'energy',
    unlockedByDefault: false,
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
    cost: 200,
    ecoRequirement: 0, // Boshlanishidayoq ochish mumkin!
    prerequisites: [],
    unlocks: ['sprinkler'],
    description: "Purkagichli apparatlar orqali sug'orishga o'tish (suv isrofi 30% kamayadi)."
  },
  {
    id: 'tech_surface_drip',
    tier: 2,
    name: "Er Usti Tomchilatish",
    cost: 350,
    ecoRequirement: 5,
    prerequisites: ['tech_sprinkler'],
    unlocks: ['drip_surface'],
    description: "Tomchilatish shlanglari va filtrlar orqali ekin qatoriga suv berish."
  },
  {
    id: 'tech_sdi',
    tier: 3,
    name: "Yer Osti Tomchilatish (SDI)",
    cost: 600,
    ecoRequirement: 15,
    prerequisites: ['tech_surface_drip'],
    unlocks: ['sdi'],
    description: "Kapillyar namlantirish texnologiyasi: bug'lanish deyarli nolga tushadi, 70% tejamkorlik."
  },
  {
    id: 'tech_iot_sensors',
    tier: 3,
    name: "IoT Tuproq Sensorlari",
    cost: 500,
    ecoRequirement: 15,
    prerequisites: ['tech_surface_drip'],
    unlocks: ['iot_tower'],
    description: "VWC% va sho'rlanish datchiklari bilan qurollangan SCADA minoralari."
  },
  {
    id: 'tech_solar_power',
    tier: 3,
    name: "Agro-Voltaik Quyosh Panellari",
    cost: 450,
    ecoRequirement: 10,
    prerequisites: [],
    unlocks: ['solar_array'],
    description: "Nasoslarni toza qayta tiklanuvchi energiya bilan quvvatlantirish."
  },
  {
    id: 'tech_ai_scada',
    tier: 4,
    name: "AI & Fuzzy-PID Avtomatik Dozalash",
    cost: 950,
    ecoRequirement: 30,
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
  },
  drainage_overflow: {
    id: 'drainage_overflow',
    name: "Drenaj To'lishi & Botqoqlanish",
    duration: 30,
    description: "Kuchli yog'ingarchilik sababli egatlarda suv to'planib qoldi. Tomchilatish yoki SDI tizimi hosilni asraydi!",
    icon: '🌊',
    color: '#00e5ff'
  }
};
