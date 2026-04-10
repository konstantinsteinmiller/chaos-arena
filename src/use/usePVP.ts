// ─── Peer-to-Peer PvP Multiplayer ──────────────────────────────────────────
//
// Uses PeerJS (WebRTC) for direct browser-to-browser connections.
// Host creates a lobby, guest joins via invite link or CrazyGames invite.
//
// Feature-gated: only active when VITE_APP_PVP_ENABLED=true.

import { ref, computed, watch, type Ref } from 'vue'
import Peer, { type DataConnection } from 'peerjs'
import type { ArenaType } from '@/use/useSpinnerCampaign'
import type { SpinnerConfig } from '@/types/spinner'
import { isSdkActive } from '@/use/useCrazyGames'
import { isCrazyGamesFullRelease, isDebug } from '@/use/useMatch'

// ─── Feature Gate ──────────────────────────────────────────────────────────

export const isPvpEnabled = import.meta.env.VITE_APP_PVP_ENABLED === 'true'

// ─── Types ─────────────────────────────────────────────────────────────────

export type PvPRole = 'host' | 'guest' | null

export type PvPStatus =
  | 'idle'              // Not in PvP
  | 'creating'          // Host: creating peer
  | 'waiting'           // Host: waiting for guest to join
  | 'connecting'        // Guest: connecting to host
  | 'lobby'             // Both connected, configuring match
  | 'ready'             // Both players ready
  | 'playing'           // Match in progress
  | 'disconnected'      // Peer disconnected mid-match
  | 'expired'           // Invite expired (2 min timeout)
  | 'error'             // Connection error

export interface PvPGameConfig {
  arenaType: ArenaType
  teamSize: 1 | 2         // 1v1 or 2v2
  levelOne: boolean        // true = all parts forced to level 1
}

export type PvPMessage =
  | { type: 'game-config'; config: PvPGameConfig }
  | { type: 'player-ready'; team: SpinnerConfig[] }
  | { type: 'player-unready' }
  | { type: 'game-start'; firstTurn: 'host' | 'guest' }
  | { type: 'launch'; bladeIndex: number; ax: number; ay: number }
  | { type: 'surrender' }
  | { type: 'state-check'; hash: string; turn: number }
  | { type: 'ping' }
  | { type: 'pong' }

// ─── Constants ─────────────────────────────────────────────────────────────

const INVITE_EXPIRY_MS = 2 * 60 * 1000  // 2 minutes
const PING_INTERVAL_MS = 5000
const PONG_TIMEOUT_MS = 10000
const PEER_ID_PREFIX = 'chaos-arena-'

// ─── Composable ────────────────────────────────────────────────────────────

// Singleton state — shared across all components that call usePVP()
const status: Ref<PvPStatus> = ref('idle')
const role: Ref<PvPRole> = ref(null)
const peerId: Ref<string> = ref('')
const remotePeerId: Ref<string> = ref('')
const inviteLink: Ref<string> = ref('')
const expirySeconds: Ref<number> = ref(0)
const errorMessage: Ref<string> = ref('')
const gameConfig: Ref<PvPGameConfig> = ref({ arenaType: 'default', teamSize: 1, levelOne: false })
const hostReady: Ref<boolean> = ref(false)
const guestReady: Ref<boolean> = ref(false)
const hostTeam: Ref<SpinnerConfig[]> = ref([])
const guestTeam: Ref<SpinnerConfig[]> = ref([])
const remotePlayerName: Ref<string> = ref('')

let peer: Peer | null = null
let conn: DataConnection | null = null
let expiryTimer: ReturnType<typeof setInterval> | null = null
let expiryTimeout: ReturnType<typeof setTimeout> | null = null
let pingInterval: ReturnType<typeof setInterval> | null = null
let lastPongAt = 0

// Callbacks for game events — set by SpinnerArena
let onGameStart: ((firstTurn: 'host' | 'guest') => void) | null = null
let onRemoteLaunch: ((bladeIndex: number, ax: number, ay: number) => void) | null = null
let onRemoteSurrender: (() => void) | null = null
let onRemoteStateCheck: ((hash: string, turn: number) => void) | null = null

// ─── Helpers ───────────────────────────────────────────────────────────────

const generatePeerId = (): string =>
  PEER_ID_PREFIX + Math.random().toString(36).substring(2, 10)

const buildInviteLink = (hostId: string): string => {
  const base = window.location.href.split('?')[0].split('#')[0]
  return `${base}#/battle?pvp=${encodeURIComponent(hostId)}`
}

const cleanup = () => {
  if (expiryTimer) {
    clearInterval(expiryTimer)
    expiryTimer = null
  }
  if (expiryTimeout) {
    clearTimeout(expiryTimeout)
    expiryTimeout = null
  }
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
  if (conn) {
    try {
      conn.close()
    } catch {
    }
    conn = null
  }
  if (peer) {
    try {
      peer.destroy()
    } catch {
    }
    peer = null
  }
}

const resetState = () => {
  cleanup()
  status.value = 'idle'
  role.value = null
  peerId.value = ''
  remotePeerId.value = ''
  inviteLink.value = ''
  expirySeconds.value = 0
  errorMessage.value = ''
  hostReady.value = false
  guestReady.value = false
  hostTeam.value = []
  guestTeam.value = []
  remotePlayerName.value = ''
}

const send = (msg: PvPMessage) => {
  try {
    if (conn && conn.open) {
      conn.send(msg)
    }
  } catch (e) {
    console.warn('[PvP] Send failed:', e)
  }
}

const startPingLoop = () => {
  lastPongAt = Date.now()
  pingInterval = setInterval(() => {
    if (!conn || !conn.open) return
    send({ type: 'ping' })
    // Check if we missed pongs
    if (Date.now() - lastPongAt > PONG_TIMEOUT_MS && status.value === 'playing') {
      status.value = 'disconnected'
      errorMessage.value = 'Connection lost — opponent not responding.'
      cleanup()
    }
  }, PING_INTERVAL_MS)
}

const startExpiryCountdown = () => {
  const start = Date.now()
  expirySeconds.value = Math.ceil(INVITE_EXPIRY_MS / 1000)

  expiryTimer = setInterval(() => {
    const elapsed = Date.now() - start
    expirySeconds.value = Math.max(0, Math.ceil((INVITE_EXPIRY_MS - elapsed) / 1000))
    if (expirySeconds.value <= 0 && expiryTimer) {
      clearInterval(expiryTimer)
      expiryTimer = null
    }
  }, 1000)

  expiryTimeout = setTimeout(() => {
    if (status.value === 'waiting') {
      status.value = 'expired'
      errorMessage.value = 'Invite expired.'
      cleanup()
    }
  }, INVITE_EXPIRY_MS)
}

// ─── Message Handler ───────────────────────────────────────────────────────

const handleMessage = (msg: PvPMessage) => {
  try {
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return
    switch (msg.type) {
      case 'game-config':
        gameConfig.value = msg.config
        break

      case 'player-ready':
        if (role.value === 'host') {
          guestReady.value = true
          guestTeam.value = msg.team
        } else {
          hostReady.value = true
          hostTeam.value = msg.team
        }
        break

      case 'player-unready':
        if (role.value === 'host') {
          guestReady.value = false
        } else {
          hostReady.value = false
        }
        break

      case 'game-start':
        status.value = 'playing'
        onGameStart?.(msg.firstTurn)
        break

      case 'launch':
        onRemoteLaunch?.(msg.bladeIndex, msg.ax, msg.ay)
        break

      case 'surrender':
        onRemoteSurrender?.()
        break

      case 'state-check':
        onRemoteStateCheck?.(msg.hash, msg.turn)
        break

      case 'ping':
        send({ type: 'pong' })
        break

      case 'pong':
        lastPongAt = Date.now()
        break
    }
  } catch (e) {
    console.error('[PvP] Error handling message:', e)
  }
}

// ─── Connection Setup ──────────────────────────────────────────────────────

const setupConnection = (connection: DataConnection) => {
  conn = connection

  conn.on('open', () => {
    if (role.value === 'host') {
      // Stop expiry countdown
      if (expiryTimer) {
        clearInterval(expiryTimer)
        expiryTimer = null
      }
      if (expiryTimeout) {
        clearTimeout(expiryTimeout)
        expiryTimeout = null
      }
      expirySeconds.value = 0
      status.value = 'lobby'
      // Send current game config to guest
      send({ type: 'game-config', config: gameConfig.value })
    } else {
      status.value = 'lobby'
    }
    startPingLoop()
  })

  conn.on('data', (data: unknown) => {
    handleMessage(data as PvPMessage)
  })

  conn.on('close', () => {
    if (status.value === 'playing') {
      status.value = 'disconnected'
      errorMessage.value = 'Opponent disconnected.'
    } else if (status.value !== 'idle') {
      status.value = 'disconnected'
      errorMessage.value = 'Connection closed.'
    }
    cleanup()
  })

  conn.on('error', (err: any) => {
    console.error('[PvP] Connection error:', err)
    status.value = 'error'
    errorMessage.value = `Connection error: ${err.type || err.message || 'unknown'}`
    cleanup()
  })
}

// ─── Public API ────────────────────────────────────────────────────────────

const usePVP = () => {
  console.log('window?.location.host: ', window?.location.host, window?.location.hostname)
  const canShowPvP = computed(() =>
    isPvpEnabled && ((isSdkActive.value && isCrazyGamesFullRelease) || isDebug.value || window?.location.host === 'konstantinsteinmiller.github.io')
  )

  const bothReady = computed(() => hostReady.value && guestReady.value)

  /** Host: create a lobby and wait for a guest */
  const createLobby = (config: PvPGameConfig) => {
    try {
      resetState()
      role.value = 'host'
      status.value = 'creating'
      gameConfig.value = config

      const id = generatePeerId()
      peer = new Peer(id)

      peer.on('open', (openId: string) => {
        peerId.value = openId
        inviteLink.value = buildInviteLink(openId)
        status.value = 'waiting'
        startExpiryCountdown()
      })

      peer.on('connection', (connection: DataConnection) => {
        setupConnection(connection)
      })

      peer.on('error', (err: any) => {
        console.error('[PvP] Peer error:', err)
        // If ID is taken, retry with a new one
        if (err.type === 'unavailable-id') {
          cleanup()
          createLobby(config)
          return
        }
        status.value = 'error'
        errorMessage.value = `Peer error: ${err.type || err.message || 'unknown'}`
      })
    } catch (e) {
      console.error('[PvP] Failed to create lobby:', e)
      status.value = 'error'
      errorMessage.value = 'Failed to create lobby. Please try again.'
    }
  }

  /** Guest: join a host's lobby by their peer ID */
  const joinLobby = (hostPeerId: string) => {
    try {
      resetState()
      role.value = 'guest'
      status.value = 'connecting'
      remotePeerId.value = hostPeerId

      peer = new Peer(generatePeerId())

      peer.on('open', () => {
        const connection = peer!.connect(hostPeerId, { reliable: true })
        setupConnection(connection)
      })

      peer.on('error', (err: any) => {
        console.error('[PvP] Peer error:', err)
        if (err.type === 'peer-unavailable') {
          status.value = 'error'
          errorMessage.value = 'Lobby not found — invite may have expired.'
        } else {
          status.value = 'error'
          errorMessage.value = `Connection failed: ${err.type || err.message || 'unknown'}`
        }
      })
    } catch (e) {
      console.error('[PvP] Failed to join lobby:', e)
      status.value = 'error'
      errorMessage.value = 'Failed to join lobby. Please try again.'
    }
  }

  /** Mark local player as ready with their team selection */
  const setReady = (team: SpinnerConfig[]) => {
    if (role.value === 'host') {
      hostReady.value = true
      hostTeam.value = team
    } else {
      guestReady.value = true
      guestTeam.value = team
    }
    send({ type: 'player-ready', team })
  }

  /** Unmark local player as ready */
  const setUnready = () => {
    if (role.value === 'host') {
      hostReady.value = false
    } else {
      guestReady.value = false
    }
    send({ type: 'player-unready' })
  }

  /** Host only: start the match once both players are ready */
  const startMatch = () => {
    if (role.value !== 'host' || !bothReady.value) return
    const firstTurn = Math.random() < 0.5 ? 'host' : 'guest' as const
    status.value = 'playing'
    send({ type: 'game-start', firstTurn })
    onGameStart?.(firstTurn)
  }

  /** Send a launch command to the remote peer */
  const sendSurrender = () => {
    send({ type: 'surrender' })
  }

  const sendStateCheck = (hash: string, turn: number) => {
    send({ type: 'state-check', hash, turn })
  }

  const sendLaunch = (bladeIndex: number, ax: number, ay: number) => {
    send({ type: 'launch', bladeIndex, ax, ay })
  }

  /** Host: update game config and notify guest */
  const updateGameConfig = (config: PvPGameConfig) => {
    gameConfig.value = config
    // Un-ready both players when config changes
    hostReady.value = false
    guestReady.value = false
    if (role.value === 'host') {
      send({ type: 'game-config', config })
    }
  }

  /** Register game event callbacks */
  const registerCallbacks = (
    onStart: (firstTurn: 'host' | 'guest') => void,
    onLaunch: (bladeIndex: number, ax: number, ay: number) => void,
    onSurrender?: () => void,
    onStateCheck?: (hash: string, turn: number) => void
  ) => {
    onGameStart = onStart
    onRemoteLaunch = onLaunch
    onRemoteSurrender = onSurrender ?? null
    onRemoteStateCheck = onStateCheck ?? null
  }

  /** Generate a WhatsApp share link */
  const whatsappShareLink = computed(() => {
    if (!inviteLink.value) return ''
    const text = encodeURIComponent(`Join my Chaos Arena PvP battle!\n${inviteLink.value}`)
    return `https://wa.me/?text=${text}`
  })

  /** Copy invite link to clipboard */
  const copyInviteLink = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(inviteLink.value)
      return true
    } catch {
      return false
    }
  }

  /** Try to use CrazyGames SDK invite if available */
  const sendCrazyGamesInvite = () => {
    try {
      const sdk = (window as any).CrazyGames?.SDK
      if (sdk?.game?.inviteLink) {
        sdk.game.inviteLink({ url: inviteLink.value })
      }
    } catch (e) {
      console.warn('[PvP] CrazyGames invite failed:', e)
    }
  }

  /** Check URL for incoming PvP invite on page load */
  const checkInviteFromUrl = (): string | null => {
    const hash = window.location.hash
    const match = hash.match(/[?&]pvp=([^&]+)/)
    if (match) {
      // Clean the URL param so it doesn't re-trigger
      const cleanHash = hash.replace(/[?&]pvp=[^&]+/, '').replace(/\?$/, '')
      history.replaceState(null, '', window.location.pathname + cleanHash)
      return decodeURIComponent(match[1])
    }
    return null
  }

  /** Leave the PvP session entirely */
  const leavePvP = () => {
    resetState()
  }

  return {
    // State
    status,
    role,
    peerId,
    inviteLink,
    expirySeconds,
    errorMessage,
    gameConfig,
    hostReady,
    guestReady,
    hostTeam,
    guestTeam,
    remotePlayerName,
    canShowPvP,
    bothReady,
    whatsappShareLink,

    // Actions
    createLobby,
    joinLobby,
    setReady,
    setUnready,
    startMatch,
    sendLaunch,
    sendSurrender,
    sendStateCheck,
    updateGameConfig,
    registerCallbacks,
    copyInviteLink,
    sendCrazyGamesInvite,
    checkInviteFromUrl,
    leavePvP
  }
}

export default usePVP
