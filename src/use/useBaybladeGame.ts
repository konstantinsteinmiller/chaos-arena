import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type {
  BaybladeState,
  BaybladeConfig,
  BaybladeStats,
  GamePhase,
  GameResult,
  MeteorParticle
} from '@/types/bayblade'
import { computeStats } from '@/use/useBaybladeConfig'

// ─── Physics Constants ───────────────────────────────────────────────────────

export const ARENA_RADIUS = 200
export const BLADE_RADIUS = 18
const BASE_MAX_FORCE = 14
const STOP_THRESHOLD = 0.25
const DAMAGE_SCALE = 10
const HIT_FLASH_FRAMES = 50
const NPC_THINK_MS = 1500
const BOUNCE_DAMPENING = 0.75
// Wall bounces BOOST speed instead of dampening — ricochet strategy
const WALL_BOOST_FACTOR = 1.2
// Blade needs time to reach full speed after launch
const ACCEL_FRAMES = 28
// Long pull distance — enables wild mega-pulls that risk hitting own team
const MAX_PULL_RATIO = 0.85

export const MAX_PULL_DISTANCE = ARENA_RADIUS * MAX_PULL_RATIO

// ─── Composable ──────────────────────────────────────────────────────────────

export const useBaybladeGame = () => {
  // ── Game Phase ───────────────────────────────────────────────────────────
  const phase: Ref<GamePhase> = ref('idle')
  const gameResult: Ref<GameResult> = ref(null)
  const turnAnnouncement: Ref<string> = ref('')

  // ── Blade Arrays (2 per side) ────────────────────────────────────────────
  const playerBlades: Ref<BaybladeState[]> = ref([])
  const npcBlades: Ref<BaybladeState[]> = ref([])

  // All blades in one flat array for physics iteration
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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  let nextBladeId = 0

  const speed = (blade: BaybladeState): number =>
    Math.sqrt(blade.vx * blade.vx + blade.vy * blade.vy)

  const livingBlades = (blades: BaybladeState[]): BaybladeState[] =>
    blades.filter(b => b.hp > 0)

  const statsFor = (blade: BaybladeState): BaybladeStats =>
    computeStats(blade.config)

  // ─── Factory ─────────────────────────────────────────────────────────────

  function createBladeState(
    owner: 'player' | 'npc',
    x: number, y: number,
    config: BaybladeConfig
  ): BaybladeState {
    const stats = computeStats(config)
    return {
      id: nextBladeId++,
      x, y,
      vx: 0, vy: 0,
      ax: 0, ay: 0,
      accelFramesLeft: 0,
      radius: BLADE_RADIUS,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      rotation: 0,
      rotationSpeed: 0.05,
      hitFlash: 0,
      config,
      owner
    }
  }

  // ─── Game Lifecycle ──────────────────────────────────────────────────────

  const initGame = (
    pTeam: BaybladeConfig[],
    nTeam: BaybladeConfig[]
  ) => {
    stopPhysics()
    nextBladeId = 0

    // Player blades: bottom half, spread apart
    playerBlades.value = [
      createBladeState('player', -ARENA_RADIUS * 0.35, ARENA_RADIUS * 0.4, pTeam[0]),
      createBladeState('player', ARENA_RADIUS * 0.35, ARENA_RADIUS * 0.4, pTeam[1])
    ]

    // NPC blades: top half
    npcBlades.value = [
      createBladeState('npc', -ARENA_RADIUS * 0.35, -ARENA_RADIUS * 0.4, nTeam[0]),
      createBladeState('npc', ARENA_RADIUS * 0.35, -ARENA_RADIUS * 0.4, nTeam[1])
    ]

    isDragging.value = false
    selectedBladeId.value = null
    npcActiveBladeId.value = null
    launchedBladeId.value = null
    npcThinkingElapsed = 0
    gameResult.value = null
    turnAnnouncement.value = ''
    meteorParticles.value = []
    meteorIntroTimer = 0
    phase.value = 'tap_to_start'
  }

  const startMatch = () => {
    if (phase.value !== 'tap_to_start') return

    // Trigger meteor shower intro
    spawnMeteorShower(60, 15, 80)
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
    const particles: MeteorParticle[] = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
      const spawnDist = spawnRadius + (Math.random() - 0.5) * 6
      const spd = 1.5 + Math.random() * 2.5
      particles.push({
        x: Math.cos(angle) * spawnDist,
        y: Math.sin(angle) * spawnDist,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife + Math.floor(Math.random() * 20),
        maxLife: maxLife + Math.floor(Math.random() * 20),
        hue: 190 + Math.floor(Math.random() * 40) // cyan-blue range
      })
    }
    meteorParticles.value = particles
  }

  const updateMeteorParticles = () => {
    const alive: MeteorParticle[] = []
    for (const p of meteorParticles.value) {
      p.x += p.vx
      p.y += p.vy
      // Slight outward acceleration for circular spread feel
      const dist = Math.sqrt(p.x * p.x + p.y * p.y)
      if (dist > 0.1) {
        p.vx += (p.x / dist) * 0.02
        p.vy += (p.y / dist) * 0.02
      }
      p.life--
      if (p.life > 0) alive.push(p)
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
  }

  const releaseDrag = () => {
    if (!isDragging.value || !selectedBlade.value) return

    const { dx, dy } = dragVector.value
    const mag = Math.sqrt(dx * dx + dy * dy)

    if (mag < 5) {
      isDragging.value = false
      return
    }

    const blade = selectedBlade.value
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

    launchedBladeId.value = blade.id
    isDragging.value = false
    phase.value = 'player_launched'
  }

  // ─── NPC AI ──────────────────────────────────────────────────────────────

  const launchNpc = () => {
    const living = livingBlades(npcBlades.value)
    if (living.length === 0) return

    // Pick a random living NPC blade
    const blade = living[Math.floor(Math.random() * living.length)]
    npcActiveBladeId.value = blade.id

    // Pick a random living player target
    const targets = livingBlades(playerBlades.value)
    if (targets.length === 0) return
    const target = targets[Math.floor(Math.random() * targets.length)]

    const dx = target.x - blade.x
    const dy = target.y - blade.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.01) return

    // Aim toward target with ±15° spread
    let angle = Math.atan2(dy, dx)
    angle += (Math.random() - 0.5) * (Math.PI / 6)

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
        const startsWithPlayer = Math.random() > 0.5
        turnAnnouncement.value = startsWithPlayer ? 'YOUR TURN' : 'NPC TURN'
        setTimeout(() => {
          phase.value = startsWithPlayer ? 'player_turn' : 'npc_turn'
          turnAnnouncement.value = ''
          // Auto-select first living player blade
          const first = livingBlades(playerBlades.value)[0]
          if (first) selectedBladeId.value = first.id
        }, 1000)
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
        }
      }

      // Move
      blade.x += blade.vx
      blade.y += blade.vy

      // Decelerate (only after ramp is done)
      if (blade.accelFramesLeft === 0) {
        const stats = statsFor(blade)
        blade.vx *= stats.forceDecay
        blade.vy *= stats.forceDecay
      }

      // Clamp to stop
      const spd = speed(blade)
      if (spd < STOP_THRESHOLD && blade.accelFramesLeft === 0) {
        blade.vx = 0
        blade.vy = 0
      }

      // Spin proportional to speed
      blade.rotation += blade.rotationSpeed + spd * 0.02

      // Hit flash decay
      if (blade.hitFlash > 0) blade.hitFlash--

      // Wall collision with BOOST
      bounceOffWalls(blade)
    }

    // All-pairs collision (including friendly fire!)
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (all[i].hp <= 0 || all[j].hp <= 0) continue
        resolveCollision(all[i], all[j])
      }
    }

    // Game over: all blades of one side dead
    const playerAlive = livingBlades(playerBlades.value).length
    const npcAlive = livingBlades(npcBlades.value).length

    if (playerAlive === 0 || npcAlive === 0) {
      gameResult.value = npcAlive === 0 ? 'win' : 'lose'
      phase.value = 'game_over'
      stopPhysics()
      return
    }

    // Turn transitions — launched blade must come to rest
    const launched = all.find(b => b.id === launchedBladeId.value)
    const launchedStopped = !launched
      || (speed(launched) < STOP_THRESHOLD && launched.accelFramesLeft === 0)

    if (phase.value === 'player_launched' && launchedStopped) {
      phase.value = 'npc_turn'
      npcThinkingElapsed = 0
      launchedBladeId.value = null
    }

    if (phase.value === 'npc_launched' && launchedStopped) {
      phase.value = 'player_turn'
      launchedBladeId.value = null
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

    // BOOST instead of dampening — wall ricochets accelerate the blade
    blade.vx = (blade.vx - 2 * dot * nx) * WALL_BOOST_FACTOR
    blade.vy = (blade.vy - 2 * dot * ny) * WALL_BOOST_FACTOR
  }

  const resolveCollision = (a: BaybladeState, b: BaybladeState) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const minDist = a.radius + b.radius

    if (dist >= minDist || dist < 0.01) return

    const nx = dx / dist
    const ny = dy / dist

    const aSpeed = speed(a)
    const bSpeed = speed(b)
    const aStats = statsFor(a)
    const bStats = statsFor(b)

    // Damage based on current speed (low if still accelerating = nearby hit)
    if (aSpeed > STOP_THRESHOLD) {
      const dmg = (aSpeed * aStats.damageMultiplier * aStats.totalWeight)
        / (bStats.totalWeight * bStats.defenseMultiplier)
        * DAMAGE_SCALE
      b.hp = Math.max(0, b.hp - dmg)
      b.hitFlash = HIT_FLASH_FRAMES
    }
    if (bSpeed > STOP_THRESHOLD) {
      const dmg = (bSpeed * bStats.damageMultiplier * bStats.totalWeight)
        / (aStats.totalWeight * aStats.defenseMultiplier)
        * DAMAGE_SCALE
      a.hp = Math.max(0, a.hp - dmg)
      a.hitFlash = HIT_FLASH_FRAMES
    }

    // Elastic bounce
    const aDot = a.vx * nx + a.vy * ny
    const bDot = b.vx * nx + b.vy * ny

    a.vx = (a.vx - aDot * nx + bDot * nx) * BOUNCE_DAMPENING
    a.vy = (a.vy - aDot * ny + bDot * ny) * BOUNCE_DAMPENING
    b.vx = (b.vx - bDot * nx + aDot * nx) * BOUNCE_DAMPENING
    b.vy = (b.vy - bDot * ny + aDot * ny) * BOUNCE_DAMPENING

    // Separate overlapping blades
    const overlap = minDist - dist
    a.x -= (overlap / 2) * nx
    a.y -= (overlap / 2) * ny
    b.x += (overlap / 2) * nx
    b.y += (overlap / 2) * ny
  }

  // ─── Physics Loop ────────────────────────────────────────────────────────

  const startPhysics = () => {
    const loop = () => {
      updatePhysics()
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

  const render = (ctx: CanvasRenderingContext2D, canvasSize: number) => {
    const center = canvasSize / 2
    const scale = canvasSize / (ARENA_RADIUS * 2 + 40)

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    ctx.save()
    ctx.translate(center, center)
    ctx.scale(scale, scale)

    renderArena(ctx)
    renderMeteorShower(ctx)

    // Render all blades
    for (const blade of allBlades.value) {
      if (blade.hp <= 0) continue
      renderBlade(ctx, blade)
    }

    // Selection highlight
    if (phase.value === 'player_turn' && selectedBlade.value && !isDragging.value) {
      renderSelectionGlow(ctx, selectedBlade.value)
    }

    // Drag indicator
    if (isDragging.value && selectedBlade.value && phase.value === 'player_turn') {
      renderDragIndicator(ctx, selectedBlade.value)
    }

    ctx.restore()
  }

  const renderArena = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#161b22'
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Neon border — glows to hint at wall-boost mechanic
    ctx.strokeStyle = '#4fdfff'
    ctx.lineWidth = 4
    ctx.shadowColor = '#4fdfff'
    ctx.shadowBlur = 20
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    // Inner rings
    ctx.strokeStyle = '#1c2a3d'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS * 0.6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, ARENA_RADIUS * 0.3, 0, Math.PI * 2)
    ctx.stroke()
  }

  const renderMeteorShower = (ctx: CanvasRenderingContext2D) => {
    for (const p of meteorParticles.value) {
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

  const renderBlade = (ctx: CanvasRenderingContext2D, blade: BaybladeState) => {
    const { x, y, rotation, owner, hitFlash, hp, maxHp, radius } = blade
    const stats = statsFor(blade)
    const isPlayer = owner === 'player'

    // Outer metallic ring
    ctx.strokeStyle = '#555'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2)
    ctx.stroke()

    // Hub fill
    ctx.fillStyle = isPlayer ? '#1a4a8a' : '#8a1a1a'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()

    // Rotating shape
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    renderBladeShape(ctx, stats.top.shape, radius * 0.75, isPlayer)
    ctx.restore()

    // Hit flash overlay (white → red → orange → white)
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

    renderHealthRing(ctx, x, y, hp, maxHp, radius)
  }

  const renderBladeShape = (
    ctx: CanvasRenderingContext2D,
    shape: string, r: number, isPlayer: boolean
  ) => {
    ctx.fillStyle = isPlayer ? '#4488cc' : '#cc4444'
    ctx.strokeStyle = isPlayer ? '#6ab0ff' : '#ff6666'
    ctx.lineWidth = 1.5

    switch (shape) {
      case 'star': {
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2
          const rad = i % 2 === 0 ? r : r * 0.4
          if (i === 0) ctx.moveTo(Math.cos(angle) * rad, Math.sin(angle) * rad)
          else ctx.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
      }
      case 'triangle': {
        ctx.beginPath()
        for (let i = 0; i < 3; i++) {
          const angle = (i * Math.PI * 2) / 3 - Math.PI / 2
          if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r)
          else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
      }
      case 'circle': {
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.strokeStyle = isPlayer ? '#2266aa' : '#aa2222'
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
          ctx.stroke()
        }
        break
      }
      case 'square': {
        const h = r * 0.85
        ctx.beginPath()
        ctx.moveTo(-h, -h)
        ctx.lineTo(h, -h)
        ctx.lineTo(h, h)
        ctx.lineTo(-h, h)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
      }
      case 'cushion': {
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        const dotR = r * 0.2
        ctx.fillStyle = isPlayer ? '#66aaee' : '#ee6666'
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5
          ctx.beginPath()
          ctx.arc(Math.cos(angle) * r * 0.6, Math.sin(angle) * r * 0.6, dotR, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }
    }
  }

  const renderHealthRing = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    hp: number, maxHp: number,
    bladeRadius: number
  ) => {
    const hpPct = Math.max(0, Math.min(1, hp / maxHp))
    const ringR = bladeRadius + 8

    // Background ring
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(x, y, ringR, 0, Math.PI * 2)
    ctx.stroke()

    // HP arc
    const hue = hpPct * 120
    ctx.strokeStyle = `hsl(${hue}, 90%, 50%)`
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    const start = -Math.PI / 2
    const end = start + hpPct * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x, y, ringR, start, end)
    ctx.stroke()
    ctx.lineCap = 'butt'

    // Heart icon
    ctx.save()
    ctx.translate(x, y - 4)
    const hs = 3
    ctx.fillStyle = '#ff4488'
    ctx.beginPath()
    ctx.moveTo(0, hs * 0.6)
    ctx.bezierCurveTo(-hs, -hs * 0.2, -hs * 1.5, -hs * 1.2, 0, -hs * 0.4)
    ctx.bezierCurveTo(hs * 1.5, -hs * 1.2, hs, -hs * 0.2, 0, hs * 0.6)
    ctx.fill()
    ctx.restore()

    // HP number
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 9px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(Math.ceil(hp).toString(), x, y + 5)
  }

  const renderSelectionGlow = (ctx: CanvasRenderingContext2D, blade: BaybladeState) => {
    ctx.strokeStyle = '#ffdd00'
    ctx.lineWidth = 2
    ctx.shadowColor = '#ffdd00'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(blade.x, blade.y, blade.radius + 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  const renderDragIndicator = (ctx: CanvasRenderingContext2D, blade: BaybladeState) => {
    const { dx, dy } = dragVector.value
    const mag = dragMagnitude.value
    if (mag < 3) return

    const ratio = dragForceRatio.value

    ctx.save()
    // Pull line (dashed)
    ctx.strokeStyle = 'rgba(255,170,0,0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(blade.x, blade.y)
    ctx.lineTo(dragCurrent.value.x, dragCurrent.value.y)
    ctx.stroke()
    ctx.setLineDash([])

    // Launch arrow (opposite direction)
    const nx = -dx / mag
    const ny = -dy / mag
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

    // Arrowhead
    const headSize = 8
    const angle = Math.atan2(ny, nx)
    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(endX - Math.cos(angle - 0.4) * headSize, endY - Math.sin(angle - 0.4) * headSize)
    ctx.lineTo(endX - Math.cos(angle + 0.4) * headSize, endY - Math.sin(angle + 0.4) * headSize)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  // ─── Coordinate Conversion ───────────────────────────────────────────────

  const pixelToGame = (
    px: number, py: number, canvasSize: number
  ): { x: number; y: number } => {
    const center = canvasSize / 2
    const scale = canvasSize / (ARENA_RADIUS * 2 + 40)
    return {
      x: (px - center) / scale,
      y: (py - center) / scale
    }
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

    initGame,
    startMatch,
    beginDrag,
    updateDrag,
    releaseDrag,
    stopPhysics,
    spawnMeteorShower,

    render,
    pixelToGame,
    speed
  }
}

export default useBaybladeGame
