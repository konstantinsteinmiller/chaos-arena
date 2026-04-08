import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type {
  BaybladeState,
  BaybladeConfig,
  BaybladeStats,
  GamePhase,
  GameResult,
  MeteorParticle,
  SpritesheetAnimation
} from '@/types/bayblade'
import type { ArenaType } from '@/use/useBaybladeCampaign'
import { computeStats } from '@/use/useBaybladeConfig'
import { baybladeModelImgPath } from '@/use/useModels'
import type { TopPartId } from '@/types/bayblade'
import { isDebug } from '@/use/useMatch.ts'
import { isMobileLandscape, isMobilePortrait } from '@/use/useUser.ts'
import { useScreenshake } from '@/use/useScreenshake'
import useSounds from '@/use/useSound'
import { prependBaseUrl } from '@/utils/function.ts'

const { triggerShake } = useScreenshake()
const { playSound } = useSounds()

// ─── Physics Constants ───────────────────────────────────────────────────────

export const ARENA_RADIUS = 200
const isDesktop = window.innerWidth > 600 && window.innerHeight > 600 && !isMobilePortrait.value && !isMobileLandscape.value
export const BLADE_RADIUS = isDesktop ? 26 : 28
const BASE_MAX_FORCE = 14
const STOP_THRESHOLD = 0.25
const DAMAGE_SCALE = isDebug.value ? 10 : 1
const HIT_FLASH_FRAMES = 50
const NPC_THINK_MS = 500
const BOUNCE_DAMPENING = 0.75
// Wall bounces BOOST speed instead of dampening — ricochet strategy
const WALL_BOOST_FACTOR = 1.08
// Bounce decay: reduce wall boost by 12% per bounce after the first, min 30% effectiveness
const WALL_BOUNCE_DECAY_PER_HIT = 0.12
const WALL_BOUNCE_MIN_EFFECTIVENESS = 0.30
// Extra padding around the arena so drags near the edge have room
const ARENA_PADDING = 5
// Blade needs time to reach full speed after launch
const ACCEL_FRAMES = 28
// Long pull distance — enables wild mega-pulls that risk hitting own team
const MAX_PULL_RATIO = 0.85

export const MAX_PULL_DISTANCE = ARENA_RADIUS * MAX_PULL_RATIO

// Spark VFX
const SPARK_FRAME_DURATION = 40 // ms per frame
const SPARK_TOTAL_FRAMES = 5
const SPARK_COOLDOWN_MS = 200
const CLASH_SOUND_COOLDOWN_MS = 300
const SPARK_SCALE = 0.28 // scale in game-space units relative to frameWidth

// ─── Spritesheet Helpers ────────────────────────────────────────────────────

function preloadImage(src: string): HTMLImageElement {
  const img = new Image()
  img.src = src
  return img
}

function createSpritesheetAnim(
  image: HTMLImageElement,
  x: number, y: number,
  totalFrames: number,
  frameDuration: number,
  frameWidth: number,
  frameHeight: number,
  scale: number,
  vertical: boolean
): SpritesheetAnimation {
  return { x, y, frame: 0, timer: 0, frameDuration, totalFrames, frameWidth, frameHeight, scale, vertical, image }
}

function updateSpritesheetAnim(anim: SpritesheetAnimation, dt: number): boolean {
  anim.timer += dt
  if (anim.timer >= anim.frameDuration) {
    anim.timer -= anim.frameDuration
    anim.frame++
  }
  return anim.frame >= anim.totalFrames
}

function renderSpritesheetAnim(ctx: CanvasRenderingContext2D, anim: SpritesheetAnimation) {
  if (anim.frame >= anim.totalFrames || !anim.image.complete || anim.image.naturalWidth === 0) return
  const { frameWidth, frameHeight, vertical, frame, scale, x, y, image } = anim
  const sx = vertical ? 0 : frame * frameWidth
  const sy = vertical ? frame * frameHeight : 0
  const drawW = frameWidth * scale
  const drawH = frameHeight * scale
  ctx.drawImage(image, sx, sy, frameWidth, frameHeight, x - drawW / 2, y - drawH / 2, drawW, drawH)
}

// ─── Shared Arena State (singleton so cheats can access it) ─────────────────

const arenaType: Ref<ArenaType> = ref('default')
export { arenaType }

// ─── Simulation Speed (visual speed-up only) ────────────────────────────────

// Module-level so the speed setting persists across composable instances and
// can be controlled from anywhere in the UI. Damage is unaffected: we simply
// run the deterministic physics step N times per rendered frame.
export const simSpeed: Ref<1 | 2> = ref(1)

// ─── Game-Start Countdown ────────────────────────────────────────────────────

// Counts how many matches the player has started. Every Nth start triggers a
// "3, 2, 1, GO" countdown rendered inside the meteor shower ring.
const GAME_START_COUNT_KEY = 'bayblade_game_start_count'
const COUNTDOWN_EVERY_N_GAMES = 5
const COUNTDOWN_STEP_MS = 375
const COUNTDOWN_SEQUENCE = ['3', '2', '1', 'GO'] as const

export const gameStartCount: Ref<number> = ref(
  parseInt(localStorage.getItem(GAME_START_COUNT_KEY) || '0', 10)
)
export const countdownText: Ref<string | null> = ref(null)

const countdownTimers: number[] = []
const clearCountdown = () => {
  while (countdownTimers.length) {
    const id = countdownTimers.pop()
    if (id !== undefined) clearTimeout(id)
  }
  countdownText.value = null
}

const triggerCountdown = () => {
  clearCountdown()
  COUNTDOWN_SEQUENCE.forEach((text, i) => {
    countdownTimers.push(window.setTimeout(() => {
      countdownText.value = text
    }, i * COUNTDOWN_STEP_MS))
  })
  countdownTimers.push(window.setTimeout(() => {
    countdownText.value = null
  }, COUNTDOWN_SEQUENCE.length * COUNTDOWN_STEP_MS))
}

/** Cheat helper: arm the next match start to fire the countdown. We set the
 *  counter so the next `startMatch()` increment lands on a multiple of
 *  COUNTDOWN_EVERY_N_GAMES and triggers the countdown immediately. */
export const resetGameStartCount = () => {
  const armed = COUNTDOWN_EVERY_N_GAMES - 1
  gameStartCount.value = armed
  localStorage.setItem(GAME_START_COUNT_KEY, String(armed))
}

// ─── Persistent Cross-Match State ────────────────────────────────────────────

// Tracks the result of the last finished match so we can bias the next match's
// turn order toward whichever side gives the player a better experience.
const LAST_RESULT_KEY = 'bayblade_last_result'
const loadLastResult = (): GameResult => {
  const raw = localStorage.getItem(LAST_RESULT_KEY)
  return raw === 'win' || raw === 'lose' ? raw : null
}
const lastGameResult: Ref<GameResult> = ref(loadLastResult())
const saveLastGameResult = (result: GameResult) => {
  lastGameResult.value = result
  if (result) localStorage.setItem(LAST_RESULT_KEY, result)
  else localStorage.removeItem(LAST_RESULT_KEY)
}

// ─── Composable ──────────────────────────────────────────────────────────────

export const useBaybladeGame = () => {
  // ── Game Phase ───────────────────────────────────────────────────────────
  const phase: Ref<GamePhase> = ref('idle')
  const gameResult: Ref<GameResult> = ref(null)
  const turnAnnouncement: Ref<string> = ref('')
  const isBossStage: Ref<boolean> = ref(false)

  // ── Blade Arrays (2 per side) ────────────────────────────────────────────
  const playerBlades: Ref<BaybladeState[]> = ref([])
  const npcBlades: Ref<BaybladeState[]> = ref([])

  // All models in one flat array for physics iteration
  const allBlades = computed<BaybladeState[]>(() =>
    [...playerBlades.value, ...npcBlades.value]
  )

  // ── Selected Blade (player picks which to launch) ────────────────────────
  const selectedBladeId: Ref<number | null> = ref(null)
  // The blade the NPC chose this turn
  const npcActiveBladeId: Ref<number | null> = ref(null)
  // ID of the blade currently in motion (tracks whose turn just ended)
  const launchedBladeId: Ref<number | null> = ref(null)

  const selectedBlade = computed<BaybladeState | null>(() =>
    playerBlades.value.find(b => b.id === selectedBladeId.value && b.hp > 0) ?? null
  )

  // ── Drag State ───────────────────────────────────────────────────────────
  const isDragging: Ref<boolean> = ref(false)
  const dragStart: Ref<{ x: number; y: number }> = ref({ x: 0, y: 0 })
  const dragCurrent: Ref<{ x: number; y: number }> = ref({ x: 0, y: 0 })
  // Last valid drag direction (normalized) — used when pointer leaves viewport
  let lastDragNx = 0
  let lastDragNy = 0

  const dragVector = computed(() => ({
    dx: dragCurrent.value.x - dragStart.value.x,
    dy: dragCurrent.value.y - dragStart.value.y
  }))

  const dragMagnitude = computed(() => {
    const { dx, dy } = dragVector.value
    return Math.sqrt(dx * dx + dy * dy)
  })

  const dragForceRatio = computed(() =>
    Math.min(dragMagnitude.value / MAX_PULL_DISTANCE, 1)
  )

  // ── NPC Timer ────────────────────────────────────────────────────────────
  let npcThinkingElapsed = 0

  // ── Meteor Shower Particles ──────────────────────────────────────────────
  const meteorParticles: Ref<MeteorParticle[]> = ref([])
  let meteorIntroTimer = 0

  // ── Animation Frame ──────────────────────────────────────────────────────
  let physicsRafId: number | null = null

  // ── Spark VFX ───────────────────────────────────────────────────────────
  const sparkImage = preloadImage(prependBaseUrl('images/vfx/big-spark_1280x256.webp'))
  const activeSparks: SpritesheetAnimation[] = []
  const sparkCooldowns = new Map<string, number>() // "a_b" -> last spawn timestamp
  const clashSoundCooldowns = new Map<string, number>()

  // Per-defender crit cooldown — prevents the "rapid bounce-off + chase" loop
  // from triggering crits on every contact while the opponent is still being
  // pushed and has its rear constantly exposed.
  const CRIT_COOLDOWN_MS = 1500
  const lastCritAt = new Map<number, number>()

  // ── Blade Model Images ──────────────────────────────────────────────────
  const bladeModelImages = new Map<string, HTMLImageElement>()

  const getBladeModelImage = (topPartId: TopPartId, owner: 'player' | 'npc', modelOverride?: string): HTMLImageElement | null => {
    const key = modelOverride ?? `${topPartId}_${owner}`
    let img = bladeModelImages.get(key)
    if (!img) {
      img = preloadImage(baybladeModelImgPath(topPartId, owner, modelOverride))
      bladeModelImages.set(key, img)
    }
    return (img.complete && img.naturalWidth > 0) ? img : null
  }

  // ─── Trail System ────────────────────────────────────────────────────────

  interface TrailPoint {
    x: number;
    y: number;
    speed: number;
    time: number
  }

  interface TrailData {
    pts: TrailPoint[];
    owner: 'player' | 'npc'
  }

  const TRAIL_DURATION = 700
  const trails = new Map<number, TrailData>()

  const updateTrails = (blades: BaybladeState[], now: number) => {
    for (const blade of blades) {
      if (blade.hp <= 0) {
        trails.delete(blade.id)
        continue
      }
      const spd = Math.sqrt(blade.vx * blade.vx + blade.vy * blade.vy)

      let data = trails.get(blade.id)
      if (!data) {
        data = { pts: [], owner: blade.owner }
        trails.set(blade.id, data)
      }
      const pts = data.pts

      // Always record position to keep path continuous
      pts.push({ x: blade.x, y: blade.y, speed: spd, time: now })

      // Prune expired points
      while (pts.length > 0 && now - pts[0]!.time > TRAIL_DURATION) {
        pts.shift()
      }
    }
  }

  // ─── Floating Damage Numbers ──────────────────────────────────────────────

  interface DamageNumber {
    x: number;
    y: number
    vx: number;
    vy: number
    value: number
    color: string   // '#66aaff' player, '#ff6666' npc
    life: number     // remaining ms
    maxLife: number
    isCrit: boolean
    comboText?: string  // thunder arena combo label
  }

  const DAMAGE_NUMBER_LIFE = 900
  const damageNumbers: DamageNumber[] = []

  // Thunder arena combo tracking: per-blade last hit target + timestamp + stacks
  const COMBO_WINDOW_MS = 3000
  const COMBO_GRACE_MS = 100
  const comboState = new Map<number, { targetId: number; lastTime: number; stacks: number }>()

  const spawnDamageNumber = (x: number, y: number, value: number, dealerOwner: 'player' | 'npc', isCrit = false) => {
    if (Math.round(value) <= 0) return
    // Random angle in a 60° cone pointing upward (centered at -90°)
    const baseAngle = -Math.PI / 2
    const spread = (Math.PI / 3) // 60°
    const angle = baseAngle + (Math.random() - 0.5) * spread
    const speed = 0.06 + Math.random() * 0.03

    damageNumbers.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      value: Math.round(value),
      color: dealerOwner === 'player' ? '#66aaff' : '#ff6666',
      life: DAMAGE_NUMBER_LIFE,
      maxLife: DAMAGE_NUMBER_LIFE,
      isCrit
    })
  }

  const updateDamageNumbers = (dt: number) => {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const dn = damageNumbers[i]!
      dn.x += dn.vx * dt
      dn.y += dn.vy * dt
      dn.life -= dt
      if (dn.life <= 0) damageNumbers.splice(i, 1)
    }
  }

  const renderDamageNumbers = (ctx: CanvasRenderingContext2D) => {
    for (const dn of damageNumbers) {
      const alpha = Math.max(0, dn.life / dn.maxLife)
      const baseScale = 0.8 + 0.4 * (1 - alpha) // slightly grow as they fade
      const scale = dn.isCrit ? baseScale * 1.5 : baseScale
      const text = dn.comboText ?? dn.value.toString()

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = `bold ${20 * scale}px Arial`
      ctx.textAlign = dn.comboText ? 'left' : 'center'
      ctx.textBaseline = 'middle'

      // Crit: dark orange pulsating aura
      if (dn.isCrit) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01)
        const auraRadius = 8 + pulse * 6
        ctx.shadowColor = '#cc6600'
        ctx.shadowBlur = auraRadius
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.strokeText(text, dn.x, dn.y)
        ctx.fillStyle = '#ff8800'
        ctx.fillText(text, dn.x, dn.y)
        ctx.shadowBlur = 0
      } else {
        // Text shadow (game-text style: black border)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        ctx.lineJoin = 'round'
        ctx.strokeText(text, dn.x, dn.y)
        ctx.fillStyle = dn.color
        ctx.fillText(text, dn.x, dn.y)
      }

      ctx.restore()
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  let nextBladeId = 0

  const speed = (blade: BaybladeState): number =>
    Math.sqrt(blade.vx * blade.vx + blade.vy * blade.vy)

  const livingBlades = (blades: BaybladeState[]): BaybladeState[] =>
    blades.filter(b => b.hp > 0)

  let firstGameBoost = false

  const statsFor = (blade: BaybladeState): BaybladeStats => {
    const stats = computeStats(blade.config, blade.config.topLevel ?? 0, blade.config.bottomLevel ?? 0)
    if (firstGameBoost && blade.owner === 'player') {
      return { ...stats, damageMultiplier: stats.damageMultiplier * 2 }
    }
    return stats
  }

  // ─── Factory ─────────────────────────────────────────────────────────────

  function createBladeState(
    owner: 'player' | 'npc',
    x: number, y: number,
    config: BaybladeConfig,
    isBoss = false
  ): BaybladeState {
    const stats = computeStats(config, config.topLevel ?? 0, config.bottomLevel ?? 0)
    const bossHpMultiplier = isBoss ? 2 : 1
    const boostHpMultiplier = (firstGameBoost && owner === 'player') ? 2 : 1
    const bossRadius = isBoss ? BLADE_RADIUS * 1.6 : BLADE_RADIUS
    const finalHp = stats.maxHp * bossHpMultiplier * boostHpMultiplier
    return {
      id: nextBladeId++,
      x, y,
      vx: 0, vy: 0,
      ax: 0, ay: 0,
      accelFramesLeft: 0,
      radius: bossRadius,
      hp: finalHp,
      maxHp: finalHp,
      rotation: 0,
      rotationSpeed: isBoss ? 0.03 : 0.05,
      hitFlash: 0,
      wallBounceCount: 0,
      lastHitTime: 0,
      config,
      owner,
      isBoss
    }
  }

  // ─── Game Lifecycle ──────────────────────────────────────────────────────

  const initGame = (
    pTeam: BaybladeConfig[],
    nTeam: BaybladeConfig[],
    boost = false,
    arena: ArenaType = 'default'
  ) => {
    firstGameBoost = boost
    stopPhysics()
    nextBladeId = 0
    // Clear cached player model images so skin changes take effect
    for (const key of [...bladeModelImages.keys()]) {
      if (key.endsWith('_player')) bladeModelImages.delete(key)
    }

    // Player blades: bottom half, spread evenly
    const pCount = pTeam.length
    playerBlades.value = pTeam.map((cfg, i) => {
      const spreadX = pCount === 1 ? 0 : (i / (pCount - 1) - 0.5) * ARENA_RADIUS * 0.7
      return createBladeState('player', spreadX, ARENA_RADIUS * 0.4, cfg)
    })

    // NPC blades: deterministic grid in top half, with small jitter
    // Collision distance is BLADE_RADIUS * 2; we enforce BLADE_RADIUS * 6 minimum spacing
    const SAFE_DIST = BLADE_RADIUS * 6
    const nCount = nTeam.length
    const maxJitter = BLADE_RADIUS * 0.8
    const npcPositions: { x: number; y: number }[] = []

    if (nCount === 1) {
      const jx = (Math.random() - 0.5) * maxJitter
      const jy = (Math.random() - 0.5) * maxJitter
      npcPositions.push({ x: jx, y: -ARENA_RADIUS * 0.4 + jy })
    } else if (nCount === 2) {
      for (let i = 0; i < 2; i++) {
        const x = (i === 0 ? -1 : 1) * ARENA_RADIUS * 0.4 + (Math.random() - 0.5) * maxJitter
        const y = -ARENA_RADIUS * 0.4 + (Math.random() - 0.5) * maxJitter
        npcPositions.push({ x, y })
      }
    } else if (nCount === 3) {
      // Triangle: 2 on top row, 1 centered below
      const topY = -ARENA_RADIUS * 0.55
      const botY = -ARENA_RADIUS * 0.2
      const halfW = ARENA_RADIUS * 0.4
      npcPositions.push({ x: -halfW + (Math.random() - 0.5) * maxJitter, y: topY + (Math.random() - 0.5) * maxJitter })
      npcPositions.push({ x: halfW + (Math.random() - 0.5) * maxJitter, y: topY + (Math.random() - 0.5) * maxJitter })
      npcPositions.push({ x: (Math.random() - 0.5) * maxJitter, y: botY + (Math.random() - 0.5) * maxJitter })
    } else {
      // 4: 2x2 grid
      const halfW = ARENA_RADIUS * 0.4
      const topY = -ARENA_RADIUS * 0.65
      const botY = -ARENA_RADIUS * 0.15
      const slots = [
        { x: -halfW, y: topY },
        { x: halfW, y: topY },
        { x: -halfW, y: botY },
        { x: halfW, y: botY }
      ]
      for (let i = 0; i < nCount; i++) {
        const s = slots[i]!
        npcPositions.push({
          x: s.x + (Math.random() - 0.5) * maxJitter,
          y: s.y + (Math.random() - 0.5) * maxJitter
        })
      }
    }

    // Clamp all NPC positions inside the arena
    for (const pos of npcPositions) {
      const d = Math.hypot(pos.x, pos.y)
      const maxR = ARENA_RADIUS - BLADE_RADIUS * 2
      if (d > maxR) {
        pos.x *= maxR / d
        pos.y *= maxR / d
      }
    }

    npcBlades.value = nTeam.map((cfg, i) =>
      createBladeState('npc', npcPositions[i]!.x, npcPositions[i]!.y, cfg, cfg.isBoss)
    )

    isBossStage.value = nTeam.some(cfg => cfg.isBoss)
    arenaType.value = isBossStage.value ? 'boss' : arena

    isDragging.value = false
    selectedBladeId.value = null
    npcActiveBladeId.value = null
    launchedBladeId.value = null
    npcThinkingElapsed = 0
    gameResult.value = null
    turnAnnouncement.value = ''
    meteorParticles.value = []
    meteorIntroTimer = 0
    trails.clear()
    comboState.clear()
    lastCritAt.clear()
    damageNumbers.length = 0
    clearCountdown()
    phase.value = 'tap_to_start'
  }

  const startMatch = () => {
    if (phase.value !== 'tap_to_start') return

    // Trigger meteor shower intro
    spawnMeteorShower(80, 50, 65)

    try {
      const randomInt = Math.min(Math.floor(Math.random() * 2) + 1, 2)
      const audioName = `celebration-${randomInt}`
      playSound(audioName)
    } catch (e: any) {
    }

    // Track game starts; every Nth launches the countdown overlay
    gameStartCount.value++
    localStorage.setItem(GAME_START_COUNT_KEY, String(gameStartCount.value))
    if (gameStartCount.value % COUNTDOWN_EVERY_N_GAMES === 0) {
      triggerCountdown()
    }

    phase.value = 'meteor_intro'
    meteorIntroTimer = 0
    startPhysics()
  }

  // ─── Meteor Shower (reusable) ────────────────────────────────────────────

  const spawnMeteorShower = (
    count: number,
    spawnRadius: number,
    maxLife: number
  ) => {
    // Spawn in staggered waves — delay spread across ~60% of maxLife
    // so particles keep appearing throughout most of the animation
    const maxDelay = Math.floor(maxLife * 0.6)
    const particles: MeteorParticle[] = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
      const spawnDist = spawnRadius + (Math.random() - 0.5) * 6
      const spd = 1.5 + Math.random() * 2.5
      const lifeVar = maxLife + Math.floor(Math.random() * 20)
      // Stagger: life starts above maxLife; particle waits until life <= maxLife
      const delay = Math.floor(Math.random() * maxDelay)
      particles.push({
        x: Math.cos(angle) * spawnDist,
        y: Math.sin(angle) * spawnDist,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: lifeVar + delay,
        maxLife: lifeVar,
        hue: Math.random() < 0.25 ? 20 + Math.floor(Math.random() * 25) : 190 + Math.floor(Math.random() * 40)
      })
    }
    meteorParticles.value = particles
  }

  const updateMeteorParticles = () => {
    const alive: MeteorParticle[] = []
    for (const p of meteorParticles.value) {
      p.life--
      if (p.life <= 0) continue
      // Only move once the delay has elapsed (life <= maxLife)
      if (p.life <= p.maxLife) {
        p.x += p.vx
        p.y += p.vy
        const dist = Math.sqrt(p.x * p.x + p.y * p.y)
        if (dist > 0.1) {
          p.vx += (p.x / dist) * 0.02
          p.vy += (p.y / dist) * 0.02
        }
      }
      alive.push(p)
    }
    meteorParticles.value = alive
  }

  // ─── Player Interaction ──────────────────────────────────────────────────

  const beginDrag = (gameX: number, gameY: number) => {
    if (phase.value !== 'player_turn') return

    // Find nearest living player blade to the tap
    let closest: BaybladeState | null = null
    let closestDist = Infinity

    for (const blade of livingBlades(playerBlades.value)) {
      const dx = gameX - blade.x
      const dy = gameY - blade.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < blade.radius * 3 && dist < closestDist) {
        closest = blade
        closestDist = dist
      }
    }

    if (!closest) return

    selectedBladeId.value = closest.id
    isDragging.value = true
    dragStart.value = { x: gameX, y: gameY }
    dragCurrent.value = { x: gameX, y: gameY }
  }

  const updateDrag = (gameX: number, gameY: number) => {
    if (!isDragging.value) return
    dragCurrent.value = { x: gameX, y: gameY }

    // Track last valid drag direction for out-of-viewport release
    const dx = dragCurrent.value.x - dragStart.value.x
    const dy = dragCurrent.value.y - dragStart.value.y
    const mag = Math.sqrt(dx * dx + dy * dy)
    if (mag > 3) {
      lastDragNx = -dx / mag
      lastDragNy = -dy / mag
    }
  }

  const cancelDrag = () => {
    isDragging.value = false
    lastDragNx = 0
    lastDragNy = 0
  }

  const releaseDrag = () => {
    if (!isDragging.value || !selectedBlade.value) return

    // Cancel zone: if pointer is back within the blade's radius, cancel the pull
    const blade = selectedBlade.value
    const pointerDx = dragCurrent.value.x - blade.x
    const pointerDy = dragCurrent.value.y - blade.y
    const pointerDist = Math.sqrt(pointerDx * pointerDx + pointerDy * pointerDy)
    if (pointerDist < blade.radius) {
      cancelDrag()
      return
    }

    const { dx, dy } = dragVector.value
    const mag = Math.sqrt(dx * dx + dy * dy)

    if (mag < 5) {
      cancelDrag()
      return
    }

    const stats = statsFor(blade)

    // Compute target velocity (blade will accelerate toward this)
    const ratio = Math.min(mag / MAX_PULL_DISTANCE, 1)
    const maxForce = BASE_MAX_FORCE * stats.speedMultiplier
    const targetForce = ratio * maxForce

    const nx = -dx / mag
    const ny = -dy / mag

    // Acceleration ramp: blade starts at 0 velocity, gains speed over ACCEL_FRAMES
    blade.vx = 0
    blade.vy = 0
    blade.ax = (nx * targetForce) / ACCEL_FRAMES
    blade.ay = (ny * targetForce) / ACCEL_FRAMES
    blade.accelFramesLeft = ACCEL_FRAMES
    blade.wallBounceCount = 0

    launchedBladeId.value = blade.id
    isDragging.value = false
    phase.value = 'player_launched'
  }

  /** Pointer left the viewport while dragging — launch at max force in last direction */
  const forceReleaseDragAtMax = () => {
    if (!isDragging.value || !selectedBlade.value) return

    // Need a valid direction from prior drag movement
    if (lastDragNx === 0 && lastDragNy === 0) {
      isDragging.value = false
      return
    }

    const blade = selectedBlade.value
    const stats = statsFor(blade)
    const maxForce = BASE_MAX_FORCE * stats.speedMultiplier

    blade.vx = 0
    blade.vy = 0
    blade.ax = (lastDragNx * maxForce) / ACCEL_FRAMES
    blade.ay = (lastDragNy * maxForce) / ACCEL_FRAMES
    blade.accelFramesLeft = ACCEL_FRAMES
    blade.wallBounceCount = 0

    launchedBladeId.value = blade.id
    isDragging.value = false
    phase.value = 'player_launched'
  }

  // ─── NPC AI ──────────────────────────────────────────────────────────────

  const passToPlayer = () => {
    phase.value = 'player_turn'
    launchedBladeId.value = null
    npcActiveBladeId.value = null
    const first = livingBlades(playerBlades.value)[0]
    if (first) selectedBladeId.value = first.id
  }

  const launchNpc = () => {
    const living = livingBlades(npcBlades.value)
    if (living.length === 0) {
      passToPlayer()
      return
    }

    // Pick a random living NPC blade
    const blade = living[Math.floor(Math.random() * living.length)]!
    npcActiveBladeId.value = blade.id

    // Pick a random living player target
    const targets = livingBlades(playerBlades.value)
    if (targets.length === 0) return
    const target = targets[Math.floor(Math.random() * targets.length)]!

    const dx = target.x - blade.x
    const dy = target.y - blade.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.01) {
      // Overlapping — aim in a random direction instead
      const randAngle = Math.random() * Math.PI * 2
      const stats = statsFor(blade)
      const maxForce = BASE_MAX_FORCE * stats.speedMultiplier
      blade.vx = 0
      blade.vy = 0
      blade.ax = (Math.cos(randAngle) * maxForce * 0.5) / ACCEL_FRAMES
      blade.ay = (Math.sin(randAngle) * maxForce * 0.5) / ACCEL_FRAMES
      blade.accelFramesLeft = ACCEL_FRAMES
      blade.wallBounceCount = 0
      launchedBladeId.value = blade.id
      phase.value = 'npc_launched'
      return
    }

    // Aim toward target, avoiding friendly blades in the path
    let angle = Math.atan2(dy, dx)

    // Check if any living teammate (other than the launcher) is in the firing lane
    const allies = livingBlades(npcBlades.value).filter(b => b.id !== blade.id)
    const isPathBlocked = (a: number) => {
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      for (const ally of allies) {
        const ax = ally.x - blade.x
        const ay = ally.y - blade.y
        // Project ally position onto the launch direction
        const proj = ax * cos + ay * sin
        if (proj < 0) continue // ally is behind the launcher
        // Perpendicular distance from ally to the launch line
        const perp = Math.abs(-ax * sin + ay * cos)
        if (perp < BLADE_RADIUS * 3) return true
      }
      return false
    }

    // If the direct path is blocked, try offset angles to find a clear shot
    if (isPathBlocked(angle)) {
      let found = false
      for (let offset = 0.15; offset <= Math.PI * 0.6; offset += 0.15) {
        if (!isPathBlocked(angle + offset)) {
          angle += offset
          found = true
          break
        }
        if (!isPathBlocked(angle - offset)) {
          angle -= offset
          found = true
          break
        }
      }
      // If no clear path, just add the normal spread and hope for the best
      if (!found) angle += (Math.random() - 0.5) * (Math.PI / 6)
    } else {
      // Normal ±15° spread when path is clear
      angle += (Math.random() - 0.5) * (Math.PI / 6)
    }

    // Random force 65-100% of max
    const stats = statsFor(blade)
    const forcePct = 0.65 + Math.random() * 0.35
    const maxForce = BASE_MAX_FORCE * stats.speedMultiplier
    const targetForce = forcePct * maxForce

    // Acceleration ramp (same as player)
    blade.vx = 0
    blade.vy = 0
    blade.ax = (Math.cos(angle) * targetForce) / ACCEL_FRAMES
    blade.ay = (Math.sin(angle) * targetForce) / ACCEL_FRAMES
    blade.accelFramesLeft = ACCEL_FRAMES
    blade.wallBounceCount = 0

    launchedBladeId.value = blade.id
    phase.value = 'npc_launched'
  }

  // ─── Physics ─────────────────────────────────────────────────────────────

  const updatePhysics = () => {
    // Meteor shower phase
    if (phase.value === 'meteor_intro') {
      updateMeteorParticles()
      meteorIntroTimer += 16
      if (meteorIntroTimer >= 1600) {
        phase.value = 'deciding_turn'
        // Bias the starting turn based on the previous match outcome:
        // - After a loss (or losing streak), give the player an 80% chance to start
        //   so they have a better shot at recovering.
        // - After a win or before any match has been played, the enemy starts 70% of
        //   the time so wins feel earned rather than handed out.
        const playerStartChance = lastGameResult.value === 'lose' ? 0.80 : 0.30
        const startsWithPlayer = Math.random() < playerStartChance
        turnAnnouncement.value = startsWithPlayer ? 'YOUR TURN' : 'NPC TURN'
        setTimeout(() => {
          phase.value = startsWithPlayer ? 'player_turn' : 'npc_turn'
          turnAnnouncement.value = ''
          // Auto-select first living player blade
          const first = livingBlades(playerBlades.value)[0]
          if (first) selectedBladeId.value = first.id
        }, 500)
      }
      return
    }

    // Update meteor particles even during gameplay (they fade out)
    if (meteorParticles.value.length > 0) {
      updateMeteorParticles()
    }

    const all = allBlades.value

    // Per-blade physics
    for (const blade of all) {
      if (blade.hp <= 0) continue

      // Apply acceleration ramp
      if (blade.accelFramesLeft > 0) {
        blade.vx += blade.ax
        blade.vy += blade.ay
        blade.accelFramesLeft--
        if (blade.accelFramesLeft === 0) {
          blade.ax = 0
          blade.ay = 0
          blade.lastHitTime = performance.now()
        }
      }

      // Move
      blade.x += blade.vx
      blade.y += blade.vy

      // Decelerate (only after ramp is done)
      if (blade.accelFramesLeft === 0) {
        const stats = statsFor(blade)
        let decay = stats.forceDecay
        // Ice arena: significantly reduced friction (blades slide more)
        if (arenaType.value === 'ice') {
          decay = 1 - (1 - decay) * 0.35
        }
        // Below 25% max speed, gradually increase deceleration to reduce idle time
        const maxSpd = BASE_MAX_FORCE * stats.speedMultiplier
        const spdRatio = speed(blade) / maxSpd
        if (spdRatio < 0.25) {
          // Lerp decay toward a much stronger brake as speed approaches 0
          const t = 1 - spdRatio / 0.25 // 0 at 25%, 1 at 0%
          decay = decay * (1 - t) + 0.95 * t
        }

        // Exponential slowdown the longer a blade travels without hitting another blade
        if (blade.lastHitTime > 0) {
          const elapsed = performance.now() - blade.lastHitTime
          // After ~1s no-hit, start applying extra drag that ramps up exponentially
          const NO_HIT_GRACE_MS = 1000
          if (elapsed > NO_HIT_GRACE_MS) {
            const overTime = (elapsed - NO_HIT_GRACE_MS) / 1000 // seconds past grace
            // Extra decay: 0.99^(overTime^1.5) — ramps gently then aggressively
            const extraDecay = Math.pow(0.99, Math.pow(overTime, 1.5))
            decay *= extraDecay
          }
        }

        blade.vx *= decay
        blade.vy *= decay
      }

      // Clamp to stop
      const spd = speed(blade)
      if (spd < STOP_THRESHOLD && blade.accelFramesLeft === 0) {
        blade.vx = 0
        blade.vy = 0
      }

      // Spin proportional to speed, scaled by HP (100% at full → 40% at 5% HP)
      const hpPct = Math.max(0.05, blade.hp / blade.maxHp)
      const hpSpinScale = 0.4 + 0.6 * hpPct
      const comboRotMul = arenaType.value === 'thunder'
        ? 1 + (comboState.get(blade.id)?.stacks ?? 0) * 0.2
        : 1
      blade.rotation += (blade.rotationSpeed + spd * 0.02) * hpSpinScale * comboRotMul

      // Hit flash decay
      if (blade.hitFlash > 0) blade.hitFlash--

      // Wall collision with BOOST
      bounceOffWalls(blade)
    }

    // Record trail points
    updateTrails(all, performance.now())

    // All-pairs collision (including friendly fire!)
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (all[i]!.hp <= 0 || all[j]!.hp <= 0) continue
        resolveCollision(all[i]!, all[j]!)
      }
    }

    // Update spark animations (remove finished ones)
    for (let i = activeSparks.length - 1; i >= 0; i--) {
      if (updateSpritesheetAnim(activeSparks[i]!, 16)) {
        activeSparks.splice(i, 1)
      }
    }

    // Update floating damage numbers
    updateDamageNumbers(16)

    // Game over: all models of one side dead
    const playerAlive = livingBlades(playerBlades.value).length
    const npcAlive = livingBlades(npcBlades.value).length

    if ((playerAlive === 0 || npcAlive === 0) && !gameResult.value) {
      gameResult.value = npcAlive === 0 ? 'win' : 'lose'
      saveLastGameResult(gameResult.value)
      // Grace period so final spark VFX can finish playing
      setTimeout(() => {
        phase.value = 'game_over'
        stopPhysics()
      }, 400)
    }

    // Let sparks and damage numbers finish even after game over
    if (gameResult.value) return

    // Turn transitions — launched blade must come to rest (or be dead)
    const launched = all.find(b => b.id === launchedBladeId.value)
    const launchedStopped = !launched
      || launched.hp <= 0
      || (speed(launched) < STOP_THRESHOLD && launched.accelFramesLeft === 0)

    if (phase.value === 'player_launched' && launchedStopped) {
      phase.value = 'npc_turn'
      npcThinkingElapsed = 0
      launchedBladeId.value = null
      comboState.clear()
    }

    if (phase.value === 'npc_launched' && launchedStopped) {
      phase.value = 'player_turn'
      launchedBladeId.value = null
      comboState.clear()
      npcActiveBladeId.value = null
      // Auto-select first living player blade
      const first = livingBlades(playerBlades.value)[0]
      if (first) selectedBladeId.value = first.id
    }

    // NPC thinking
    if (phase.value === 'npc_turn') {
      npcThinkingElapsed += 16
      if (npcThinkingElapsed >= NPC_THINK_MS) {
        launchNpc()
      }
    }
  }

  const bounceOffWalls = (blade: BaybladeState) => {
    const dist = Math.sqrt(blade.x * blade.x + blade.y * blade.y)
    const maxDist = ARENA_RADIUS - blade.radius

    if (dist <= maxDist) return

    const ratio = maxDist / dist
    blade.x *= ratio
    blade.y *= ratio

    // Reflect velocity along outward normal
    const nx = blade.x / maxDist
    const ny = blade.y / maxDist
    const dot = blade.vx * nx + blade.vy * ny

    // Speed-based boost: faster models bounce harder
    const currentSpeed = Math.sqrt(blade.vx * blade.vx + blade.vy * blade.vy)
    const stats = statsFor(blade)
    const maxSpeed = BASE_MAX_FORCE * stats.speedMultiplier
    const speedRatio = Math.min(currentSpeed / maxSpeed, 1)

    // Decay: reduce wall boost by 12% per bounce after the first, min 30% effectiveness
    const decayBounces = Math.max(0, blade.wallBounceCount)
    const effectiveness = Math.max(
      WALL_BOUNCE_MIN_EFFECTIVENESS,
      1 - decayBounces * WALL_BOUNCE_DECAY_PER_HIT
    )
    const effectiveBoost = 1 + (WALL_BOOST_FACTOR - 1) * effectiveness * speedRatio

    blade.vx = (blade.vx - 2 * dot * nx) * effectiveBoost
    blade.vy = (blade.vy - 2 * dot * ny) * effectiveBoost
    blade.wallBounceCount++

    // Arena-specific wall effects
    if (arenaType.value === 'lava') {
      const lavaDmg = Math.ceil(blade.maxHp * 0.025)
      blade.hp = Math.max(1, blade.hp - lavaDmg)
      blade.hitFlash = HIT_FLASH_FRAMES
      const lavaAngle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 3)
      const lavaSpd = 0.06 + Math.random() * 0.03
      damageNumbers.push({
        x: blade.x, y: blade.y,
        value: lavaDmg, life: DAMAGE_NUMBER_LIFE, maxLife: DAMAGE_NUMBER_LIFE,
        vx: Math.cos(lavaAngle) * lavaSpd, vy: Math.sin(lavaAngle) * lavaSpd,
        color: blade.owner === 'player' ? '#ff6666' : '#66aaff',
        isCrit: false
      })
    } else if (arenaType.value === 'forest') {
      const healed = Math.min(1, blade.maxHp - blade.hp)
      blade.hp = Math.min(blade.maxHp, blade.hp + 1)
      if (healed > 0) {
        const healAngle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 3)
        const healSpd = 0.06 + Math.random() * 0.03
        damageNumbers.push({
          x: blade.x, y: blade.y,
          value: healed, life: DAMAGE_NUMBER_LIFE, maxLife: DAMAGE_NUMBER_LIFE,
          vx: Math.cos(healAngle) * healSpd, vy: Math.sin(healAngle) * healSpd,
          color: '#44cc66', isCrit: false
        })
      }
    }
  }

  const resolveCollision = (a: BaybladeState, b: BaybladeState) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const minDist = a.radius + b.radius

    if (dist >= minDist || dist < 0.01) return

    // Reset no-hit timer on collision
    const now_hit = performance.now()
    a.lastHitTime = now_hit
    b.lastHitTime = now_hit

    triggerShake('small')

    const nx = dx / dist
    const ny = dy / dist

    const aSpeed = speed(a)
    const bSpeed = speed(b)

    // Elastic bounce FIRST — must happen before damage so killing blows still bounce
    const aDot = a.vx * nx + a.vy * ny
    const bDot = b.vx * nx + b.vy * ny

    a.vx = (a.vx - aDot * nx + bDot * nx) * BOUNCE_DAMPENING
    a.vy = (a.vy - aDot * ny + bDot * ny) * BOUNCE_DAMPENING
    b.vx = (b.vx - bDot * nx + aDot * nx) * BOUNCE_DAMPENING
    b.vy = (b.vy - bDot * ny + aDot * ny) * BOUNCE_DAMPENING

    // Separate overlapping models
    const overlap = minDist - dist
    a.x -= (overlap / 2) * nx
    a.y -= (overlap / 2) * ny
    b.x += (overlap / 2) * nx
    b.y += (overlap / 2) * ny

    // Damage based on pre-bounce speed
    const aStats = statsFor(a)
    const bStats = statsFor(b)

    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2

    // Back-side crit detection: 90° cone behind travel direction when moving >= 25% max speed
    const CRIT_CONE_HALF = Math.PI / 4 // 45° half-angle = 90° cone
    const aMaxSpd = BASE_MAX_FORCE * aStats.speedMultiplier
    const bMaxSpd = BASE_MAX_FORCE * bStats.speedMultiplier

    // Check if attacker a hits b in b's back.
    // n points a→b, so on b's surface the contact point is at b.center + bRadius·(-n).
    // A "rear hit" means that contact lies on b's REAR half (opposite b's forward).
    // Geometrically: (-n) · (-bForward) >= cos(45°)  ⇔  bForward · n >= cos(45°).
    // Intuitively: b is moving AWAY from a along n, so a is catching b from behind.
    const bMovingFast = bSpeed >= bMaxSpd * 0.25
    let bHitInBack = false
    if (bMovingFast) {
      const bDirX = b.vx / bSpeed
      const bDirY = b.vy / bSpeed
      const cosAngle = bDirX * nx + bDirY * ny
      bHitInBack = cosAngle >= Math.cos(CRIT_CONE_HALF)
    }

    // Check if attacker b hits a in a's back.
    // Contact on a is at a.center + aRadius·n. For it to be on a's rear:
    //  n · (-aForward) >= cos(45°)  ⇔  aForward · n <= -cos(45°).
    // Intuitively: a is moving AWAY from b along -n, so b is catching a from behind.
    const aMovingFast = aSpeed >= aMaxSpd * 0.25
    let aHitInBack = false
    if (aMovingFast) {
      const aDirX = a.vx / aSpeed
      const aDirY = a.vy / aSpeed
      const cosAngle = aDirX * nx + aDirY * ny
      aHitInBack = cosAngle <= -Math.cos(CRIT_CONE_HALF)
    }

    let hadCrit = false
    let hadKill = false

    // Speed advantage: reduce counter damage by 25% if attacker is 2x+ faster
    const aSpeedAdv = (bSpeed > 0 && aSpeed >= bSpeed * 2) ? 0.75 : 1
    const bSpeedAdv = (aSpeed > 0 && bSpeed >= aSpeed * 2) ? 0.75 : 1

    // Thunder arena combo tracking
    let aComboMul = 1
    let bComboMul = 1
    if (arenaType.value === 'thunder') {
      const comboAngle = (Math.random() - 0.5) * (Math.PI / 3) // 60° cone pointing right
      const comboSpd = 0.06 + Math.random() * 0.03
      const now = performance.now()
      // Update combo for a hitting b (only if a is moving fast enough to attack)
      if (aSpeed > STOP_THRESHOLD) {
        const aCombo = comboState.get(a.id)
        if (aCombo && aCombo.targetId === b.id && now - aCombo.lastTime <= COMBO_WINDOW_MS) {
          if (now - aCombo.lastTime >= COMBO_GRACE_MS) {
            aCombo.stacks++
            aCombo.lastTime = now
            aComboMul = 1 + aCombo.stacks * 0.1
            damageNumbers.push({
              x: cx, y: cy,
              value: 0, life: DAMAGE_NUMBER_LIFE, maxLife: DAMAGE_NUMBER_LIFE,
              vx: Math.cos(comboAngle) * comboSpd, vy: Math.sin(comboAngle) * comboSpd,
              color: '#ffcc22', isCrit: false,
              comboText: `${aCombo.stacks}x COMBO`
            })
          } else {
            aComboMul = 1 + aCombo.stacks * 0.1
          }
        } else {
          comboState.set(a.id, { targetId: b.id, lastTime: now, stacks: 0 })
        }
      }
      // Update combo for b hitting a (only if b is moving fast enough to attack)
      if (bSpeed > STOP_THRESHOLD) {
        const bCombo = comboState.get(b.id)
        if (bCombo && bCombo.targetId === a.id && now - bCombo.lastTime <= COMBO_WINDOW_MS) {
          if (now - bCombo.lastTime >= COMBO_GRACE_MS) {
            bCombo.stacks++
            bCombo.lastTime = now
            bComboMul = 1 + bCombo.stacks * 0.1
            damageNumbers.push({
              x: cx, y: cy,
              value: 0, life: DAMAGE_NUMBER_LIFE, maxLife: DAMAGE_NUMBER_LIFE,
              vx: Math.cos(comboAngle) * comboSpd, vy: Math.sin(comboAngle) * comboSpd,
              color: '#ffcc22', isCrit: false,
              comboText: `${bCombo.stacks}x COMBO`
            })
          } else {
            bComboMul = 1 + bCombo.stacks * 0.1
          }
        } else {
          comboState.set(b.id, { targetId: a.id, lastTime: now, stacks: 0 })
        }
      }
    }

    const nowCrit = performance.now()

    // a attacks b
    if (aSpeed > STOP_THRESHOLD && !aHitInBack) {
      // Crit only if:
      //  1) attacker is at least 2x faster than defender (real back-stab,
      //     not a love-tap from a similarly-fast chaser),
      //  2) defender hasn't been crit recently — keeps chase-loops from
      //     chaining crits while the opponent's rear stays exposed.
      const bLastCrit = lastCritAt.get(b.id) ?? -Infinity
      const isCrit = bHitInBack
        && aSpeed >= bSpeed * 2
        && (nowCrit - bLastCrit >= CRIT_COOLDOWN_MS)
      if (isCrit) {
        hadCrit = true
        lastCritAt.set(b.id, nowCrit)
      }
      let defMul = isCrit ? 1 : bStats.defenseMultiplier
      if (a.config.topPartId === 'piercer') defMul = 1 + (defMul - 1) * 0.5
      const atkMul = isCrit ? 1.25 : 1
      const dmg = (aSpeed * aStats.damageMultiplier * atkMul * aStats.totalWeight)
        / (bStats.totalWeight * defMul)
        * DAMAGE_SCALE * bSpeedAdv * aComboMul
      b.hp = Math.max(0, b.hp - dmg)
      if (b.hp <= 0) hadKill = true
      b.hitFlash = HIT_FLASH_FRAMES
      spawnDamageNumber(cx, cy, dmg, a.owner, isCrit)
    }
    // b attacks a
    if (bSpeed > STOP_THRESHOLD && !bHitInBack) {
      const aLastCrit = lastCritAt.get(a.id) ?? -Infinity
      const isCrit = aHitInBack
        && bSpeed >= aSpeed * 2
        && (nowCrit - aLastCrit >= CRIT_COOLDOWN_MS)
      if (isCrit) {
        hadCrit = true
        lastCritAt.set(a.id, nowCrit)
      }
      let defMul = isCrit ? 1 : aStats.defenseMultiplier
      if (b.config.topPartId === 'piercer') defMul = 1 + (defMul - 1) * 0.5
      const atkMul = isCrit ? 1.25 : 1
      const dmg = (bSpeed * bStats.damageMultiplier * atkMul * bStats.totalWeight)
        / (aStats.totalWeight * defMul)
        * DAMAGE_SCALE * aSpeedAdv * bComboMul
      a.hp = Math.max(0, a.hp - dmg)
      if (a.hp <= 0) hadKill = true
      a.hitFlash = HIT_FLASH_FRAMES
      spawnDamageNumber(cx, cy, dmg, b.owner, isCrit)
    }

    if (hadKill || hadCrit) triggerShake('big')

    // Spark VFX at collision point (with cooldown per pair)
    const pairKey = a.id < b.id ? `${a.id}_${b.id}` : `${b.id}_${a.id}`
    const now = performance.now()
    const lastSpark = sparkCooldowns.get(pairKey) ?? 0
    if (now - lastSpark >= SPARK_COOLDOWN_MS && sparkImage.complete) {
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      activeSparks.push(createSpritesheetAnim(
        sparkImage, cx, cy,
        SPARK_TOTAL_FRAMES, SPARK_FRAME_DURATION, 256, 256, SPARK_SCALE, false
      ))
      sparkCooldowns.set(pairKey, now)
    }

    // Clash SFX (throttled per pair)
    const lastClash = clashSoundCooldowns.get(pairKey) ?? 0
    if (now - lastClash >= CLASH_SOUND_COOLDOWN_MS) {
      const idx = Math.floor(Math.random() * 5) + 1
      playSound(`clash-${idx}`)
      clashSoundCooldowns.set(pairKey, now)
    }
  }

  // ─── Physics Loop ────────────────────────────────────────────────────────

  const startPhysics = () => {
    const loop = () => {
      // Run the physics step `simSpeed` times per rendered frame for a purely
      // visual speed-up. The integration is deterministic at fixed step size,
      // so collision impulses and damage are identical regardless of speed.
      const steps = simSpeed.value
      for (let i = 0; i < steps; i++) updatePhysics()
      if (physicsRafId !== null) {
        physicsRafId = requestAnimationFrame(loop)
      }
    }
    physicsRafId = requestAnimationFrame(loop)
  }

  const stopPhysics = () => {
    if (physicsRafId !== null) {
      cancelAnimationFrame(physicsRafId)
      physicsRafId = null
    }
  }

  // ─── Canvas Rendering ────────────────────────────────────────────────────

  const render = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, showHintAnim = false) => {
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    const fitSize = Math.min(canvasWidth, canvasHeight)
    const scale = fitSize / (ARENA_RADIUS * 2 + ARENA_PADDING)

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(scale, scale)

    renderArena(ctx)
    renderMeteorShower(ctx)
    renderTrails(ctx)

    // Auras (rendered under blades)
    for (const blade of allBlades.value) {
      if (blade.hp <= 0) continue
      renderAura(ctx, blade)
    }

    // Render all models
    for (const blade of allBlades.value) {
      if (blade.hp <= 0) continue
      renderBlade(ctx, blade)
    }

    // Spark VFX
    for (const spark of activeSparks) {
      renderSpritesheetAnim(ctx, spark)
    }

    // Floating damage numbers
    renderDamageNumbers(ctx)

    // Selection highlight
    if (phase.value === 'player_turn' && selectedBlade.value && !isDragging.value) {
      renderSelectionGlow(ctx, selectedBlade.value)
    }

    // Drag indicator
    if (isDragging.value && selectedBlade.value && phase.value === 'player_turn') {
      renderDragIndicator(ctx, selectedBlade.value)
    }

    // Hint animation
    renderHintAnimation(ctx, showHintAnim)

    ctx.restore()
  }

  // Trail layers: outer glow, mid body, inner core
  const TRAIL_LAYERS = [
    { widthBase: 6, widthSpeed: 4, alphaScale: 0.15 }, // outer glow
    { widthBase: 3, widthSpeed: 3, alphaScale: 0.35 }, // mid body
    { widthBase: 1, widthSpeed: 1.5, alphaScale: 0.7 }  // inner core
  ]

  const renderTrails = (ctx: CanvasRenderingContext2D) => {
    const now = performance.now()

    // Team colors: player = blue, npc = red
    const TEAM_COLOR = { player: [80, 160, 255], npc: [255, 80, 80] } as const

    for (const [, data] of trails) {
      const { pts, owner } = data
      if (pts.length < 2) continue

      const oldestTime = pts[0]!.time
      const newestTime = pts[pts.length - 1]!.time
      const timeSpan = newestTime - oldestTime
      const [tr, tg, tb] = TEAM_COLOR[owner]

      for (const layer of TRAIL_LAYERS) {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = layer.widthBase + layer.widthSpeed

        for (let i = 1; i < pts.length; i++) {
          const p0 = pts[i - 1]!
          const p1 = pts[i]!

          // t: 0 = oldest point, 1 = newest (closest to blade)
          const t = timeSpan > 0 ? (p1.time - oldestTime) / timeSpan : 1
          // Fade out old points by age
          const age = now - p1.time
          const ageFade = Math.max(0, 1 - age / TRAIL_DURATION)

          const alpha = ageFade * layer.alphaScale
          if (alpha <= 0.01) continue

          // Interpolate white(t=0) → team color(t=1)
          const r = Math.round(255 + (tr - 255) * t)
          const g = Math.round(255 + (tg - 255) * t)
          const b = Math.round(255 + (tb - 255) * t)

          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(p0.x, p0.y)
          ctx.lineTo(p1.x, p1.y)
          ctx.stroke()
        }
      }
    }
  }

  // Arena theme lookup by type
  const ARENA_THEMES: Record<ArenaType, {
    neonColor: string
    neonRgba: string
    floorGrad?: [string, string]
    innerGlowRgba?: string
    ringColor: string
    borderWidth: number
    shadowBlur: number
  }> = {
    default: {
      neonColor: '#4fdfff', neonRgba: 'rgba(79, 223, 255,',
      ringColor: '#1c2a3d', borderWidth: 4, shadowBlur: 20
    },
    boss: {
      neonColor: '#ff4444', neonRgba: 'rgba(255, 60, 40,',
      floorGrad: ['#2a1010', '#1a0808'],
      innerGlowRgba: 'rgba(255, 40, 20,',
      ringColor: '#3a1515', borderWidth: 5, shadowBlur: 30
    },
    lava: {
      neonColor: '#ff6622', neonRgba: 'rgba(255, 102, 34,',
      floorGrad: ['#2a1508', '#1a0c04'],
      innerGlowRgba: 'rgba(255, 80, 20,',
      ringColor: '#3a2010', borderWidth: 5, shadowBlur: 25
    },
    ice: {
      neonColor: '#88ccff', neonRgba: 'rgba(136, 204, 255,',
      floorGrad: ['#0e2238', '#081828'],
      innerGlowRgba: 'rgba(100, 180, 255,',
      ringColor: '#1e3348', borderWidth: 4, shadowBlur: 28
    },
    forest: {
      neonColor: '#44cc66', neonRgba: 'rgba(68, 204, 102,',
      floorGrad: ['#0a1a0c', '#061208'],
      innerGlowRgba: 'rgba(40, 180, 60,',
      ringColor: '#1a2d1a', borderWidth: 4, shadowBlur: 22
    },
    thunder: {
      neonColor: '#ffcc22', neonRgba: 'rgba(255, 204, 34,',
      floorGrad: ['#1a1a08', '#12120a'],
      innerGlowRgba: 'rgba(255, 220, 60,',
      ringColor: '#2d2a1a', borderWidth: 4, shadowBlur: 25
    }
  }

  const renderArena = (ctx: CanvasRenderingContext2D) => {
    const theme = ARENA_THEMES[arenaType.value]

    // Arena floor
    if (theme.floorGrad) {
      const floorGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, ARENA_RADIUS)
      floorGrad.addColorStop(0, theme.floorGrad[0])
      floorGrad.addColorStop(1, theme.floorGrad[1])
      ctx.fillStyle = floorGrad
    } else {
      ctx.fillStyle = '#161b22'
    }
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Pulsating inner glow (for themed arenas)
    if (theme.innerGlowRgba) {
      const pulse = 0.3 + 0.2 * Math.sin(performance.now() * 0.002)
      const innerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, ARENA_RADIUS * 0.7)
      innerGlow.addColorStop(0, `${theme.innerGlowRgba} ${pulse * 0.15})`)
      innerGlow.addColorStop(1, `${theme.innerGlowRgba} 0)`)
      ctx.fillStyle = innerGlow
      ctx.beginPath()
      ctx.arc(0, 0, ARENA_RADIUS * 0.7, 0, Math.PI * 2)
      ctx.fill()
    }

    // Outer glow halo
    const glowGrad = ctx.createRadialGradient(0, 0, ARENA_RADIUS - 2, 0, 0, ARENA_RADIUS + 40)
    glowGrad.addColorStop(0, `${theme.neonRgba} 0.15)`)
    glowGrad.addColorStop(0.4, `${theme.neonRgba} 0.05)`)
    glowGrad.addColorStop(1, `${theme.neonRgba} 0)`)
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS + 40, 0, Math.PI * 2)
    ctx.fill()

    // Neon border
    ctx.strokeStyle = theme.neonColor
    ctx.lineWidth = theme.borderWidth
    ctx.shadowColor = theme.neonColor
    ctx.shadowBlur = theme.shadowBlur
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    // Inner rings
    ctx.strokeStyle = theme.ringColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS * 0.6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS * 0.3, 0, Math.PI * 2)
    ctx.stroke()

    // Ice arena: frost rings for distinct visual
    if (arenaType.value === 'ice') {
      // Outer frost ring — beyond the border
      const outerFrost = ctx.createRadialGradient(0, 0, ARENA_RADIUS + 2, 0, 0, ARENA_RADIUS + 18)
      outerFrost.addColorStop(0, 'rgba(160, 220, 255, 0.25)')
      outerFrost.addColorStop(0.5, 'rgba(100, 180, 240, 0.1)')
      outerFrost.addColorStop(1, 'rgba(80, 160, 220, 0)')
      ctx.fillStyle = outerFrost
      ctx.beginPath()
      ctx.arc(0, 0, ARENA_RADIUS + 18, 0, Math.PI * 2)
      ctx.fill()

      // Inner frost band — darker icy rim inside the border
      const innerFrost = ctx.createRadialGradient(0, 0, ARENA_RADIUS * 0.82, 0, 0, ARENA_RADIUS - 2)
      innerFrost.addColorStop(0, 'rgba(60, 130, 180, 0)')
      innerFrost.addColorStop(0.6, 'rgba(80, 160, 220, 0.08)')
      innerFrost.addColorStop(1, 'rgba(120, 200, 255, 0.18)')
      ctx.fillStyle = innerFrost
      ctx.beginPath()
      ctx.arc(0, 0, ARENA_RADIUS - 2, 0, Math.PI * 2)
      ctx.fill()

      // Secondary inner border ring
      ctx.strokeStyle = 'rgba(140, 210, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, ARENA_RADIUS - 8, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  const renderMeteorShower = (ctx: CanvasRenderingContext2D) => {
    for (const p of meteorParticles.value) {
      // Skip particles still waiting for their delay
      if (p.life > p.maxLife) continue
      const alpha = (p.life / p.maxLife) * 0.8
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      const tailLen = spd * 4

      // Direction of motion for elongated streak
      const nx = spd > 0.01 ? p.vx / spd : 0
      const ny = spd > 0.01 ? p.vy / spd : 0

      ctx.strokeStyle = `hsla(${p.hue}, 90%, 70%, ${alpha})`
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(p.x - nx * tailLen, p.y - ny * tailLen)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()

      // Bright head
      ctx.fillStyle = `hsla(${p.hue}, 90%, 90%, ${alpha})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.lineCap = 'butt'
  }

  const renderAura = (ctx: CanvasRenderingContext2D, blade: BaybladeState) => {
    const isPlayer = blade.owner === 'player'

    if (blade.isBoss) {
      // Boss: large fiery pulsating aura
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.003)
      const auraRadius = blade.radius * 2.2
      const grad = ctx.createRadialGradient(
        blade.x, blade.y, blade.radius * 0.4,
        blade.x, blade.y, auraRadius
      )
      grad.addColorStop(0, `rgba(255, 80, 20, ${0.8 * pulse})`)
      grad.addColorStop(0.3, `rgba(255, 40, 10, ${0.5 * pulse})`)
      grad.addColorStop(0.6, `rgba(180, 20, 5, ${0.3 * pulse})`)
      grad.addColorStop(1, 'rgba(120, 10, 0, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(blade.x, blade.y, auraRadius, 0, Math.PI * 2)
      ctx.fill()
      return
    }

    // Player aura pulsates, NPC aura is steady
    const pulse = isPlayer
      ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(performance.now() * 0.004))
      : 0.5
    const auraRadius = blade.radius * 1.8
    const grad = ctx.createRadialGradient(
      blade.x, blade.y, blade.radius * 0.3,
      blade.x, blade.y, auraRadius
    )
    if (isPlayer) {
      grad.addColorStop(0, `rgba(60, 140, 255, ${0.5 * pulse})`)
      grad.addColorStop(0.5, `rgba(40, 100, 220, ${0.25 * pulse})`)
      grad.addColorStop(1, 'rgba(30, 80, 200, 0)')
    } else {
      grad.addColorStop(0, `rgba(255, 60, 60, ${0.7 * pulse})`)
      grad.addColorStop(0.5, `rgba(220, 40, 40, ${0.4 * pulse})`)
      grad.addColorStop(1, 'rgba(200, 30, 30, 0)')
    }
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(blade.x, blade.y, auraRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  const renderBlade = (ctx: CanvasRenderingContext2D, blade: BaybladeState) => {
    const { x, y, rotation, owner, hitFlash, hp, maxHp, radius } = blade
    const isPlayer = owner === 'player'

    // Circular clip for the model image
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.clip()


    // Model image (rotates with blade)
    const modelImg = getBladeModelImage(blade.config.topPartId, owner, blade.config.modelId)
    if (modelImg) {
      ctx.translate(x, y)
      ctx.rotate(rotation)
      const imgSize = radius * 2
      ctx.drawImage(modelImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize)
      ctx.rotate(-rotation)
      ctx.translate(-x, -y)
    }

    ctx.restore()

    // Hit flash overlay (white -> red -> orange -> white)
    if (hitFlash > 0) {
      ctx.globalAlpha = (hitFlash / HIT_FLASH_FRAMES) * 0.7
      const progress = 1 - hitFlash / HIT_FLASH_FRAMES
      if (progress < 0.2) ctx.fillStyle = '#ffffff'
      else if (progress < 0.5) ctx.fillStyle = '#ff3333'
      else if (progress < 0.8) ctx.fillStyle = '#ff8800'
      else ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    renderHealthRing(ctx, x, y, hp, maxHp, radius, isPlayer)
  }

  const renderHealthRing = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    hp: number, maxHp: number,
    bladeRadius: number,
    isPlayer: boolean
  ) => {
    const hpPct = Math.max(0, Math.min(1, hp / maxHp))
    const ringR = bladeRadius * 0.45
    const ringWidth = 2.5

    // Background ring
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.lineWidth = ringWidth
    ctx.beginPath()
    ctx.arc(x, y, ringR, 0, Math.PI * 2)
    ctx.stroke()

    // HP arc
    const hue = hpPct * 120
    ctx.strokeStyle = `hsl(${hue}, 90%, 50%)`
    ctx.lineWidth = ringWidth
    ctx.lineCap = 'round'
    const start = -Math.PI / 2
    const end = start + hpPct * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x, y, ringR, start, end)
    ctx.stroke()
    ctx.lineCap = 'butt'

    // HP number (dynamically sized to fit inside the ring)
    const hpText = Math.ceil(hp).toString()
    const innerDiameter = (ringR - ringWidth) * 2
    // Binary-ish search: start large, shrink until it fits
    let fontSize = innerDiameter
    ctx.font = `bold ${fontSize}px Arial`
    let measured = ctx.measureText(hpText).width
    while (measured > innerDiameter * 0.85 && fontSize > 4) {
      fontSize -= 1
      ctx.font = `bold ${fontSize}px Arial`
      measured = ctx.measureText(hpText).width
    }

    ctx.fillStyle = isPlayer ? '#66aaff' : '#ff6666'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.strokeText(hpText, x, y)
    ctx.fillText(hpText, x, y)
  }

  const renderSelectionGlow = (ctx: CanvasRenderingContext2D, blade: BaybladeState) => {
    ctx.strokeStyle = '#ffdd00'
    ctx.lineWidth = 2
    ctx.shadowColor = '#ffdd00'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(blade.x, blade.y, blade.radius + 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  const renderDragIndicator = (ctx: CanvasRenderingContext2D, blade: BaybladeState) => {
    // Compute pull vector from blade center to pointer
    const pullDx = dragCurrent.value.x - blade.x
    const pullDy = dragCurrent.value.y - blade.y
    const pullMag = Math.sqrt(pullDx * pullDx + pullDy * pullDy)
    const inCancelZone = pullMag < blade.radius

    ctx.save()
    // Cancel zone circle
    const cancelAlpha = inCancelZone ? 0.6 : 0.2
    ctx.strokeStyle = `rgba(255, 80, 80, ${cancelAlpha})`
    ctx.lineWidth = inCancelZone ? 2.5 : 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(blade.x, blade.y, blade.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    if (inCancelZone) {
      // X icon
      const s = blade.radius * 0.35
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(blade.x - s, blade.y - s)
      ctx.lineTo(blade.x + s, blade.y + s)
      ctx.moveTo(blade.x + s, blade.y - s)
      ctx.lineTo(blade.x - s, blade.y + s)
      ctx.stroke()
    }
    ctx.restore()

    if (pullMag < 3) return

    const ratio = dragForceRatio.value

    ctx.save()
    // Pull line (dashed) — blade center to pointer
    ctx.strokeStyle = 'rgba(255,170,0,0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(blade.x, blade.y)
    ctx.lineTo(dragCurrent.value.x, dragCurrent.value.y)
    ctx.stroke()
    ctx.setLineDash([])

    // Launch arrow (opposite of pull direction, using same vector)
    const nx = -pullDx / pullMag
    const ny = -pullDy / pullMag
    const arrowLen = 30 + 50 * ratio
    const endX = blade.x + nx * arrowLen
    const endY = blade.y + ny * arrowLen

    const r = Math.floor(255 * ratio)
    const g = Math.floor(255 * (1 - ratio * 0.6))
    ctx.strokeStyle = `rgb(${r}, ${g}, 0)`
    ctx.fillStyle = `rgb(${r}, ${g}, 0)`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(blade.x, blade.y)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Arrowhead (tip extends past line end)
    const headSize = 8
    const angle = Math.atan2(ny, nx)
    const tipX = endX + nx * headSize
    const tipY = endY + ny * headSize
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - Math.cos(angle - 0.4) * headSize, tipY - Math.sin(angle - 0.4) * headSize)
    ctx.lineTo(tipX - Math.cos(angle + 0.4) * headSize, tipY - Math.sin(angle + 0.4) * headSize)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  // ─── Coordinate Conversion ───────────────────────────────────────────────

  const pixelToGame = (
    px: number, py: number, canvasWidth: number, canvasHeight: number
  ): { x: number; y: number } => {
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    const fitSize = Math.min(canvasWidth, canvasHeight)
    const scale = fitSize / (ARENA_RADIUS * 2 + ARENA_PADDING)
    return {
      x: (px - centerX) / scale,
      y: (py - centerY) / scale
    }
  }

  // ─── Hint Animation ─────────────────────────────────────────────────────

  const renderHintAnimation = (ctx: CanvasRenderingContext2D, showHint: boolean) => {
    if (!showHint || phase.value !== 'player_turn' || isDragging.value) return

    const blade = livingBlades(playerBlades.value)[0]
    if (!blade) return

    // Looping animation: 0→1 pull back, then hold, then release flash
    const cycleDuration = 2000 // ms
    const t = (Date.now() % cycleDuration) / cycleDuration

    // Phase 0–0.5: pull back, 0.5–0.8: hold, 0.8–1.0: release fade
    const pullDir = Math.PI * 0.75 // pull down-left
    let pullDist: number
    let alpha: number
    let showArrow = true

    if (t < 0.5) {
      // Pull back phase
      pullDist = (t / 0.5) * 60
      alpha = 0.5
    } else if (t < 0.8) {
      // Hold phase
      pullDist = 60
      alpha = 0.5 + 0.2 * Math.sin((t - 0.5) / 0.3 * Math.PI)
    } else {
      // Release fade
      pullDist = 60 * (1 - (t - 0.8) / 0.2)
      alpha = 0.5 * (1 - (t - 0.8) / 0.2)
      if (alpha < 0.05) showArrow = false
    }

    if (!showArrow) return

    const pullX = blade.x + Math.cos(pullDir) * pullDist
    const pullY = blade.y + Math.sin(pullDir) * pullDist

    // Launch direction (opposite of pull)
    const launchNx = -Math.cos(pullDir)
    const launchNy = -Math.sin(pullDir)
    const ratio = pullDist / 60
    const arrowLen = 30 + 50 * ratio

    ctx.save()
    ctx.globalAlpha = alpha

    // Pull line (dashed)
    ctx.strokeStyle = 'rgba(255,170,0,0.7)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(blade.x, blade.y)
    ctx.lineTo(pullX, pullY)
    ctx.stroke()
    ctx.setLineDash([])

    // Phantom finger circle at pull point
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath()
    ctx.arc(pullX, pullY, 8, 0, Math.PI * 2)
    ctx.fill()

    // Launch arrow
    const endX = blade.x + launchNx * arrowLen
    const endY = blade.y + launchNy * arrowLen

    const r = Math.floor(255 * ratio)
    const g = Math.floor(255 * (1 - ratio * 0.6))
    ctx.strokeStyle = `rgb(${r}, ${g}, 0)`
    ctx.fillStyle = `rgb(${r}, ${g}, 0)`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(blade.x, blade.y)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Arrowhead (tip extends past line end)
    const headSize = 8
    const angle = Math.atan2(launchNy, launchNx)
    const tipX = endX + launchNx * headSize
    const tipY = endY + launchNy * headSize
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - Math.cos(angle - 0.4) * headSize, tipY - Math.sin(angle - 0.4) * headSize)
    ctx.lineTo(tipX - Math.cos(angle + 0.4) * headSize, tipY - Math.sin(angle + 0.4) * headSize)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    phase,
    gameResult,
    turnAnnouncement,
    playerBlades,
    npcBlades,
    allBlades,
    selectedBladeId,
    selectedBlade,
    isDragging,
    dragStart,
    dragCurrent,
    dragForceRatio,
    meteorParticles,
    isBossStage,
    arenaType,

    initGame,
    startMatch,
    beginDrag,
    updateDrag,
    releaseDrag,
    forceReleaseDragAtMax,
    startPhysics,
    stopPhysics,
    spawnMeteorShower,

    render,
    pixelToGame,
    speed
  }
}

export default useBaybladeGame
