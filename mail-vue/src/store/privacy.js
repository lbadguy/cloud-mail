import {defineStore} from 'pinia'
import {useUserStore} from './user.js'
import {privacyAccountKey, isReadingProtected} from '../utils/privacy-preferences.js'

export const usePrivacyStore = defineStore('mailPrivacy', {
    state: () => ({preferences: {}}),
    getters: {
        accountKey() {
            const user = useUserStore().user
            return privacyAccountKey(user)
        },
        protectReading() {
            return isReadingProtected(this.preferences, this.accountKey)
        },
    },
    actions: {
        setProtectReading(value) {
            this.preferences[this.accountKey] = value !== false
        },
    },
    persist: {pick: ['preferences']},
})
