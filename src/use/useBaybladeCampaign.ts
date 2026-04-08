import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { TopPartId, BottomPartId, BossAbility } from '@/types/bayblade'

// ─── Stage Enemy Config ─────────────────────────────────────────────────────

export interface StageBladeConfig {
  topPartId: TopPartId
  bottomPartId: BottomPartId
  topLevel: number
  bottomLevel: number
  modelId?: string
  isBoss?: boolean
  bossAbility?: BossAbility
}

export type ArenaType = 'default' | 'boss' | 'lava' | 'ice' | 'forest' | 'thunder'

export const ARENA_TYPES: ArenaType[] = ['default', 'boss', 'lava', 'ice', 'forest', 'thunder']

export interface Stage {
  id: number
  name: string
  isBoss?: boolean
  arenaType?: ArenaType
  enemyTeam: StageBladeConfig[]
  rewardWin: number
  rewardLose: number
  /**
   * Number of pinball-style bouncer obstacles placed on the arena floor
   * for this stage (1-3). Each bouncer behaves like the arena wall —
   * blades ricochet off it with a small speed boost — so encounters with
   * bouncers play out very differently from an empty floor. Undefined /
   * 0 means no bouncers on this stage.
   */
  bouncers?: number
}

// ─── Compact authoring helpers ──────────────────────────────────────────────
// These let the 100-stage table below stay terse enough to read on one screen
// while still being fully hand-editable — tweak any entry inline without
// touching the helpers.

/**
 * `e(top, bot, tl, bl, modelId, ability?)` — build one enemy blade.
 * `ability` promotes the blade to a boss and opts it into a special mechanic
 * handled by useBaybladeGame. Passing `'plain'` makes it a stat-only boss.
 */
const e = (
  top: TopPartId,
  bot: BottomPartId,
  tl: number,
  bl: number,
  modelId: string,
  ability?: BossAbility | 'plain'
): StageBladeConfig => {
  const cfg: StageBladeConfig = {
    topPartId: top,
    bottomPartId: bot,
    topLevel: tl,
    bottomLevel: bl,
    modelId
  }
  if (ability) {
    cfg.isBoss = true
    if (ability !== 'plain') cfg.bossAbility = ability
  }
  return cfg
}

/** `s(id, name, enemyTeam, rewardWin, rewardLose, opts?)` — build a stage. */
const s = (
  id: number,
  name: string,
  enemyTeam: StageBladeConfig[],
  rewardWin: number,
  rewardLose: number,
  opts: { isBoss?: boolean; arenaType?: ArenaType; bouncers?: number } = {}
): Stage => ({ id, name, enemyTeam, rewardWin, rewardLose, ...opts })

// ─── Base 100 Hand-Editable Stages ─────────────────────────────────────────
//
// Pacing:
//   1-5    tutorial / low upgrades   (first boss at 5)
//   6-20   early game                (bosses at 10, 15, 20)
//   21-50  mid game                  (boss every 5)
//   51-80  late game                 (boss every 5)
//   81-100 endgame + showcase bosses (boss every 5, final at 100)
//
// Boss cadence: every 5th stage is a boss. The 20 boss slots cycle through
// five archetypes in order: plain → split → ghost → partners → healers,
// so each ability appears 4 times across 1-100.

const BASE_STAGES: Stage[] = [
  // ── Tutorial Arc (1-5) ────────────────────────────────────────────────────
  s(1, 'Rookie Arena', [
    e('cushioned', 'balanced', 0, 0, 'shell'),
    e('round', 'balanced', 0, 0, 'turtle')
  ], 80, 30),
  s(2, 'Training Grounds', [
    e('quadratic', 'balanced', 0, 0, 'mysticaleye'),
    e('triangle', 'balanced', 0, 0, 'thunder')
  ], 90, 30),
  s(3, 'Iron League', [
    e('triangle', 'speedy', 1, 0, 'eagle'),
    e('round', 'tanky', 0, 1, 'castle')
  ], 100, 35),
  s(4, 'Steel Circuit', [
    e('star', 'balanced', 1, 0, 'phoenix'),
    e('quadratic', 'speedy', 1, 1, 'chip'),
    e('cushioned', 'balanced', 0, 0, 'nature')
  ], 110, 35),
  s(5, 'The Storm Warlord', [
    e('star', 'speedy', 5, 5, 'thunderstorm', 'plain')
  ], 200, 50, { isBoss: true }),

  // ── Early Game (6-20) ─────────────────────────────────────────────────────
  s(6, 'Platinum Ring', [
    e('star', 'speedy', 2, 1, 'scorpion'),
    e('round', 'tanky', 1, 2, 'prisma')
  ], 140, 45),
  s(7, 'Diamond Arena', [
    e('star', 'speedy', 2, 2, 'thunderstorm'),
    e('triangle', 'speedy', 2, 1, 'thunder'),
    e('quadratic', 'balanced', 1, 1, 'mysticaleye')
  ], 160, 50, { bouncers: 1 }),
  s(8, 'Champion\'s Gate', [
    e('star', 'balanced', 3, 2, 'fire'),
    e('cushioned', 'tanky', 2, 3, 'castle')
  ], 180, 55),
  s(9, 'Legend\'s Trial', [
    e('star', 'speedy', 3, 3, 'phoenix'),
    e('quadratic', 'tanky', 3, 3, 'chip'),
    e('triangle', 'balanced', 2, 2, 'eagle')
  ], 200, 60, { arenaType: 'forest' }),
  // 10 — SPLIT boss (archetype 2)
  s(10, 'The Hydra King', [
    e('round', 'tanky', 4, 3, 'turtle', 'split')
  ], 350, 90, { isBoss: true }),
  s(11, 'Shadow Pit', [
    e('triangle', 'speedy', 3, 3, 'bluedragon'),
    e('cushioned', 'tanky', 3, 3, 'shell')
  ], 200, 65),
  s(12, 'Crimson Forge', [
    e('star', 'speedy', 4, 3, 'fire'),
    e('round', 'tanky', 3, 4, 'turtle'),
    e('quadratic', 'balanced', 3, 3, 'mysticaleye')
  ], 210, 65, { arenaType: 'lava', bouncers: 2 }),
  s(13, 'Frost Cavern', [
    e('round', 'tanky', 4, 4, 'ice'),
    e('cushioned', 'balanced', 3, 3, 'nature')
  ], 220, 70, { arenaType: 'ice' }),
  s(14, 'Thunder Peaks', [
    e('star', 'speedy', 4, 4, 'thunder'),
    e('triangle', 'speedy', 4, 3, 'eagle'),
    e('quadratic', 'tanky', 3, 3, 'chip')
  ], 230, 70, { arenaType: 'thunder' }),
  // 15 — GHOST boss (archetype 3)
  s(15, 'The Phantom Twin', [
    e('triangle', 'speedy', 6, 5, 'snake', 'ghost')
  ], 420, 110, { isBoss: true }),
  s(16, 'Obsidian Colosseum', [
    e('star', 'speedy', 5, 4, 'phoenix'),
    e('quadratic', 'tanky', 4, 5, 'castle')
  ], 240, 75, { bouncers: 2 }),
  s(17, 'Volcanic Rift', [
    e('star', 'speedy', 5, 5, 'fire'),
    e('triangle', 'balanced', 5, 4, 'thunderstorm'),
    e('round', 'tanky', 4, 5, 'shell')
  ], 260, 80, { arenaType: 'lava' }),
  s(18, 'Crystal Spire', [
    e('quadratic', 'balanced', 5, 5, 'prisma'),
    e('cushioned', 'tanky', 5, 5, 'nature')
  ], 250, 75, { arenaType: 'ice', bouncers: 2 }),
  s(19, 'Storm Citadel', [
    e('star', 'speedy', 6, 5, 'thunder'),
    e('triangle', 'speedy', 5, 5, 'bluedragon'),
    e('quadratic', 'tanky', 5, 5, 'mysticaleye')
  ], 280, 85, { arenaType: 'thunder' }),
  // 20 — PARTNERS boss (archetype 4)
  s(20, 'The Iron Brotherhood', [
    e('cushioned', 'tanky', 5, 5, 'castle', 'partners'),
    e('round', 'tanky', 5, 5, 'shell', 'partners'),
    e('quadratic', 'balanced', 5, 5, 'mysticaleye', 'partners')
  ], 500, 130, { isBoss: true }),

  // ── Mid Game (21-50) ──────────────────────────────────────────────────────
  s(21, 'Phantom Depths', [
    e('star', 'speedy', 6, 6, 'thunderstorm'),
    e('cushioned', 'tanky', 6, 6, 'turtle')
  ], 300, 90, { arenaType: 'forest' }),
  s(22, 'Abyssal Arena', [
    e('star', 'speedy', 7, 6, 'phoenix'),
    e('triangle', 'speedy', 6, 6, 'eagle'),
    e('round', 'tanky', 6, 7, 'ice')
  ], 320, 95),
  s(23, 'Void Nexus', [
    e('star', 'balanced', 7, 7, 'chip'),
    e('quadratic', 'tanky', 7, 7, 'prisma')
  ], 310, 90),
  s(24, 'Titan\'s Gauntlet', [
    e('star', 'speedy', 7, 7, 'fire'),
    e('triangle', 'speedy', 7, 6, 'snake'),
    e('cushioned', 'tanky', 6, 7, 'wulf')
  ], 340, 100, { bouncers: 1 }),
  // 25 — HEALERS boss (archetype 5)
  s(25, 'The Mending Choir', [
    e('cushioned', 'balanced', 7, 7, 'nature', 'healers'),
    e('round', 'balanced', 7, 7, 'shell', 'healers'),
    e('quadratic', 'balanced', 7, 7, 'mysticaleye', 'healers')
  ], 560, 140, { isBoss: true }),
  s(26, 'Celestial Forge', [
    e('star', 'speedy', 8, 8, 'phoenix'),
    e('quadratic', 'tanky', 8, 8, 'mysticaleye')
  ], 350, 100),
  s(27, 'Infernal Summit', [
    e('star', 'speedy', 8, 8, 'fire'),
    e('triangle', 'speedy', 8, 8, 'thunder'),
    e('cushioned', 'tanky', 8, 8, 'nature')
  ], 380, 110, { arenaType: 'lava', bouncers: 3 }),
  s(28, 'Eternal Vortex', [
    e('star', 'speedy', 9, 8, 'snake'),
    e('round', 'tanky', 8, 9, 'shell')
  ], 370, 105, { arenaType: 'forest', bouncers: 2 }),
  s(29, 'Omega Trials', [
    e('star', 'speedy', 9, 9, 'scorpion'),
    e('triangle', 'speedy', 9, 8, 'eagle'),
    e('quadratic', 'balanced', 8, 9, 'prisma')
  ], 420, 120),
  // 30 — PLAIN boss
  s(30, 'Chaos Incarnate', [
    e('star', 'speedy', 12, 12, 'fire', 'plain')
  ], 800, 200, { isBoss: true }),
  s(31, 'Savage Coliseum', [
    e('triangle', 'speedy', 9, 9, 'thunderstorm'),
    e('quadratic', 'tanky', 9, 9, 'castle')
  ], 430, 125),
  s(32, 'Embercore Pit', [
    e('star', 'speedy', 10, 9, 'fire'),
    e('cushioned', 'tanky', 9, 10, 'wulf'),
    e('round', 'balanced', 9, 9, 'turtle')
  ], 450, 130, { arenaType: 'lava' }),
  s(33, 'Glacier Stadium', [
    e('round', 'tanky', 10, 10, 'ice'),
    e('cushioned', 'balanced', 9, 10, 'nature'),
    e('star', 'speedy', 9, 9, 'phoenix')
  ], 460, 135, { arenaType: 'ice', bouncers: 2 }),
  s(34, 'Arcane Circle', [
    e('quadratic', 'balanced', 10, 10, 'mysticaleye'),
    e('triangle', 'speedy', 10, 9, 'eagle')
  ], 440, 130),
  // 35 — SPLIT boss
  s(35, 'The Shattering Shell', [
    e('round', 'tanky', 12, 10, 'shell', 'split')
  ], 900, 210, { isBoss: true }),
  s(36, 'Ember Arena', [
    e('star', 'speedy', 11, 10, 'thunderstorm'),
    e('triangle', 'speedy', 10, 11, 'bluedragon')
  ], 470, 140, { arenaType: 'lava' }),
  s(37, 'Blizzard Ring', [
    e('round', 'tanky', 11, 11, 'ice'),
    e('quadratic', 'balanced', 11, 10, 'prisma'),
    e('cushioned', 'tanky', 10, 11, 'castle')
  ], 490, 145, { arenaType: 'ice' }),
  s(38, 'Sylvan Grove', [
    e('cushioned', 'balanced', 11, 11, 'nature'),
    e('round', 'balanced', 11, 11, 'turtle')
  ], 480, 140, { arenaType: 'forest', bouncers: 1 }),
  s(39, 'Lightning Coliseum', [
    e('star', 'speedy', 12, 11, 'thunder'),
    e('triangle', 'speedy', 11, 11, 'eagle'),
    e('quadratic', 'tanky', 11, 11, 'chip')
  ], 510, 150, { arenaType: 'thunder' }),
  // 40 — GHOST boss
  s(40, 'The Specter King', [
    e('star', 'speedy', 13, 12, 'phoenix', 'ghost')
  ], 1000, 230, { isBoss: true }),
  s(41, 'Nova Arena', [
    e('star', 'speedy', 12, 12, 'scorpion'),
    e('triangle', 'speedy', 12, 11, 'snake')
  ], 520, 155),
  s(42, 'Magma Caldera', [
    e('star', 'speedy', 13, 12, 'fire'),
    e('cushioned', 'tanky', 12, 13, 'wulf'),
    e('round', 'tanky', 12, 12, 'turtle')
  ], 540, 160, { arenaType: 'lava', bouncers: 3 }),
  s(43, 'Permafrost', [
    e('round', 'tanky', 13, 13, 'ice'),
    e('quadratic', 'balanced', 12, 12, 'mysticaleye')
  ], 530, 155, { arenaType: 'ice' }),
  s(44, 'Ancient Wood', [
    e('cushioned', 'balanced', 13, 12, 'nature'),
    e('triangle', 'speedy', 12, 13, 'bluedragon'),
    e('quadratic', 'tanky', 12, 12, 'prisma')
  ], 550, 165, { arenaType: 'forest' }),
  // 45 — PARTNERS boss
  s(45, 'The Unbroken Trio', [
    e('cushioned', 'tanky', 13, 13, 'castle', 'partners'),
    e('round', 'tanky', 13, 13, 'turtle', 'partners'),
    e('star', 'balanced', 13, 13, 'phoenix', 'partners')
  ], 1100, 250, { isBoss: true }),
  s(46, 'Zenith Arena', [
    e('star', 'speedy', 14, 13, 'thunderstorm'),
    e('triangle', 'speedy', 13, 14, 'eagle')
  ], 560, 170),
  s(47, 'Pyroclast', [
    e('star', 'speedy', 14, 14, 'fire'),
    e('cushioned', 'tanky', 13, 14, 'wulf')
  ], 570, 170, { arenaType: 'lava' }),
  s(48, 'Aurora Ring', [
    e('round', 'tanky', 14, 14, 'ice'),
    e('quadratic', 'balanced', 14, 13, 'prisma'),
    e('star', 'speedy', 13, 14, 'phoenix')
  ], 580, 175, { arenaType: 'ice', bouncers: 3 }),
  s(49, 'Bramble Thicket', [
    e('cushioned', 'balanced', 14, 14, 'nature'),
    e('triangle', 'speedy', 14, 13, 'bluedragon'),
    e('round', 'tanky', 13, 14, 'shell')
  ], 590, 175, { arenaType: 'forest' }),
  // 50 — HEALERS boss
  s(50, 'The Eternal Grove', [
    e('cushioned', 'balanced', 14, 14, 'nature', 'healers'),
    e('round', 'balanced', 14, 14, 'turtle', 'healers'),
    e('cushioned', 'balanced', 14, 14, 'shell', 'healers'),
    e('quadratic', 'balanced', 14, 14, 'mysticaleye', 'healers')
  ], 1300, 280, { isBoss: true }),

  // ── Late Game (51-80) ─────────────────────────────────────────────────────
  s(51, 'Meteor Circuit', [
    e('star', 'speedy', 15, 14, 'thunderstorm'),
    e('quadratic', 'tanky', 14, 15, 'chip')
  ], 600, 180),
  s(52, 'Inferno Chasm', [
    e('star', 'speedy', 15, 15, 'fire'),
    e('triangle', 'speedy', 15, 14, 'snake'),
    e('cushioned', 'tanky', 14, 15, 'castle')
  ], 620, 185, { arenaType: 'lava' }),
  s(53, 'Glacial Throne', [
    e('round', 'tanky', 15, 15, 'ice'),
    e('quadratic', 'balanced', 15, 15, 'prisma')
  ], 610, 180, { arenaType: 'ice' }),
  s(54, 'Storm Monolith', [
    e('star', 'speedy', 16, 15, 'thunder'),
    e('triangle', 'speedy', 15, 16, 'eagle'),
    e('quadratic', 'tanky', 15, 15, 'mysticaleye')
  ], 640, 190, { arenaType: 'thunder' }),
  // 55 — PLAIN boss
  s(55, 'The Dread Scorpion', [
    e('piercer', 'speedy', 16, 16, 'scorpion', 'plain')
  ], 1200, 260, { isBoss: true }),
  s(56, 'Verdant Hollow', [
    e('cushioned', 'balanced', 16, 15, 'nature'),
    e('round', 'tanky', 15, 16, 'turtle'),
    e('triangle', 'speedy', 15, 15, 'bluedragon')
  ], 650, 195, { arenaType: 'forest' }),
  s(57, 'Sunforge', [
    e('star', 'speedy', 16, 16, 'phoenix'),
    e('quadratic', 'tanky', 16, 16, 'chip')
  ], 660, 200, { arenaType: 'lava' }),
  s(58, 'Frostfall Rink', [
    e('round', 'tanky', 16, 16, 'ice'),
    e('cushioned', 'balanced', 16, 16, 'shell'),
    e('star', 'speedy', 15, 16, 'thunderstorm')
  ], 670, 200, { arenaType: 'ice', bouncers: 2 }),
  s(59, 'Voltage Arena', [
    e('star', 'speedy', 17, 16, 'thunder'),
    e('triangle', 'speedy', 16, 17, 'eagle')
  ], 680, 205, { arenaType: 'thunder' }),
  // 60 — SPLIT boss
  s(60, 'The Swarm Hive', [
    e('quadratic', 'tanky', 18, 17, 'mysticaleye', 'split')
  ], 1350, 290, { isBoss: true }),
  s(61, 'Obsidian Pit', [
    e('star', 'speedy', 17, 17, 'scorpion'),
    e('triangle', 'speedy', 17, 17, 'snake'),
    e('cushioned', 'tanky', 17, 17, 'wulf')
  ], 690, 210),
  s(62, 'Charcoal Arena', [
    e('star', 'speedy', 18, 17, 'fire'),
    e('round', 'tanky', 17, 18, 'castle')
  ], 700, 210, { arenaType: 'lava' }),
  s(63, 'Crystal Vault', [
    e('quadratic', 'balanced', 18, 18, 'prisma'),
    e('round', 'tanky', 18, 18, 'ice'),
    e('cushioned', 'balanced', 17, 17, 'nature')
  ], 720, 215, { arenaType: 'ice' }),
  s(64, 'Tempest Crest', [
    e('star', 'speedy', 18, 18, 'thunder'),
    e('triangle', 'speedy', 18, 17, 'bluedragon')
  ], 730, 220, { arenaType: 'thunder' }),
  // 65 — GHOST boss
  s(65, 'The Twin Eclipse', [
    e('star', 'speedy', 19, 18, 'phoenix', 'ghost')
  ], 1500, 310, { isBoss: true }),
  s(66, 'Mirror Arena', [
    e('star', 'speedy', 19, 18, 'thunderstorm'),
    e('quadratic', 'tanky', 18, 19, 'chip'),
    e('triangle', 'speedy', 18, 18, 'eagle')
  ], 740, 225),
  s(67, 'Cinder Throne', [
    e('star', 'speedy', 19, 19, 'fire'),
    e('cushioned', 'tanky', 19, 19, 'castle')
  ], 750, 225, { arenaType: 'lava' }),
  s(68, 'Frozen Heart', [
    e('round', 'tanky', 19, 19, 'ice'),
    e('cushioned', 'balanced', 19, 18, 'nature'),
    e('star', 'speedy', 18, 19, 'phoenix')
  ], 760, 230, { arenaType: 'ice' }),
  s(69, 'Ancient Canopy', [
    e('cushioned', 'balanced', 19, 19, 'nature'),
    e('triangle', 'speedy', 19, 19, 'bluedragon'),
    e('round', 'tanky', 19, 19, 'turtle')
  ], 770, 230, { arenaType: 'forest' }),
  // 70 — PARTNERS boss
  s(70, 'The Quartet of Fate', [
    e('star', 'balanced', 18, 18, 'phoenix', 'partners'),
    e('triangle', 'balanced', 18, 18, 'thunder', 'partners'),
    e('quadratic', 'balanced', 18, 18, 'chip', 'partners'),
    e('cushioned', 'balanced', 18, 18, 'wulf', 'partners')
  ], 1700, 340, { isBoss: true }),
  s(71, 'Diamond Apex', [
    e('star', 'speedy', 20, 19, 'scorpion'),
    e('triangle', 'speedy', 19, 20, 'snake')
  ], 780, 235),
  s(72, 'Magma Spire', [
    e('star', 'speedy', 20, 20, 'fire'),
    e('cushioned', 'tanky', 19, 20, 'wulf'),
    e('round', 'balanced', 19, 19, 'turtle')
  ], 800, 240, { arenaType: 'lava' }),
  s(73, 'Polar Apex', [
    e('round', 'tanky', 20, 20, 'ice'),
    e('quadratic', 'balanced', 20, 19, 'prisma')
  ], 810, 245, { arenaType: 'ice' }),
  s(74, 'Emerald Dome', [
    e('cushioned', 'balanced', 20, 20, 'nature'),
    e('triangle', 'speedy', 20, 19, 'eagle'),
    e('star', 'speedy', 19, 20, 'phoenix')
  ], 820, 245, { arenaType: 'forest', bouncers: 3 }),
  // 75 — HEALERS boss
  s(75, 'The Hallowed Circle', [
    e('cushioned', 'balanced', 20, 20, 'nature', 'healers'),
    e('round', 'balanced', 20, 20, 'shell', 'healers'),
    e('cushioned', 'balanced', 20, 20, 'wulf', 'healers'),
    e('quadratic', 'balanced', 20, 20, 'mysticaleye', 'healers')
  ], 1900, 380, { isBoss: true }),
  s(76, 'Thunder Bowl', [
    e('star', 'speedy', 21, 20, 'thunder'),
    e('triangle', 'speedy', 20, 21, 'bluedragon'),
    e('quadratic', 'tanky', 20, 20, 'chip')
  ], 830, 250, { arenaType: 'thunder' }),
  s(77, 'Scorched Rift', [
    e('star', 'speedy', 21, 21, 'fire'),
    e('piercer', 'speedy', 20, 21, 'scorpion')
  ], 840, 250, { arenaType: 'lava' }),
  s(78, 'Iceblade Ring', [
    e('round', 'tanky', 21, 21, 'ice'),
    e('cushioned', 'balanced', 21, 21, 'shell')
  ], 850, 255, { arenaType: 'ice' }),
  s(79, 'Storm Nexus', [
    e('star', 'speedy', 22, 21, 'thunderstorm'),
    e('triangle', 'speedy', 21, 22, 'eagle'),
    e('quadratic', 'tanky', 21, 21, 'mysticaleye')
  ], 870, 260, { arenaType: 'thunder' }),
  // 80 — PLAIN boss
  s(80, 'The Molten Titan', [
    e('cushioned', 'tanky', 24, 22, 'castle', 'plain')
  ], 1800, 360, { isBoss: true, arenaType: 'lava' }),

  // ── Endgame Showcase (81-100) ─────────────────────────────────────────────
  s(81, 'Abyss Ring', [
    e('piercer', 'speedy', 22, 22, 'scorpion'),
    e('triangle', 'speedy', 22, 21, 'snake'),
    e('star', 'speedy', 21, 22, 'phoenix')
  ], 880, 265),
  s(82, 'Obsidian Crown', [
    e('star', 'speedy', 22, 22, 'fire'),
    e('cushioned', 'tanky', 22, 22, 'wulf'),
    e('quadratic', 'balanced', 22, 22, 'chip')
  ], 900, 270, { arenaType: 'lava' }),
  s(83, 'Glacier Apex', [
    e('round', 'tanky', 23, 22, 'ice'),
    e('quadratic', 'balanced', 22, 23, 'prisma'),
    e('cushioned', 'balanced', 22, 22, 'nature')
  ], 910, 270, { arenaType: 'ice' }),
  s(84, 'Wildwood Arena', [
    e('cushioned', 'balanced', 23, 23, 'nature'),
    e('round', 'tanky', 22, 23, 'turtle'),
    e('triangle', 'speedy', 23, 22, 'bluedragon')
  ], 920, 275, { arenaType: 'forest' }),
  // 85 — SPLIT boss
  s(85, 'The Riftborn', [
    e('star', 'balanced', 26, 24, 'thunderstorm', 'split')
  ], 2100, 400, { isBoss: true }),
  s(86, 'Solar Forge', [
    e('star', 'speedy', 23, 23, 'phoenix'),
    e('quadratic', 'tanky', 23, 23, 'castle')
  ], 930, 280, { arenaType: 'lava' }),
  s(87, 'Frostbite Arena', [
    e('round', 'tanky', 24, 23, 'ice'),
    e('cushioned', 'balanced', 23, 24, 'shell'),
    e('star', 'speedy', 23, 23, 'thunderstorm')
  ], 950, 285, { arenaType: 'ice' }),
  s(88, 'Darkwood Hollow', [
    e('cushioned', 'balanced', 24, 24, 'nature'),
    e('triangle', 'speedy', 24, 23, 'eagle'),
    e('round', 'tanky', 23, 24, 'turtle'),
    e('quadratic', 'tanky', 23, 23, 'mysticaleye')
  ], 970, 290, { arenaType: 'forest' }),
  s(89, 'Stormborn Arena', [
    e('star', 'speedy', 25, 24, 'thunder'),
    e('triangle', 'speedy', 24, 25, 'bluedragon'),
    e('quadratic', 'tanky', 24, 24, 'chip')
  ], 990, 295, { arenaType: 'thunder' }),
  // 90 — GHOST boss
  s(90, 'The Wraith Sovereign', [
    e('star', 'speedy', 28, 26, 'phoenix', 'ghost')
  ], 2400, 440, { isBoss: true }),
  s(91, 'Apex Arena', [
    e('star', 'speedy', 25, 25, 'scorpion'),
    e('piercer', 'speedy', 25, 24, 'snake'),
    e('triangle', 'speedy', 24, 25, 'eagle')
  ], 1000, 300, { bouncers: 3 }),
  s(92, 'Infernal Throne', [
    e('star', 'speedy', 26, 25, 'fire'),
    e('cushioned', 'tanky', 25, 26, 'castle'),
    e('round', 'tanky', 25, 25, 'turtle')
  ], 1020, 305, { arenaType: 'lava' }),
  s(93, 'Eternal Winter', [
    e('round', 'tanky', 26, 26, 'ice'),
    e('cushioned', 'balanced', 26, 25, 'nature'),
    e('star', 'speedy', 25, 26, 'phoenix')
  ], 1040, 310, { arenaType: 'ice' }),
  s(94, 'World Tree', [
    e('cushioned', 'balanced', 26, 26, 'nature'),
    e('triangle', 'speedy', 26, 25, 'bluedragon'),
    e('quadratic', 'balanced', 25, 26, 'mysticaleye'),
    e('round', 'tanky', 25, 25, 'shell')
  ], 1060, 315, { arenaType: 'forest' }),
  // 95 — PARTNERS boss
  s(95, 'The Final Guard', [
    e('cushioned', 'tanky', 26, 25, 'castle', 'partners'),
    e('round', 'tanky', 26, 25, 'shell', 'partners'),
    e('star', 'balanced', 26, 25, 'phoenix', 'partners'),
    e('quadratic', 'balanced', 26, 25, 'mysticaleye', 'partners')
  ], 2700, 480, { isBoss: true }),
  s(96, 'Void Summit', [
    e('star', 'speedy', 27, 26, 'thunderstorm'),
    e('triangle', 'speedy', 27, 26, 'snake'),
    e('cushioned', 'tanky', 26, 27, 'wulf')
  ], 1080, 320),
  s(97, 'Ember Citadel', [
    e('star', 'speedy', 27, 27, 'fire'),
    e('piercer', 'speedy', 26, 27, 'scorpion'),
    e('quadratic', 'tanky', 27, 26, 'chip')
  ], 1100, 325, { arenaType: 'lava' }),
  s(98, 'Astral Arena', [
    e('star', 'speedy', 28, 27, 'phoenix'),
    e('quadratic', 'balanced', 27, 28, 'prisma'),
    e('triangle', 'speedy', 27, 27, 'eagle')
  ], 1120, 330),
  s(99, 'Omega Gauntlet', [
    e('star', 'speedy', 28, 28, 'thunder'),
    e('triangle', 'speedy', 28, 27, 'thunderstorm'),
    e('quadratic', 'tanky', 27, 28, 'castle'),
    e('cushioned', 'balanced', 27, 27, 'nature')
  ], 1150, 340, { arenaType: 'thunder' }),
  // 100 — HEALERS boss (grand finale)
  s(100, 'The Everlasting Choir', [
    e('cushioned', 'balanced', 30, 30, 'nature', 'healers'),
    e('round', 'balanced', 30, 30, 'shell', 'healers'),
    e('cushioned', 'balanced', 30, 30, 'wulf', 'healers'),
    e('round', 'balanced', 30, 30, 'turtle', 'healers'),
    e('quadratic', 'balanced', 30, 30, 'mysticaleye', 'healers')
  ], 3500, 600, { isBoss: true })
]

// ─── Infinite Campaign (stages 101 and beyond) ──────────────────────────────
// After the 100 hand-crafted stages, the campaign loops back to stage 1
// indefinitely. Each "cycle" past the first bumps enemy part levels and
// multiplies rewards so progression stays meaningful without requiring
// more hand-written entries. Stages 101-200 are cycle 1, 201-300 cycle 2,
// and so on forever.

export const BASE_CAMPAIGN_LENGTH = BASE_STAGES.length

// Roman-numeral suffix for cycle > 0 (purely cosmetic name differentiation).
const CYCLE_SUFFIX = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const cycleSuffix = (cycle: number): string =>
  cycle <= 0 ? '' : (CYCLE_SUFFIX[cycle] ?? `x${cycle + 1}`)

/**
 * Scaling curves — applied on top of a base stage for cycle `c` ≥ 1.
 *   levels   → +10 per cycle so enemies stay roughly in lockstep with a
 *              player who's been upgrading their own parts.
 *   rewards  → +35% per cycle (linear). Intentionally slower than the
 *              cycle's upgrade-cost growth (which is quadratic via the
 *              L>10 term in upgradeCost), so every loop tightens the
 *              economy and makes rewarded-ad tops-up genuinely useful.
 */
const cycleLevelBonus = (cycle: number) => cycle * 10
const cycleRewardMul = (cycle: number) => 1 + cycle * 0.35

// ── Mid-game reward trim ──────────────────────────────────────────────────
// Stages 20–100 run on trimmed win rewards so the player keeps bumping
// into "I need ~100 more coins" moments roughly every few stages — exactly
// the pressure point where a rewarded video (+100) or the 10-min chest
// (+100) unlocks the next upgrade tier. Bosses get a softer trim so their
// milestone payouts still feel like a reward spike.
const MID_TRIM_START = 20
const MID_TRIM_END = 100
const MID_TRIM_REG = 0.55
const MID_TRIM_BOSS = 0.75

const tightenMidGame = (stage: Stage): Stage => {
  // NOTE: id here is the BASE-stage id (1..100), so the trim band applies
  // to the same "slot" of every cycle — the mid-game tightness is a
  // permanent spine of the campaign, not just a one-time cycle-1 quirk.
  if (stage.id < MID_TRIM_START || stage.id > MID_TRIM_END) return stage
  const mul = stage.isBoss ? MID_TRIM_BOSS : MID_TRIM_REG
  return { ...stage, rewardWin: Math.round(stage.rewardWin * mul) }
}

/** Produce a scaled copy of a base stage for an arbitrary later cycle. */
const scaleStage = (base: Stage, targetId: number, cycle: number): Stage => {
  if (cycle <= 0) return { ...base, id: targetId }
  const lvlBonus = cycleLevelBonus(cycle)
  const rewardMul = cycleRewardMul(cycle)
  const suffix = cycleSuffix(cycle)
  return {
    ...base,
    id: targetId,
    name: suffix ? `${base.name} ${suffix}` : base.name,
    enemyTeam: base.enemyTeam.map(cfg => ({
      ...cfg,
      topLevel: cfg.topLevel + lvlBonus,
      bottomLevel: cfg.bottomLevel + lvlBonus
    })),
    rewardWin: Math.round(base.rewardWin * rewardMul),
    rewardLose: Math.round(base.rewardLose * rewardMul)
  }
}

/**
 * Look up the stage for any 1-based id. There is no upper bound — stages
 * past 100 auto-generate from the base 100 with ever-increasing difficulty.
 */
export const getStageById = (id: number): Stage => {
  if (id < 1) return tightenMidGame({ ...BASE_STAGES[0]!, id: 1 })
  const cycle = Math.floor((id - 1) / BASE_CAMPAIGN_LENGTH)
  const baseIdx = (id - 1) % BASE_CAMPAIGN_LENGTH
  // Trim BEFORE cycle scaling so the cycle reward multiplier compounds
  // on top of the already-tightened base — the mid-game squeeze persists
  // (and grows relatively tighter) in every cycle.
  const base = tightenMidGame(BASE_STAGES[baseIdx]!)
  return scaleStage(base, id, cycle)
}

/**
 * Legacy `STAGES` export — the campaign is now infinite, but some existing
 * consumers (cheats, leaderboard tick logic, etc.) still expect an array
 * they can index or iterate. We materialize the first two cycles (200
 * stages) so iteration-based code keeps working; use `getStageById(id)`
 * for arbitrary lookups beyond that.
 */
export const STAGES: Stage[] = Array.from(
  { length: BASE_CAMPAIGN_LENGTH * 2 },
  (_, i) => getStageById(i + 1)
)

// ─── Upgrade Definitions ────────────────────────────────────────────────────

/** Per-level bonus for each top part (leans into the part's identity) */
export const TOP_UPGRADE_BONUS: Record<TopPartId, { damage: number; defense: number; hp: number }> = {
  star: { damage: 0.12, defense: 0.03, hp: 1 },  // glass cannon
  triangle: { damage: 0.08, defense: 0.05, hp: 2 },  // aggressive balanced
  round: { damage: 0.04, defense: 0.08, hp: 4 },  // defensive
  quadratic: { damage: 0.06, defense: 0.06, hp: 3 },  // true balanced
  cushioned: { damage: 0.03, defense: 0.10, hp: 5 },  // pure tank
  piercer: { damage: 0.11, defense: 0.03, hp: 1 }    // tank piercer
}

/** Per-level bonus for each bottom part */
export const BOTTOM_UPGRADE_BONUS: Record<BottomPartId, { speed: number; decay: number; hp: number }> = {
  speedy: { speed: 0.06, decay: 0.00015, hp: 1 },  // leans into speed
  tanky: { speed: 0.02, decay: 0.00020, hp: 4 },  // leans into survival
  balanced: { speed: 0.04, decay: 0.00018, hp: 2 }   // balanced
}

/** Cost for upgrading to a given level. Linear base of 100 + (level-1)*20
 *  plus a quadratic "mid/late game" term that kicks in past level 10 so
 *  the upgrade economy tightens as enemies reach high levels — keeping
 *  stage rewards meaningful and ad-pressure present all the way through.
 *
 *  Curve:
 *    L<=10  → unchanged from the old linear formula (forgiving early game)
 *    L>10   → extra 3*(L-10)² coins per level
 *    e.g. L=15: +75, L=20: +300, L=25: +675, L=30: +1200
 */
export const upgradeCost = (toLevel: number): number => {
  const extra = toLevel > 10 ? 3 * (toLevel - 10) * (toLevel - 10) : 0
  return 100 + (toLevel - 1) * 20 + extra
}

// ─── Persistence ────────────────────────────────────────────────────────────

const STAGE_KEY = 'bayblade_campaign_stage'
const UPGRADES_KEY = 'bayblade_upgrades'

export interface PlayerUpgrades {
  tops: Record<TopPartId, number>
  bottoms: Record<BottomPartId, number>
}

const DEFAULT_UPGRADES: PlayerUpgrades = {
  tops: { star: 0, triangle: 0, round: 0, quadratic: 0, cushioned: 0, piercer: 0 },
  bottoms: { speedy: 0, tanky: 0, balanced: 0 }
}

const loadStage = (): number => {
  try {
    const raw = localStorage.getItem(STAGE_KEY)
    if (raw) {
      const n = parseInt(raw, 10)
      // No upper bound — the campaign is infinite. Any stored positive
      // integer is valid and maps to a cycle via getStageById.
      if (n >= 1) return n
    }
  } catch { /* fall through */
  }
  return 1
}

const loadUpgrades = (): PlayerUpgrades => {
  try {
    const raw = localStorage.getItem(UPGRADES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.tops && parsed?.bottoms) return {
        tops: { ...DEFAULT_UPGRADES.tops, ...parsed.tops },
        bottoms: { ...DEFAULT_UPGRADES.bottoms, ...parsed.bottoms }
      }
    }
  } catch { /* fall through */
  }
  return JSON.parse(JSON.stringify(DEFAULT_UPGRADES))
}

// ─── Singleton State ────────────────────────────────────────────────────────

const currentStageId: Ref<number> = ref(loadStage())
const playerUpgrades: Ref<PlayerUpgrades> = ref(loadUpgrades())

// ─── Cheat Stage Override ───────────────────────────────────────────────────
// Cheats (see useCheats.ts) may inject a one-shot custom stage — typically
// to demo a specific boss ability scaled to the player's current upgrades.
// When set, `currentStage` returns this stage instead of the campaign one,
// and `stageReinitSignal` is bumped so any active BaybladeArena view re-runs
// initGame with the new enemy team.
const cheatStage: Ref<Stage | null> = ref(null)
const stageReinitSignal: Ref<number> = ref(0)

// ─── Derived ────────────────────────────────────────────────────────────────

const currentStage = computed(() => cheatStage.value ?? getStageById(currentStageId.value))

// Campaign is now infinite — there is no "last" stage. Kept as a computed
// that's always false so existing consumers compile unchanged.
const isLastStage = computed(() => false)

// ─── Actions ────────────────────────────────────────────────────────────────

const saveState = () => {
  localStorage.setItem(STAGE_KEY, currentStageId.value.toString())
  localStorage.setItem(UPGRADES_KEY, JSON.stringify(playerUpgrades.value))
}

const advanceStage = () => {
  // Infinite campaign — always advance.
  currentStageId.value++
  saveState()
}

const upgradeTop = (partId: TopPartId): boolean => {
  const current = playerUpgrades.value.tops[partId]
  const cost = upgradeCost(current + 1)
  // Caller is responsible for checking coins — return false if level is already maxed
  playerUpgrades.value = {
    ...playerUpgrades.value,
    tops: { ...playerUpgrades.value.tops, [partId]: current + 1 }
  }
  saveState()
  return true
}

const upgradeBottom = (partId: BottomPartId): boolean => {
  const current = playerUpgrades.value.bottoms[partId]
  const cost = upgradeCost(current + 1)
  playerUpgrades.value = {
    ...playerUpgrades.value,
    bottoms: { ...playerUpgrades.value.bottoms, [partId]: current + 1 }
  }
  saveState()
  return true
}

// ─── Cheat Stage Builder ────────────────────────────────────────────────────

/**
 * Build a boss-showcase stage scaled to the player's current upgrade levels,
 * for a specific `ability`. The enemy team roster is chosen to highlight
 * each ability's mechanic:
 *
 *   ghost    → single ghost boss (splits on launch)
 *   split    → single split boss (shatters into 5 on death)
 *   partners → 3-blade partner team (no FF between them)
 *   healers  → 4-blade healer team (no FF + heal-on-contact, 20% oversize)
 *
 * Each enemy blade's part levels are matched to the player's corresponding
 * upgrade level so the fight is fair regardless of progression.
 */
export const buildCheatBossStage = (ability: BossAbility): Stage => {
  const tops = playerUpgrades.value.tops
  const bots = playerUpgrades.value.bottoms
  // Level used for parts the player hasn't upgraded on their own team —
  // falls back to the player's peak level so the boss stays threatening.
  const peakTop = Math.max(0, ...Object.values(tops))
  const peakBot = Math.max(0, ...Object.values(bots))
  const t = (id: TopPartId) => Math.max(tops[id] ?? 0, peakTop)
  const b = (id: BottomPartId) => Math.max(bots[id] ?? 0, peakBot)

  let name = 'Cheat Boss'
  let enemyTeam: StageBladeConfig[] = []

  switch (ability) {
    case 'ghost':
      name = '[Cheat] Phantom Twin'
      enemyTeam = [
        e('triangle', 'speedy', t('triangle'), b('speedy'), 'snake', 'ghost')
      ]
      break
    case 'split':
      name = '[Cheat] Shattering Shell'
      enemyTeam = [
        e('round', 'tanky', t('round'), b('tanky'), 'shell', 'split')
      ]
      break
    case 'partners':
      name = '[Cheat] Iron Brotherhood'
      enemyTeam = [
        e('cushioned', 'tanky', t('cushioned'), b('tanky'), 'castle', 'partners'),
        e('round', 'tanky', t('round'), b('tanky'), 'turtle', 'partners'),
        e('quadratic', 'balanced', t('quadratic'), b('balanced'), 'mysticaleye', 'partners')
      ]
      break
    case 'healers':
      name = '[Cheat] Mending Choir'
      enemyTeam = [
        e('cushioned', 'balanced', t('cushioned'), b('balanced'), 'nature', 'healers'),
        e('round', 'balanced', t('round'), b('balanced'), 'shell', 'healers'),
        e('cushioned', 'balanced', t('cushioned'), b('balanced'), 'wulf', 'healers'),
        e('quadratic', 'balanced', t('quadratic'), b('balanced'), 'mysticaleye', 'healers')
      ]
      break
  }

  return {
    id: -1, // sentinel — cheat stages never persist or advance
    name,
    isBoss: true,
    enemyTeam,
    // Rough mid-campaign reward band — not meaningful, just non-zero.
    rewardWin: 500,
    rewardLose: 100
  }
}

/**
 * Activate a cheat stage and kick any active arena view to re-init its
 * game loop. Pass `null` to clear the override and return to the regular
 * campaign stage.
 */
export const loadCheatStage = (stage: Stage | null) => {
  cheatStage.value = stage
  stageReinitSignal.value++
}

// ─── Public API ─────────────────────────────────────────────────────────────

const useBaybladeCampaign = () => ({
  currentStageId,
  currentStage,
  isLastStage,
  playerUpgrades,
  stageReinitSignal,
  cheatStage,
  advanceStage,
  upgradeTop,
  upgradeBottom,
  upgradeCost,
  buildCheatBossStage,
  loadCheatStage
})

export default useBaybladeCampaign
