export const GAME_CONFIG = {
  width: 1280,
  height: 720,
  roundSeconds: 60,
  targetScore: 1500,
  groundY: 170,
  octopusInkRadius: 140
};

export const HERO_IMAGE = "assets/images/evil-girl.jpg";
export const DEFAULT_ANGRY_OCTOPUS_PENALTY = 200;

export const ITEM_CONFIGS = {
  starHandsome: {
    name: "明星帅哥",
    score: 300,
    radius: 42,
    speed: 16,
    pullSpeed: 350,
    spawnCount: 4,
    spriteScale: 1.18,
    image: "assets/images/star-handsome.jpg",
    color: "#ffd85e"
  },
  hamster: {
    name: "我的仓鼠",
    score: 120,
    radius: 20,
    speed: 58,
    pullSpeed: 640,
    spawnCount: 6,
    spriteScale: 0.86,
    image: "assets/images/hamster.jpg",
    color: "#e8b17b"
  },
  uglyMan: {
    name: "丑男",
    score: 20,
    radius: 44,
    speed: 8,
    pullSpeed: 250,
    spawnCount: 5,
    spriteScale: 1.12,
    image: "assets/images/ugly-man.jpg",
    color: "#93a1b7"
  },
  husband: {
    name: "我老公",
    score: 500,
    radius: 24,
    speed: 96,
    pullSpeed: 500,
    spawnCount: 3,
    spriteScale: 1.08,
    image: "assets/images/husband.jpg",
    color: "#ff6aa0"
  },
  angryOctopus: {
    name: "Angry Octopus",
    score: -DEFAULT_ANGRY_OCTOPUS_PENALTY,
    radius: 30,
    speed: 42,
    pullSpeed: 300,
    spawnCount: 2,
    spriteScale: 1.04,
    image: "assets/images/angry-octopus.png",
    color: "#3f365f"
  }
};
