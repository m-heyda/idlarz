import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BIOMES, CASTLE_BASE_RATES, CASTLE_UPGRADE, GRID_SIZE, GRID_HEIGHT, INITIAL_RESOURCES, BASE_GENERATION_RATES, TILE_PURCHASE_COST } from '@/config/gameConfig';
import type { BiomeType, GameState, Resources, ResourceRates, Tile } from '@/types/game';

const GRID_CENTER_X = Math.floor(GRID_SIZE / 2);
const GRID_CENTER_Y = Math.floor(GRID_HEIGHT / 2);

const createInitialGrid = (): Tile[][] => {
  const grid = Array(GRID_HEIGHT).fill(null).map(() => 
    Array(GRID_SIZE).fill(null).map(() => ({
      biome: 'empty' as BiomeType,
      isOwned: false
    }))
  );

  // Place castle at center
  grid[GRID_CENTER_Y][GRID_CENTER_X] = {
    biome: 'castle',
    isOwned: true,
    level: 1,
    upgradeCost: CASTLE_UPGRADE.upgradeCosts[0]
  };

  return grid;
};

const calculateResourceRates = (tiles: GameState['tiles']): ResourceRates => {
  const base = { ...BASE_GENERATION_RATES };
  const total = { ...base };
  const modifiers = { gold: 1.0, wood: 1.0, stone: 1.0, coal: 1.0, food: 1.0 };

  // Find castle and apply its base rates and level multiplier
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = tiles[y][x];
      if (tile.isOwned && tile.biome === 'castle') {
        const level = tile.level || 1;
        const multiplier = Math.pow(CASTLE_UPGRADE.levelMultiplier, level - 1);
        
        // Apply castle base rates with level multiplier
        Object.entries(CASTLE_BASE_RATES).forEach(([resource, rate]) => {
          base[resource as keyof Resources] += rate * multiplier;
        });
        break;
      }
    }
  }

  // Calculate modifiers from all owned tiles
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = tiles[y][x];
      if (tile.isOwned) {
        const biome = BIOMES[tile.biome];
        Object.entries(biome.resourceModifiers).forEach(([resource, modifier]) => {
          modifiers[resource as keyof Resources] *= modifier;
        });
      }
    }
  }

  // Apply modifiers to get total rates
  Object.keys(total).forEach(resource => {
    total[resource as keyof Resources] = base[resource as keyof Resources] * modifiers[resource as keyof Resources];
  });

  return { base, modifiers, total };
};

const isAdjacentToOwned = (tiles: GameState['tiles'], x: number, y: number): boolean => {
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return directions.some(([dx, dy]) => {
    const newX = x + dx;
    const newY = y + dy;
    return newX >= 0 && newX < GRID_SIZE && 
           newY >= 0 && newY < GRID_HEIGHT && 
           tiles[newY][newX].isOwned;
  });
};

const canAffordCost = (resources: Resources, cost: number | Resources): boolean => {
  if (typeof cost === 'number') {
    return resources.gold >= cost;
  }
  return Object.entries(cost).every(([resource, amount]) => 
    resources[resource as keyof Resources] >= amount
  );
};

export const useGameStore = create(
  persist<GameState>((set, get) => {
    const initialGrid = createInitialGrid();
    const initialRates = calculateResourceRates(initialGrid);
    
    return {
      tiles: initialGrid,
      resources: { ...INITIAL_RESOURCES },
      resourceRates: initialRates,
      resourceModifiers: initialRates.modifiers,

      buyTile: (x: number, y: number): boolean => {
        const state = get();
        const tile = state.tiles[y][x];

        // Check if tile can be purchased
        if (tile.isOwned || !isAdjacentToOwned(state.tiles, x, y)) {
          return false;
        }

        // Check if can afford
        if (state.resources.gold < TILE_PURCHASE_COST) {
          return false;
        }

        // Get available biomes (excluding empty, castle, and grounds for now)
        const availableBiomes = Object.entries(BIOMES)
          .filter(([biome]) => !['empty', 'castle', 'grounds'].includes(biome))
          .map(([biome]) => biome as BiomeType);

        // Randomly select a biome
        const randomBiome = availableBiomes[Math.floor(Math.random() * availableBiomes.length)];

        // Update tile and resources
        const newTiles = [...state.tiles];
        newTiles[y] = [...newTiles[y]];
        newTiles[y][x] = {
          biome: randomBiome,
          isOwned: true
        };

        const newRates = calculateResourceRates(newTiles);

        set({
          tiles: newTiles,
          resources: {
            ...state.resources,
            gold: state.resources.gold - TILE_PURCHASE_COST
          },
          resourceRates: newRates,
          resourceModifiers: newRates.modifiers
        });

        return true;
      },

      upgradeCastle: (): boolean => {
        const state = get();
        
        // Find castle
        let castle: Tile | null = null;
        let castleX = -1, castleY = -1;
        
        for (let y = 0; y < GRID_HEIGHT; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            if (state.tiles[y][x].biome === 'castle') {
              castle = state.tiles[y][x];
              castleX = x;
              castleY = y;
              break;
            }
          }
          if (castle) break;
        }

        if (!castle || !castle.upgradeCost || !castle.level) return false;

        // Check if max level reached
        if (castle.level >= CASTLE_UPGRADE.maxLevel) return false;

        // Check if can afford upgrade
        if (!canAffordCost(state.resources, castle.upgradeCost)) return false;

        // Update castle and resources
        const newTiles = [...state.tiles];
        newTiles[castleY] = [...newTiles[castleY]];
        newTiles[castleY][castleX] = {
          ...castle,
          level: castle.level + 1,
          upgradeCost: CASTLE_UPGRADE.upgradeCosts[castle.level] || null
        };

        // Deduct resources
        const newResources = { ...state.resources };
        Object.entries(castle.upgradeCost).forEach(([resource, amount]) => {
          newResources[resource as keyof Resources] -= amount;
        });

        const newRates = calculateResourceRates(newTiles);

        set({
          tiles: newTiles,
          resources: newResources,
          resourceRates: newRates,
          resourceModifiers: newRates.modifiers
        });

        return true;
      },

      tick: (deltaTime: number): void => {
        const state = get();
        const secondsElapsed = deltaTime / 1000;

        // Update resources based on rates
        const newResources = { ...state.resources };
        Object.entries(state.resourceRates.total).forEach(([resource, rate]) => {
          newResources[resource as keyof Resources] += rate * secondsElapsed;
        });

        set({ resources: newResources });
      }
    };
  }), {
    name: 'idle-game-storage-v7',
    version: 1
  }
);
