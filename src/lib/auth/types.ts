import type React from 'react'

export type SlotClassNames<Slot extends string> = Partial<Record<Slot, string>>

export interface SocialProvider {
  id: string // e.g. "apple"
  label: string
  strategy: `oauth_${string}`
}

export interface AuthConfig {
  appName: string
  logo?: React.ReactNode
  paths: {
    signIn: string
    signUp: string
    forgotPassword: string
    /** Where a social provider sends the browser back (`/sso-callback`). */
    ssoCallback: string
    afterAuth: string
    account: string
  }
  features: { forgotPassword: boolean }
  socialProviders: SocialProvider[]
}
