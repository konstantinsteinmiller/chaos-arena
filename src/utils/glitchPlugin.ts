import { glitchLicenseStatus } from '@/use/useGlitchLicense'

const HEARTBEAT_INTERVAL_MS = 60_000

const glitchPlugin = () => {
  const installId = new URLSearchParams(window.location.search).get('install_id')
  if (!installId) {
    console.warn('[Glitch] No install_id found in URL, heartbeat will not be sent.')
    glitchLicenseStatus.value = 'denied'
    return
  }

  const TEST_TITLE_ID = import.meta.env.VITE_APP_GLITCH_TEST_INSTALL_ID
  const TITLE_ID = import.meta.env.VITE_APP_GLITCH_INSTALL_ID
  const GLITCH_TOKEN = import.meta.env.VITE_APP_GLITCH_TOKEN
  const isProduction = import.meta.env.VITE_NODE_ENV === 'production'
  const titleId = isProduction ? TITLE_ID : TEST_TITLE_ID

  if (!titleId || !GLITCH_TOKEN) {
    console.warn(`[Glitch] Missing configuration for heartbeat plugin. titleId: ${titleId}, token: ${!!GLITCH_TOKEN}. Heartbeat will not be sent.`)
    glitchLicenseStatus.value = 'denied'
    return
  }

  const validate = async () => {
    try {
      const response = await fetch(`https://api.glitch.fun/api/titles/${titleId}/installs/${installId}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${GLITCH_TOKEN}` }
      })
      glitchLicenseStatus.value = response.ok ? 'ok' : 'denied'
    } catch {
      glitchLicenseStatus.value = 'denied'
    }
  }

  const sendPayoutHeartbeat = () => {
    fetch(`https://api.glitch.fun/api/titles/${titleId}/installs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GLITCH_TOKEN}`
      },
      body: JSON.stringify({ user_install_id: installId, platform: 'web' })
    }).catch(() => {
    })
  }

  validate().then(() => {
    if (glitchLicenseStatus.value !== 'ok') return
    sendPayoutHeartbeat()
    setInterval(sendPayoutHeartbeat, HEARTBEAT_INTERVAL_MS)
  })
}

export default glitchPlugin
