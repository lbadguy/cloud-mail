import { defineStore } from 'pinia'

const THEME_MODES = ['light', 'dark', 'system']
let systemThemeQuery = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
let systemThemeListenerStore
let systemThemeListener

export const useUiStore = defineStore('ui', {
    state: () => ({
        asideShow: window.innerWidth > 1024,
        accountShow: false,
        backgroundLoading: true,
        changeNotice: 0,
        writerRef: null,
        changePreview: 0,
        previewData: {},
        key: 0,
        dark: false,
        themeMode: '',
        asideCount: {
            email: 0,
            send: 0,
            sysEmail: 0
        }
    }),
    actions: {
        initializeTheme() {
            if (!THEME_MODES.includes(this.themeMode)) {
                this.themeMode = this.dark ? 'dark' : 'light'
            }

            if (typeof window !== 'undefined' && window.matchMedia) {
                systemThemeQuery = systemThemeQuery || window.matchMedia('(prefers-color-scheme: dark)')
                if (!systemThemeListener) {
                    systemThemeListener = () => {
                        if (systemThemeListenerStore?.themeMode === 'system') systemThemeListenerStore.applyTheme()
                    }
                    if (systemThemeQuery.addEventListener) {
                        systemThemeQuery.addEventListener('change', systemThemeListener)
                    } else {
                        systemThemeQuery.addListener?.(systemThemeListener)
                    }
                }
                systemThemeListenerStore = this
            }

            this.applyTheme()
        },
        setThemeMode(mode) {
            if (!THEME_MODES.includes(mode)) return
            this.themeMode = mode
            this.applyTheme()
        },
        applyTheme() {
            if (typeof document === 'undefined') return

            const root = document.documentElement
            const useSystemPreference = this.themeMode === 'system'
            const systemIsDark = useSystemPreference && systemThemeQuery
                ? systemThemeQuery.matches
                : false
            const isDark = this.themeMode === 'dark'
                || systemIsDark
            root.classList.toggle('dark', isDark)
            root.style.colorScheme = isDark ? 'dark' : 'light'
            const metaTag = document.getElementById('theme-color-meta')
            if (metaTag) {
                const isMobile = !window.matchMedia('(pointer: fine) and (hover: hover)').matches
                metaTag.setAttribute('content', isDark
                    ? (isMobile ? '#141414' : '#000000')
                    : (isMobile ? '#191A23' : '#F1F1F1'))
            }
            this.dark = isDark
        },
        showNotice() {
            this.changeNotice ++
        },
        previewNotice(data) {
            this.previewData = data
            this.changePreview ++
        }
    },
    persist: {
        pick: ['accountShow', 'dark', 'themeMode'],
    },
})
