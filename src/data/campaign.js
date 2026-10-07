// Campaign definitions for the three Great Houses (9 levels each).
// Structure, objectives, tech progression, army sizes and reinforcement timings follow the
// Dune II campaign (see docs/research/01_campaign_story.md). Maps and layouts are generated
// procedurally by src/game/missionGen.js; briefing texts are original.
import { H } from '../core/constants.js';

export const MENTATS = {
  [H.ATREIDES]: { name: 'Cyril', role: 'Mentat of House Atreides' },
  [H.HARKONNEN]: { name: 'Radnor', role: 'Mentat of House Harkonnen' },
  [H.ORDOS]: { name: 'Ammon', role: 'Mentat of the Ordos Cartel' },
  [H.FREMEN]: { name: 'Stilgar', role: 'Naib of the sietch' },
  [H.SARDAUKAR]: { name: 'Bashar', role: 'Sardaukar Commander' },
  [H.MERCENARY]: { name: 'Captain', role: 'Mercenary Commander' },
};

export const HOUSE_LORE = {
  [H.ATREIDES]: {
    motto: '“Honour is our shield”',
    home: 'Caladan, a warm world of seas and forests',
    text: 'A noble House, loyal to its allies and to the laws of the Landsraad. A balanced army, air power and Ixian Sonic Tanks. The Fremen of the deep desert stand ready to help.',
    perks: ['Sonic Tank', 'Fremen warriors from the Palace', 'Trikes and Ornithopters', 'No WOR Heavy Troopers'],
  },
  [H.HARKONNEN]: {
    motto: '“Strength and fear”',
    home: 'Giedi Prime, a grim industrial world',
    text: 'A brutal House that rules through fear. Heavy armour and devastating firepower: the nuclear-powered Devastator and the Death Hand missile.',
    perks: ['Devastator', 'Death Hand missile from the Palace', 'Heavy Troopers from the first missions', 'No Trikes, Light Infantry or Ornithopters'],
  },
  [H.ORDOS]: {
    motto: '“Profit above all”',
    home: 'Sigma Draconis IV, an icy world of merchants',
    text: 'A secretive cartel of merchants and smugglers. Speed, cunning, forbidden Ixian technology and the capture of enemy structures.',
    perks: ['Deviator: turns enemy units', 'Saboteur from the Palace', 'Fast Raider Trikes', 'No Missile Tank; Siege Tank comes late'],
  },
};

// 27 map regions: piece top-left on the 320x200 region map (Dune II layout)
export const REGION_POS = {
  1: [0, 0], 2: [55, 0], 3: [97, 0], 4: [145, 0], 5: [211, 0], 6: [247, 0], 7: [0, 9], 8: [71, 38], 9: [133, 31],
  10: [173, 16], 11: [220, 22], 12: [264, 16], 13: [0, 41], 14: [21, 46], 15: [87, 70], 16: [148, 45], 17: [186, 45],
  18: [243, 47], 19: [280, 47], 20: [0, 82], 21: [23, 91], 22: [59, 86], 23: [133, 92], 24: [172, 90], 25: [195, 70],
  26: [216, 98], 27: [249, 77],
};

export const REGION_NAMES = {
  1: 'North Erg', 2: 'Harg Cliffs', 3: 'Wind Peaks', 4: 'Arsunt Plateau', 5: 'Shulkh Ridge', 6: 'Imperial Basin',
  7: 'Western Wall', 8: 'Carthag Basin', 9: 'North Citadel', 10: 'Keir Pass', 11: 'Salt Flats', 12: 'East Erg',
  13: 'Caladan Rocks', 14: 'Sietch Tabr', 15: 'Great Basin', 16: 'False Wall', 17: 'Ordos Wastes', 18: 'Wind Ridge',
  19: 'Eastern Cliffs', 20: 'Southern Barrier', 21: 'Valley of Sands', 22: 'The Rift', 23: 'Wadi Surt', 24: 'Spice Fields',
  25: 'Habbanya', 26: 'South Erg', 27: 'Sigma Rocks',
};

export const INITIAL_OWNERS = {
  [H.ATREIDES]: [7, 13, 14, 20, 21, 22],
  [H.HARKONNEN]: [3, 4, 5, 6, 9, 10],
  [H.ORDOS]: [19, 23, 24, 25, 26, 27],
};

// Progress of the war on the region map per player house. For each level (2..9):
// map changes applied before showing the map, ticker text and attackable regions.
export const REGION_PROGRESS = {
  [H.ATREIDES]: {
    2: { changes: {}, text: 'The Atreides have secured key lands. The Ordos have moved in from the east, the Harkonnen invaded from the north.', choices: [8, 15, 23] },
    3: { changes: { [H.ATREIDES]: [8, 15, 23], [H.ORDOS]: [12, 16, 17, 18], [H.HARKONNEN]: [1, 2, 11] }, text: 'The Atreides have expanded and pushed the Ordos back; the Ordos now advance on the Harkonnen.', choices: [1, 2, 3] },
    4: { changes: { [H.ATREIDES]: [1, 2, 3], [H.ORDOS]: [11], [H.HARKONNEN]: [16, 6] }, text: 'The Harkonnen borders are weak. Only a single outpost still holds.', choices: [4, 9, 16] },
    5: { changes: { [H.ATREIDES]: [4, 9, 16], [H.HARKONNEN]: [11, 6] }, text: 'The Harkonnen are retreating into Ordos lands.', choices: [17, 25, 24] },
    6: { changes: { [H.ATREIDES]: [17, 25, 24], [H.HARKONNEN]: [18] }, text: 'All forces are thrown against the Ordos, but the Harkonnen are regrouping.', choices: [10, 11, 18] },
    7: { changes: { [H.ATREIDES]: [10, 11, 18] }, text: 'The Atreides drive their enemies ever further back.', choices: [19, 27, 26] },
    8: { changes: { [H.ATREIDES]: [26, 27, 19] }, text: 'The Ordos are nearly destroyed and have allied with the Harkonnen.', choices: [5, 12] },
    9: { changes: { [H.ATREIDES]: [5, 12], [H.SARDAUKAR]: [6] }, text: 'Only the Emperor’s troops at the palace remain.', choices: [6] },
  },
  [H.HARKONNEN]: {
    2: { changes: {}, text: 'The Harkonnen arrived first. The Atreides are easy prey; the Ordos are creeping closer.', choices: [1, 2, 8] },
    3: { changes: { [H.HARKONNEN]: [1, 2, 8], [H.ATREIDES]: [15, 16, 23], [H.ORDOS]: [11, 12, 17, 18] }, text: 'The Harkonnen have posted strong garrisons. The Ordos have grabbed more land.', choices: [17, 11, 12] },
    4: { changes: { [H.HARKONNEN]: [11, 12, 17], [H.ATREIDES]: [24], [H.ORDOS]: [16] }, text: 'The Ordos never stood a chance. The Atreides and Ordos have traded territory.', choices: [25, 18, 19] },
    5: { changes: { [H.HARKONNEN]: [18, 19, 25], [H.ORDOS]: [24, 27] }, text: 'The Ordos outpost is surrounded, but they have broken through the Atreides.', choices: [13, 7, 14] },
    6: { changes: { [H.HARKONNEN]: [7, 13, 14], [H.ORDOS]: [23] }, text: 'House Atreides will soon vanish from the map of Dune.', choices: [24, 26, 27] },
    7: { changes: { [H.HARKONNEN]: [24, 26, 27], [H.ATREIDES]: [20, 23] }, text: 'The Harkonnen have crushed most of the Ordos.', choices: [20, 21, 22] },
    8: { changes: { [H.HARKONNEN]: [20, 21, 22] }, text: 'The Atreides are routed and seek an alliance with the Ordos.', choices: [16, 23] },
    9: { changes: { [H.HARKONNEN]: [16, 23], [H.SARDAUKAR]: [15] }, text: 'Only the Harkonnen will prevail.', choices: [15] },
  },
  [H.ORDOS]: {
    2: { changes: {}, text: 'The Ordos have taken the best lands. The Atreides are close by; the Harkonnen threaten from the north.', choices: [15, 16, 17] },
    3: { changes: { [H.ORDOS]: [15, 16, 17], [H.ATREIDES]: [1, 2, 8], [H.HARKONNEN]: [11, 12, 18] }, text: 'The Ordos advanced unopposed while the Atreides overextended.', choices: [14, 22, 8] },
    4: { changes: { [H.ORDOS]: [8, 14, 22], [H.HARKONNEN]: [2] }, text: 'Every blow falls on the Atreides.', choices: [13, 20, 21] },
    5: { changes: { [H.ORDOS]: [13, 20, 21], [H.ATREIDES]: [2] }, text: 'The Ordos have profited from the war between the Atreides and the Harkonnen.', choices: [11, 18, 12] },
    6: { changes: { [H.ORDOS]: [11, 12, 18] }, text: 'The Harkonnen had to be pushed back.', choices: [1, 7, 2] },
    7: { changes: { [H.ORDOS]: [1, 2, 7], [H.ATREIDES]: [3] }, text: 'The Ordos have finished off most of the Atreides.', choices: [10, 5, 6] },
    8: { changes: { [H.ORDOS]: [5, 6, 10] }, text: 'The Ordos have seized new Harkonnen lands.', choices: [3, 9] },
    9: { changes: { [H.ORDOS]: [3, 9], [H.SARDAUKAR]: [4] }, text: 'Soon all of Dune will belong to the Ordos.', choices: [4] },
  },
};

// Level templates per player house.
// Unit lists: "type*count"; 'infantry' / 'troopers' = squads of 3.
// Reinforcement: "[house:]type*count@minute[+]" (+ = repeating).
const L = (o) => o;

export const CAMPAIGNS = {
  [H.ATREIDES]: [
    L({ level: 1, enemies: [H.ORDOS], scale: 1, credits: 1000, quota: 1000, enemyCredits: [0],
      player: 'soldier*3,trike*2', enemy: [{ units: 'soldier*12', base: '', ambushRatio: 0.75 }], worms: 0 }),
    L({ level: 2, enemies: [H.ORDOS], scale: 1, credits: 1200, quota: 2700, enemyCredits: [0],
      player: 'trike*3,soldier*3,quad', enemy: [{ units: 'raider*5,soldier*3,trooper*3', base: 'constructionYard,silo,radar,windtrap,refinery,barracks' }], worms: 0 }),
    L({ level: 3, enemies: [H.HARKONNEN], credits: 1500, enemyCredits: [300],
      player: 'soldier*3,quad*2,trike*2,infantry', enemy: [{ units: 'quad*7,trooper*7,troopers', base: 'windtrap*2,silo,refinery,wor,radar,constructionYard,lightFactory' }],
      enemyReinf: ['trooper*2@5', 'trooper*2@10', 'trooper*2@20'], playerReinf: ['trike@6', 'infantry@6', 'infantry*2@11'], worms: 3 }),
    L({ level: 4, enemies: [H.HARKONNEN], credits: 1500, enemyCredits: [400],
      player: 'quad*4,infantry*3,trike*2', enemy: [{ units: 'troopers*7,quad*5,tank*5', base: 'wall*18,windtrap*2,silo,refinery,constructionYard,wor,lightFactory,heavyFactory,radar' }],
      enemyReinf: ['troopers*2@11', 'S:troopers*4@20+'], playerReinf: ['tank@12', 'quad@12', 'tank*2@21'], worms: 3 }),
    L({ level: 5, enemies: [H.ORDOS], credits: 1500, enemyCredits: [600],
      player: 'quad*3,tank*3,infantry*2', enemy: [{ units: 'tank*9,troopers*3,raider,quad', base: 'wall*28,gunTurret*8,windtrap*4,constructionYard*2,refinery*2,highTechFactory,radar,lightFactory,heavyFactory,wor,repairYard,silo' }],
      enemyReinf: ['troopers*3@11', 'quad@20', 'tank@20'], playerReinf: ['tank@12', 'quad@12', 'tank*2@21'], worms: 2 }),
    L({ level: 6, enemies: [H.HARKONNEN], credits: 1700, enemyCredits: [750],
      player: 'quad*3,tank*3,launcher*2', enemy: [{ units: 'siegeTank*8,launcher*5,tank*5,quad*2,troopers', base: 'wall*32,rocketTurret*7,windtrap*5,constructionYard*2,heavyFactory*2,gunTurret*2,repairYard*2,wor*2,silo*2,refinery*2,radar,highTechFactory,lightFactory' }],
      enemyReinf: ['troopers*2@12', 'quad@12', 'troopers@20', 'siegeTank@20'], playerReinf: ['tank@13', 'launcher@13', 'siegeTank*2@21'], worms: 2,
      choam: 'trike:5,quad:5,tank:4,launcher:3,harvester:2,mcv:2,carryall:2' }),
    L({ level: 7, enemies: [H.ORDOS], credits: 2000, enemyCredits: [1000],
      player: 'siegeTank*2,quad*2,tank*2,launcher', enemy: [{ units: 'siegeTank*7,quad*4,deviator*4,troopers*3,tank*2,raider', base: 'wall*24,rocketTurret*8,windtrap*5,heavyFactory*2,wor*2,silo*2,refinery*2,ix,constructionYard,repairYard,highTechFactory,lightFactory,radar' }],
      enemyReinf: ['troopers*2@12', 'quad@12', 'deviator@20', 'siegeTank@20', 'tank@20'], playerReinf: ['tank@13', 'launcher@13', 'sonicTank@21', 'siegeTank@21'], worms: 2,
      choam: 'trike:5,quad:5,tank:5,siegeTank:3,launcher:4,harvester:2,mcv:2,carryall:2' }),
    L({ level: 8, enemies: [H.HARKONNEN, H.ORDOS], credits: 2000, enemyCredits: [1000, 1000],
      player: 'launcher*2,siegeTank*2,quad,sonicTank,tank', enemy: [
        { units: 'launcher*5,siegeTank*4,devastator*3', base: 'wall*44,rocketTurret*7,windtrap*5,refinery*2,silo*2,constructionYard,heavyFactory,wor,lightFactory,palace,repairYard,highTechFactory' },
        { units: 'siegeTank*5,deviator*3,quad*2', base: 'wall*40,rocketTurret*7,windtrap*4,refinery*2,silo*2,heavyFactory,wor,lightFactory,highTechFactory,constructionYard,repairYard' },
      ],
      palaceVariants: [0, 1],
      enemyReinf: ['0:troopers@12', '1:siegeTank@12', '0:troopers@14', '0:devastator@14', '1:launcher@21', '1:deviator@21', 'S:troopers*4@30+'],
      playerReinf: ['siegeTank@13', 'launcher@13', 'infantry@22', 'siegeTank@22', 'sonicTank@22'], worms: 2,
      choam: 'trike:5,quad:5,tank:5,siegeTank:4,launcher:4,harvester:2,mcv:2,carryall:2,ornithopter:3' }),
    L({ level: 9, enemies: [H.HARKONNEN, H.ORDOS, H.SARDAUKAR], credits: 1000, enemyCredits: [1500, 1500, 2500],
      player: 'siegeTank*4,sonicTank*2', enemy: [
        { units: 'devastator*3,launcher*2', base: 'wall*30,rocketTurret*4,windtrap*3,constructionYard*2,gunTurret*2,heavyFactory,highTechFactory,silo,refinery,wor,lightFactory,repairYard,palace' },
        { units: 'siegeTank*3,deviator*2', base: 'wall*26,rocketTurret*6,windtrap*2,refinery*2,lightFactory*2,palace,silo,constructionYard,highTechFactory,wor,heavyFactory' },
        { units: 'launcher*3,siegeTank', base: 'wall*40,rocketTurret*9,windtrap*3,constructionYard*2,wor*2,repairYard,highTechFactory,refinery,heavyFactory,palace' },
      ],
      enemyReinf: ['S:troopers@12+', '1:siegeTank@12+', 'S:troopers@14+', '0:siegeTank@14+', '1:troopers@21+', '1:deviator@21+', 'S:troopers*4@30+'],
      playerReinf: ['sonicTank@13', 'launcher@13', 'troopers@22', 'siegeTank@22', 'sonicTank@22'], worms: 2,
      choam: 'trike:5,quad:5,tank:6,launcher:5,siegeTank:6,harvester:4,mcv:2,ornithopter:5,carryall:2' }),
  ],
  [H.HARKONNEN]: [
    L({ level: 1, enemies: [H.ATREIDES], scale: 1, credits: 1000, quota: 1000, enemyCredits: [0],
      player: 'trooper*3,quad*2', enemy: [{ units: 'infantry*4,soldier', base: '', ambushRatio: 0.7 }], worms: 0 }),
    L({ level: 2, enemies: [H.ATREIDES], scale: 1, credits: 1200, quota: 2700, enemyCredits: [100],
      player: 'quad*4,trooper*3', enemy: [{ units: 'infantry*3,trike*5,quad', base: 'windtrap*2,constructionYard,radar,barracks,refinery' }], worms: 0 }),
    L({ level: 3, enemies: [H.ORDOS], credits: 1500, enemyCredits: [300],
      player: 'quad*4,trooper*3', enemy: [{ units: 'raider*7,infantry*3,quad*3,trooper*2', base: 'windtrap*2,refinery,constructionYard,silo,barracks,lightFactory,radar' }],
      enemyReinf: ['trooper*2@5', 'trooper*2@10', 'trooper*2@20'], playerReinf: ['trike@6', 'trooper@6', 'trooper*2@11'], worms: 2 }),
    L({ level: 4, enemies: [H.ORDOS], credits: 1500, enemyCredits: [500],
      player: 'quad*4,troopers*2', enemy: [{ units: 'raider*5,tank*6,troopers*4,quad*3,infantry*2', base: 'wall*22,windtrap*2,silo*2,lightFactory,constructionYard,radar,heavyFactory,refinery,wor' }],
      enemyReinf: ['troopers*2@11', 'S:troopers*4@20+'], playerReinf: ['tank@12', 'quad@12', 'tank*2@21'], worms: 2 }),
    L({ level: 5, enemies: [H.ATREIDES], credits: 1500, enemyCredits: [700],
      player: 'tank*3,quad*3,troopers*2', enemy: [{ units: 'tank*10,launcher*7', base: 'wall*28,gunTurret*14,windtrap*4,refinery*2,silo*2,constructionYard,repairYard,barracks,radar,highTechFactory,lightFactory,heavyFactory' }],
      enemyReinf: ['troopers@11', 'tank@11', 'tank*2@20', 'quad@20'], playerReinf: ['tank@12', 'quad@12', 'tank*2@21'], worms: 2 }),
    L({ level: 6, enemies: [H.ORDOS], credits: 1700, enemyCredits: [800],
      player: 'tank*3,quad*3,launcher', enemy: [{ units: 'siegeTank*10,troopers*4,quad*4,tank*4', base: 'wall*28,rocketTurret*7,windtrap*6,refinery*2,silo*2,wor*2,heavyFactory*2,constructionYard,radar,lightFactory,repairYard,highTechFactory' }],
      enemyReinf: ['troopers*2@12', 'quad@12', 'troopers@20', 'siegeTank@20'], playerReinf: ['tank@13', 'launcher@13', 'tank@21', 'siegeTank@21'], worms: 2,
      choam: 'trike:5,quad:5,tank:4,launcher:3,harvester:2,mcv:2,carryall:2' }),
    L({ level: 7, enemies: [H.ATREIDES], credits: 1900, enemyCredits: [1000],
      player: 'tank*2,siegeTank*2,quad,launcher,troopers', enemy: [{ units: 'launcher*8,siegeTank*6,sonicTank*4,quad*2,tank', base: 'wall*26,rocketTurret*8,windtrap*6,heavyFactory*2,lightFactory*2,constructionYard*2,refinery*2,silo*2,highTechFactory,barracks,gunTurret,repairYard,ix,radar' }],
      enemyReinf: ['sonicTank@12', 'quad@12', 'tank@12', 'sonicTank*2@20', 'siegeTank@20'], playerReinf: ['tank@13', 'launcher@13', 'devastator@21', 'siegeTank@21'], worms: 2,
      choam: 'trike:5,quad:5,tank:5,siegeTank:3,launcher:4,harvester:2,mcv:2,carryall:2' }),
    L({ level: 8, enemies: [H.ATREIDES, H.ORDOS], credits: 2000, enemyCredits: [1000, 1000],
      player: 'launcher*2,siegeTank*2,quad,devastator,tank', enemy: [
        { units: 'launcher*5,siegeTank*5,sonicTank*3', base: 'wall*50,rocketTurret*8,windtrap*5,heavyFactory*2,refinery*2,silo*2,repairYard,palace,lightFactory,barracks,constructionYard' },
        { units: 'siegeTank*5,deviator*3', base: 'wall*36,rocketTurret*8,windtrap*3,silo*2,refinery*2,repairYard,constructionYard,highTechFactory,lightFactory,wor,heavyFactory' },
      ],
      palaceVariants: [0, 1],
      enemyReinf: ['0:troopers@12', '0:siegeTank@12', '0:troopers@14', '0:sonicTank@14', '1:troopers@21', '1:deviator@21', 'S:troopers*4@30+'],
      playerReinf: ['siegeTank@13', 'launcher@13', 'infantry@22', 'siegeTank@22', 'devastator@22'], worms: 2,
      choam: 'trike:5,quad:5,tank:5,siegeTank:4,launcher:4,harvester:2,mcv:2,carryall:2,ornithopter:3' }),
    L({ level: 9, enemies: [H.ATREIDES, H.ORDOS, H.SARDAUKAR], credits: 1000, enemyCredits: [1500, 1500, 2500],
      player: 'devastator*2,siegeTank*2,launcher*2,quad,troopers', enemy: [
        { units: 'siegeTank*4,launcher', base: 'wall*26,rocketTurret*5,refinery*2,palace,silo,constructionYard,highTechFactory,wor,lightFactory,heavyFactory,windtrap*2' },
        { units: 'siegeTank*3,deviator*2', base: 'wall*30,rocketTurret*8,windtrap*3,silo*2,constructionYard,heavyFactory,highTechFactory,refinery,wor,lightFactory,palace' },
        { units: 'launcher*4,siegeTank', base: 'wall*40,rocketTurret*9,windtrap*4,wor*2,constructionYard,highTechFactory,silo,refinery,heavyFactory,palace' },
      ],
      enemyReinf: ['S:troopers@12+', '0:siegeTank@12+', 'S:troopers@14+', '1:deviator@14+', '0:troopers@21+', '0:sonicTank@21+', 'S:troopers*4@30+'],
      playerReinf: ['devastator@13', 'launcher@13', 'troopers@22', 'siegeTank@22', 'devastator@22'], worms: 2,
      choam: 'trike:5,quad:5,tank:6,launcher:5,siegeTank:6,harvester:4,mcv:2,ornithopter:5,carryall:2' }),
  ],
  [H.ORDOS]: [
    L({ level: 1, enemies: [H.HARKONNEN], scale: 1, credits: 1000, quota: 1000, enemyCredits: [0],
      player: 'soldier*3,raider*2', enemy: [{ units: 'soldier*7,trooper*5', base: '', ambushRatio: 0.7 }], worms: 0 }),
    L({ level: 2, enemies: [H.HARKONNEN], scale: 1, credits: 1200, quota: 2700, enemyCredits: [0],
      player: 'raider*4,soldier*4', enemy: [{ units: 'trooper*5,quad*4,soldier', base: 'constructionYard,silo,windtrap,wor,refinery,radar' }], worms: 0 }),
    L({ level: 3, enemies: [H.ATREIDES], credits: 1500, enemyCredits: [400],
      player: 'raider*4,soldier*3,infantry', enemy: [{ units: 'trike*8,infantry*4,soldier*3,quad', base: 'silo*2,windtrap*2,lightFactory,refinery,barracks,radar,constructionYard' }],
      enemyReinf: ['infantry*2@5', 'infantry*2@10', 'infantry*2@20'], playerReinf: ['trike@6', 'trooper@6', 'trooper*2@11'], worms: 2 }),
    L({ level: 4, enemies: [H.ATREIDES], credits: 1500, enemyCredits: [400],
      player: 'quad*3,infantry*3,raider*3', enemy: [{ units: 'tank*6,infantry*6,trike*3,quad*3', base: 'wall*20,windtrap*2,silo*2,refinery,heavyFactory,barracks,lightFactory,radar,constructionYard' }],
      enemyReinf: ['troopers*2@11', 'S:troopers*4@20+'], playerReinf: ['tank@12', 'quad@12', 'tank*2@21'], worms: 2 }),
    L({ level: 5, enemies: [H.HARKONNEN], credits: 1500, enemyCredits: [710],
      player: 'tank*3,quad*3,troopers,infantry', enemy: [{ units: 'launcher*5,tank*6,troopers*2,quad', base: 'wall*30,gunTurret*8,windtrap*4,refinery*2,highTechFactory,silo*2,lightFactory,wor,repairYard,radar,heavyFactory,constructionYard' }],
      enemyReinf: ['troopers@11', 'tank@11', 'tank*2@20', 'quad@20'], playerReinf: ['tank@12', 'quad@12', 'tank*2@21'], worms: 2 }),
    L({ level: 6, enemies: [H.ATREIDES], credits: 1700, enemyCredits: [800],
      player: 'quad*3,tank*3,troopers*2', enemy: [{ units: 'siegeTank*8,launcher*5,tank*5,quad*3', base: 'wall*34,rocketTurret*6,windtrap*4,refinery*2,repairYard*2,constructionYard*2,gunTurret*2,silo*2,highTechFactory,radar,barracks,heavyFactory,wor,lightFactory' }],
      enemyReinf: ['infantry@12', 'quad@12', 'tank@12', 'launcher@20', 'siegeTank@20'], playerReinf: ['tank@13', 'troopers@13', 'siegeTank*2@21'], worms: 2,
      choam: 'trike:5,quad:5,tank:4,launcher:3,harvester:2,mcv:2,carryall:2' }),
    L({ level: 7, enemies: [H.HARKONNEN], credits: 2000, enemyCredits: [1000],
      player: 'siegeTank*2,quad*2,tank*2,troopers', enemy: [{ units: 'launcher*7,siegeTank*6,devastator*4,quad*3,tank,troopers', base: 'wall*32,rocketTurret*8,windtrap*6,heavyFactory*2,refinery*2,silo*2,wor*2,radar,lightFactory,highTechFactory,repairYard,constructionYard,ix' }],
      enemyReinf: ['troopers*2@12', 'quad@12', 'launcher@20', 'devastator@20', 'tank@20'], playerReinf: ['tank@13', 'deviator@13', 'deviator@21', 'siegeTank@21'], worms: 2,
      choam: 'trike:5,quad:5,tank:5,siegeTank:3,launcher:4,harvester:2,mcv:2,carryall:2' }),
    L({ level: 8, enemies: [H.ATREIDES, H.HARKONNEN], credits: 2000, enemyCredits: [1000, 1000],
      player: 'siegeTank*2,troopers*2,deviator,tank,quad', enemy: [
        { units: 'siegeTank*4,sonicTank*4,launcher*3,quad*2,tank', base: 'wall*50,rocketTurret*7,windtrap*5,refinery*2,silo*2,palace,heavyFactory,highTechFactory,lightFactory,barracks,constructionYard' },
        { units: 'devastator*4,launcher*3,siegeTank*2', base: 'wall*40,rocketTurret*6,windtrap*4,refinery*2,silo*2,lightFactory,repairYard,heavyFactory,wor,highTechFactory,constructionYard' },
      ],
      palaceVariants: [0, 1],
      enemyReinf: ['0:troopers@12', '0:siegeTank@12', '1:troopers@30', '1:devastator@30', '0:launcher@21', '0:sonicTank@21', 'S:troopers*4@30+'],
      playerReinf: ['siegeTank@13', 'troopers@13', 'troopers@22', 'siegeTank@22', 'deviator@22'], worms: 2,
      choam: 'trike:5,quad:5,tank:5,siegeTank:4,launcher:4,harvester:2,mcv:2,carryall:2,ornithopter:3' }),
    L({ level: 9, enemies: [H.ATREIDES, H.HARKONNEN, H.SARDAUKAR], credits: 1500, enemyCredits: [1000, 1500, 2500],
      player: 'siegeTank*4,deviator*2', enemy: [
        { units: 'siegeTank*5,sonicTank,launcher', base: 'wall*26,rocketTurret*6,refinery*2,lightFactory*2,palace,silo,constructionYard,highTechFactory,wor,heavyFactory,windtrap*2' },
        { units: 'devastator*3,launcher*2', base: 'wall*30,rocketTurret*4,windtrap*3,gunTurret*2,constructionYard*2,heavyFactory,highTechFactory,silo,refinery,wor,lightFactory,repairYard,palace' },
        { units: 'launcher*3,siegeTank', base: 'wall*40,rocketTurret*9,windtrap*3,constructionYard*2,wor*2,repairYard,highTechFactory,refinery,heavyFactory,palace' },
      ],
      enemyReinf: ['S:troopers@12+', '0:siegeTank@12+', 'S:troopers@14+', '0:sonicTank@14+', '0:troopers@21+', '0:launcher@21+', 'S:troopers*4@30+'],
      playerReinf: ['deviator@13', 'troopers@13', 'troopers@22', 'siegeTank@22', 'deviator@22'], worms: 2,
      choam: 'trike:5,quad:5,tank:6,launcher:5,siegeTank:6,harvester:4,mcv:2,ornithopter:5,carryall:2' }),
  ],
};

// Original briefings (written for this game)
export const BRIEFINGS = {
  [H.ATREIDES]: [
    'Welcome to Arrakis, Commander. I am Cyril, Mentat of House Atreides, and I will be at your side throughout this campaign. Your first assignment is a modest one: establish a harvesting operation and deliver one thousand credits of spice to the House. Begin with a Windtrap, then raise a Spice Refinery. A Harvester will be delivered along with it. The Ordos infantry nearby are a danger only to the careless.',
    'Your first report pleased the House Council, and you have been entrusted with a richer territory. This time you must accumulate two thousand seven hundred credits. Our scouts have found an Ordos encampment nearby. Escort your Harvesters with Trikes from the new Light Factory, and recruit infantry at the Barracks. If the Ordos will not leave you in peace, you have my permission to raze their camp.',
    'We long hoped to settle matters peacefully, but the Harkonnen understand only force. Their garrison in the neighbouring region raids our caravans and threatens our people. Drive the Harkonnen out and leave not a single structure standing. Once upgraded, your Light Factory will provide Quads; use them together. And beware the worms. This is their territory.',
    'The Harkonnen are hunting our Harvesters again, machines that threaten no one. The Council will tolerate it no longer. The Heavy Factory is ready, and Combat Tanks will become the backbone of your army. There are troubling rumours that someone powerful is supplying the Harkonnen with troops, so be ready for surprises.',
    'You saw it with your own eyes: Imperial Sardaukar fought alongside the Harkonnen. Our diplomats will learn how they earned such favour. Your target is the Ordos, who exploited the chaos to seize this region. Missile Tanks, a Repair Facility, turrets and a High-Tech Factory with Carryalls are now at your disposal.',
    'Every sector we reclaim adds weight to our voice in the Landsraad, and now we need one more. The Harkonnen have dug in behind walls and Rocket Turrets, and their Siege Tanks hit hard and from afar. The Starport lets you order vehicles from CHOAM, and the upgraded Heavy Factory will begin producing Siege Tanks of our own.',
    'The scales are tipping in our favour, but the Ordos still hold a rich district and hide Ixian technology there. We too have gained access to the House of Ix, and its craftsmen have built us the Sonic Tank, capable of piercing an entire enemy column. Beware the Deviators: their gas turns our machines against us for a time. Clear the region of the Ordos.',
    'The Ordos and the Harkonnen have set aside their old feuds and now march against us as one. The Council has authorised the construction of a Palace, from which you can call upon the Fremen, our friends from the deep desert. One of the enemies also has a Palace, so do not keep all your forces in one place. Both bases must fall.',
    'This is the final battle for Dune. Emperor Frederick has cast off his mask. His Sardaukar, together with the remnants of the Ordos and the Harkonnen, have entrenched themselves around his palace, and each of the three armies has a Palace of its own. Our forces are few, so every Harvester and every tank counts. Win, and the Emperor will stand trial before House Atreides.',
  ],
  [H.HARKONNEN]: [
    'My name is Radnor, and from now on your career, and quite possibly your life, depends on my opinion of you. We begin with something simple: one thousand credits of spice, and I want no excuses. A Windtrap, a Spice Refinery. Even a recruit could manage that. If Atreides infantry come sniffing around the base, let our men have some sport with them.',
    'You succeeded. For now. Next is a territory with more spice and no fewer enemies: collect two thousand seven hundred credits. A tiny Atreides outpost has dug in nearby. Burning it would be pleasant, but the quota matters more than pleasure. Barracks are for weaklings; you have the WOR and real Heavy Troopers.',
    'The Ordos merchants imagine they can pump our spice. They are mistaken. Find their base and wipe it out. No negotiations, no prisoners. The Light Factory will give you Quads; leave the toy Trikes to others.',
    'Do not let your first success go to your head. The Ordos have spread through this region like sand fleas, and you will have to purge them all over again. The Heavy Factory is now yours: tanks settle disputes faster than diplomats. And do not be surprised if the Ordos suddenly find friends in Imperial uniforms.',
    'Sardaukar fighting for the Ordos... The Emperor is playing dangerous games, and I will not forget it. Meanwhile the Atreides, left unattended, have ringed their bases with turrets and fancy themselves the masters here. Missile Tanks and a Repair Facility are now at your disposal. Let them learn how their nobility burns.',
    'The Ordos are underfoot again, this time behind walls and Rocket Turrets, with a whole fleet of Siege Tanks. I have granted you a Starport and the right to build Siege Tanks of your own. Do not make me regret my generosity. Burn their base to the ground.',
    'Our spies report that the Atreides have acquired Ixian toys called Sonic Tanks. The House of Ix has given us something far more serious: the Devastator, a nuclear fortress on tracks. Show them whose armour is stronger. Nothing of their base may remain that could ever be rebuilt.',
    'You now have a Palace, and with it the Death Hand, a missile no wall can stop. The Atreides and the Ordos are holed up in this sector together, like rats in a single burrow. Destroy them both. Succeed, and I may mention your name to the Baron.',
    'Frederick thought he could make fools of the Harkonnen, and he shielded our enemies with his Sardaukar. Such mistakes are paid for in blood. The Atreides, the Ordos and the Imperial guard have locked themselves in around the palace, and each has a Palace of its own, so burn them all. Dune belongs to the Harkonnen, and we will deal with the Emperor separately.',
  ],
  [H.ORDOS]: [
    'I am Ammon, Mentat of the Ordos Cartel. Remember the name; it will be signed beneath your contracts. We care only for profit, so let us begin with a test: one thousand credits of spice. Build a Windtrap and a Spice Refinery, and a Harvester will follow. You may ignore the Harkonnen infantry in the area, so long as they do not interfere with business.',
    'The first result is acceptable. The new target is two thousand seven hundred credits, and that alone matters. A Harkonnen outpost stands next door, and its spice stores would be useful to the Cartel: send infantry and take them intact. The Barracks and a Light Factory with Raiders are now available.',
    'The Atreides have settled where we need freedom of action. Remove them. Leave talk of honour to the Atreides themselves; it has never once saved them. The upgraded Light Factory will provide Quads for swift strikes.',
    'The Atreides in this district must disappear. The Cartel still pays generously for captured structures: an intact enemy building is worth more than a heap of rubble. The Heavy Factory and its tanks are at your service. Our informants hint that the Atreides may receive unexpected help. Factor that into your calculations.',
    'The Sardaukar intervention in the last battle cost us money, and I shall present the bill later. For now, the Harkonnen stand in the Cartel’s way: there are far too many of their tanks and rocket troops in this sector. Clear the region. The High-Tech Factory, the Repair Facility, turrets and the WOR for Heavy Troopers are now available.',
    'The Atreides flood the Landsraad with complaints and petitions, while their army occupies a sector we find most profitable. The Cartel prefers quiet; see that we get it. Through the Starport you can purchase what our factories do not produce, Missile Tanks for instance. The expenses, naturally, must pay for themselves.',
    'The Harkonnen continue to disrupt our shipments. The House of Ix has granted us the Deviator: its gas makes enemy machines fight for us for a time. Turn their vaunted Devastators against their own base. We now produce Siege Tanks of our own as well.',
    'The Atreides and the Harkonnen, yesterday’s enemies, have struck a bargain against us. The Cartel has approved the construction of a Palace, and its Saboteurs can infiltrate any fortress. Destroy both bases, and quickly: a protracted war ruins even the Ordos.',
    'Emperor Frederick decided he could move the Ordos about like game pieces. That was his last mistake. His Sardaukar and the remnants of the Atreides and the Harkonnen have gathered at the Imperial palace, and each has a Palace of its own. Everything the Cartel has saved for years is at stake. Destroy them, and Dune will be our deal of the century.',
  ],
};

export const VICTORY_TEXT = {
  [H.ATREIDES]: ['Excellent work, Commander. The Council of House Atreides thanks you.', 'Well done. Our people are safe, and the spice flows freely.', 'Victory! Caladan is proud of you.'],
  [H.HARKONNEN]: ['Acceptable. The Baron is pleased. For now.', 'Not bad. Our enemies burn, and the Harkonnen grow richer.', 'Good. Your head stays on your shoulders, for the time being.'],
  [H.ORDOS]: ['Profitable. The Cartel records this result among your assets.', 'The expenses have paid off. Continue in the same manner.', 'A brilliant deal, Commander.'],
};

export const DEFEAT_TEXT = {
  [H.ATREIDES]: 'We have been defeated, but House Atreides does not surrender. Gather your strength and choose another territory for the offensive.',
  [H.HARKONNEN]: 'Disgraceful! The Baron does not forgive failure. You have one more chance. Do not waste it.',
  [H.ORDOS]: 'An unprofitable operation. The Cartel will write off the losses, but it will not forgive a second time. Try another approach.',
};

export const MEANWHILE = {
  4: {
    [H.ATREIDES]: 'Meanwhile, at the Emperor’s palace. Frederick the Fourth is furious: the Harkonnen envoy was given Imperial Sardaukar, and still lost to the Atreides. “I will not allow this again,” the Emperor says coldly.',
    [H.HARKONNEN]: 'Meanwhile, at the Emperor’s palace. The Ordos envoy tries to justify himself: the Sardaukar, he claims, arrived too late. The Emperor cuts him off mid-sentence. The Harkonnen have proven stronger than he anticipated.',
    [H.ORDOS]: 'Meanwhile, at the Emperor’s palace. The Atreides Mentat endures the reproaches of Frederick the Fourth: even with the help of the Sardaukar, the Atreides could not hold their land. The Emperor grows thoughtful. The Ordos are more dangerous than they seem.',
  },
  8: {
    [H.ATREIDES]: 'Meanwhile, on Dune. The Emperor has come to Arrakis in person. He gave the Harkonnen and the Ordos weapons and troops, yet still they flee from the Atreides. “From now on you will fight together, and alongside my Sardaukar!”',
    [H.HARKONNEN]: 'Meanwhile, on Dune. The Emperor refuses to hear any more excuses from the Atreides and the Ordos. He proclaims an alliance against the Harkonnen and takes personal command of the final defence.',
    [H.ORDOS]: 'Meanwhile, on Dune. Frederick the Fourth unites the remnants of the Atreides and the Harkonnen under the Imperial banner. The final battle for Dune will begin at his palace.',
  },
};

export const FINALE = {
  [H.ATREIDES]: 'The Atreides enter the throne room. A representative of the House formally charges Frederick the Fourth with treason. His fate will be decided by a lawful court; until then, the Emperor is removed from power. Dune belongs to House Atreides, and from now on the law rules here.',
  [H.HARKONNEN]: 'The Harkonnen envoy accuses the Emperor of lying: he swore loyalty while playing a double game. The Harkonnen answer is brief. Gunfire, a crash, the ring of shattering glass. The Emperor is dead. Dune belongs to the Harkonnen, and they do not share.',
  [H.ORDOS]: 'The Ordos envoy calmly explains to the Emperor that every House was a pawn, and Dune was the board. But now the Ordos are playing the game, and the Emperor himself will become one of their pieces. A strange rustle in the shadows... Frederick the Fourth is a puppet of the Cartel. Dune is the deal of the century.',
};

// region id -> sphere direction for the 3D planet map
export function regionDir(id) {
  const [px, py] = REGION_POS[id];
  const cx = px + 22;
  const cy = py + 16;
  const lon = ((cx / 320) * 2 - 1) * (Math.PI * 0.62);
  const lat = (0.5 - cy / 130) * Math.PI * 0.75;
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

export const INTRO_TEXT = [
  'Arrakis. Dune. A world of endless sand, and the one place in the universe where the spice, melange, can be found.',
  'The spice extends life, expands the mind and makes travel between the stars possible. Whoever rules Dune rules the spice. And whoever rules the spice rules the Empire.',
  'Padishah Emperor Frederick the Fourth, deep in debt to CHOAM, has announced a contest: Arrakis will go to the Great House that harvests the most spice.',
  'No borders have been drawn, and no law binds the contenders. Three Great Houses send their armies to the planet: the honourable Atreides, the scheming Ordos and the ruthless Harkonnen.',
  'Only one House will prevail. Your battle for Dune begins now.',
];
