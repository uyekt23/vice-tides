// Vice Tides — shared tuning and city constants. Every other module reads its numbers from
// here so the whole game can be rebalanced in one place.

// ---- City layout (units are metres) ----
// Roads run on a grid: vertical roads at x = i * PITCH, horizontal roads at z = j * PITCH.
// Blocks of BLOCK x BLOCK metres sit between them. South of the last road is the beach.
export const PITCH = 56;
export const ROAD_W = 16;
export const BLOCK = PITCH - ROAD_W; // 40
export const GRID_X = 4;              // vertical roads i = -GRID_X..GRID_X
export const GRID_Z_TOP = -3;         // horizontal roads j = GRID_Z_TOP..GRID_Z_BOT
export const GRID_Z_BOT = 2;
export const CITY_MIN_X = -GRID_X * PITCH - ROAD_W / 2 - 6;
export const CITY_MAX_X = GRID_X * PITCH + ROAD_W / 2 + 6;
export const CITY_MIN_Z = GRID_Z_TOP * PITCH - ROAD_W / 2 - 6;
export const CITY_MAX_Z = GRID_Z_BOT * PITCH + ROAD_W / 2; // road edge; sand starts here
export const SAND_END_Z = CITY_MAX_Z + 34;
export const WATER_END_Z = SAND_END_Z + 130;
export const MARINA_X = 2 * PITCH;    // the pier runs south from here
export const MARINA_END_Z = SAND_END_Z + 62;

// ---- Player ----
export const PLAYER_RADIUS = 0.55;
export const WALK_SPEED = 5.2;
export const SPRINT_SPEED = 8.6;
export const PLAYER_MAX_HEALTH = 100;

// ---- Cars ----
export const CAR_RADIUS = 1.55;
export const TRAFFIC_COUNT = 16;
export const PARKED_COUNT = 22;
export const PED_COUNT = 26;

// ---- Wanted / police ----
export const HEAT_PER_STAR = 100;
export const MAX_STARS = 5;
export const POLICE_PER_STAR = 2;
export const POLICE_MAX_SPEED = 33;

// ---- Economy ----
export const PACKAGE_COUNT = 10;
export const PACKAGE_REWARD = 100;
export const PACKAGE_BONUS = 500; // for finding all of them
export const TAXI_MIN_FARE = 60;
export const TAXI_PER_METRE = 0.55;

// ---- Save ----
export const SAVE_KEY = 'viceTidesSaveV1';

// ---- Palette (golden hour over Palmera Bay) ----
export const COLORS = {
  sky: 0x2e1a47,
  fog: 0xe8906d,
  sun: 0xffb36b,
  asphalt: 0x33323e,
  sidewalk: 0xb9a894,
  sand: 0xecc987,
  water: 0x1d6f8e,
  grass: 0x5d8a4a,
};
