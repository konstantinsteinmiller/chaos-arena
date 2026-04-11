import { createApp, watch } from 'vue'
import router from '@/router'
import '@/assets/css/tailwind.css'
import '@/assets/css/index.sass'
import { createI18n } from 'vue-i18n'
import translations from '@/i18n'
import { GAME_USER_LANGUAGE } from '@/utils/constants.ts'
import { LANGUAGES } from '@/utils/enums'
import { initCrazyGames, crazyLocale } from '@/use/useCrazyGames'
import useUser from '@/use/useUser'

const bootstrap = async () => {
  // CrazyGames SDK must initialize *before* App (and its transitive module
  // graph) loads — several composables read from localStorage at module
  // load time, and we want them to see SDK-hydrated values.
  await initCrazyGames()

  // If CrazyGames reported a player locale we support, use it as the
  // initial i18n locale. We deliberately overwrite the sessionStorage hint
  // so subsequent boots in the same tab keep matching the CG-side
  // preference rather than a stale browser default.
  const cgLocale = crazyLocale.value
  if (cgLocale && LANGUAGES.includes(cgLocale)) {
    sessionStorage.setItem(GAME_USER_LANGUAGE, cgLocale)
  }

  const { default: App } = await import('@/App.vue')

  const userLanguage = sessionStorage.getItem(GAME_USER_LANGUAGE) || navigator.language?.split('-')[0]

  const i18n: any = createI18n({
    locale: userLanguage || 'en', // set locale
    fallbackLocale: 'en', // set fallback locale
    messages: translations,
    missingWarn: false,
    fallbackWarn: false
  })

  // If the SDK gave us a supported locale, push it through the user store
  // so userLanguage (and anything reactive to it) lines up with i18n. We
  // wait for IndexedDB hydration to finish first so we don't race with the
  // saved-preference loader and end up writing then immediately overwriting.
  if (cgLocale && LANGUAGES.includes(cgLocale)) {
    const { userLanguage: storedLanguage, setSettingValue } = useUser()
    const { isDbInitialized } = await import('@/use/useMatch')
    const stop = watch(
      isDbInitialized,
      (ready) => {
        if (!ready) return
        stop()
        if (storedLanguage.value !== cgLocale) {
          setSettingValue('language', cgLocale)
        }
        i18n.global.locale.value = cgLocale
      },
      { immediate: true }
    )
  }

  // Sync i18n locale when IndexedDB hydrates the saved language on reload
  // (skip when CrazyGames already controls locale)
  if (!(cgLocale && LANGUAGES.includes(cgLocale))) {
    const { userLanguage: storedLang } = useUser()
    const { isDbInitialized: dbReady } = await import('@/use/useMatch')
    const stopLangSync = watch(
      dbReady,
      (ready) => {
        if (!ready) return
        stopLangSync()
        if (storedLang.value && LANGUAGES.includes(storedLang.value)) {
          i18n.global.locale.value = storedLang.value
        }
      },
      { immediate: true }
    )
  }

  const app = createApp(App)

  app.use(router)
  app.use(i18n)

  app.mount('#app')
}

bootstrap()
