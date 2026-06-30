export type Rng = {
  next: () => number;
  getState: () => number;
  setState: (state: number) => void;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState() {
      return state;
    },
    setState(nextState: number) {
      state = nextState >>> 0;
    },
  };
}

export function hashSeed(createdAt: string, level: number): number {
  const input = `${createdAt}:${level}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
