import { useClerk, useUser } from '@clerk/react'
import { Bug, Ellipsis, Languages, LogOut, Sparkles, UserRound } from 'lucide-react'
import { fmt, type Locale, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { MenuButton, MenuLink, MenuSeparator, ShellMenu } from './ShellMenu'

/** Two locales, so language is a switch: the item names the one it goes to. */
const NEXT_LOCALE: Record<Locale, Locale> = { en: 'nl', nl: 'en' }

export interface AccountMenuProps {
  /** `sidebar`: the row at its foot. `round`: the 44 px button a phone-width page carries. */
  variant: 'sidebar' | 'round'
  onOpenGather: () => void
  onReportIssue: () => void
}

/**
 * You, and what is about you rather than the page: your Account, the
 * language, Ask Gather, reporting a problem, and signing out. It replaced the
 * topbar, which carried all of these beside a second copy of the page title.
 */
export function AccountMenu({
  variant,
  onOpenGather,
  onReportIssue,
}: AccountMenuProps) {
  const { locale, messages, setLocale } = useI18n()
  const { accountMenu } = messages.shell
  const { user } = useUser()
  const { signOut } = useClerk()
  const name =
    user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ''
  const initials = initialsOf(user?.fullName, user?.primaryEmailAddress?.emailAddress)
  const next = NEXT_LOCALE[locale]

  const avatar = (size: string) => (
    <span
      className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--ink)]`}
    >
      {initials}
    </span>
  )

  return (
    <ShellMenu
      label={accountMenu.label}
      trigger={
        variant === 'sidebar' ? (
          <>
            {avatar('h-7 w-7')}
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <Ellipsis className="h-[18px] w-[18px]" aria-hidden="true" />
          </>
        ) : (
          initials
        )
      }
      triggerClassName={
        variant === 'sidebar'
          ? 'flex h-12 w-full items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-left text-[15px] text-[var(--ink)] hover:bg-[var(--surface)] aria-expanded:bg-[var(--surface)]'
          : 'grid h-11 w-11 place-items-center rounded-full bg-[var(--surface)] text-[13px] font-bold text-[var(--ink)]'
      }
      menuClassName={
        variant === 'sidebar'
          ? 'bottom-full left-0 mb-2 w-64'
          : 'top-full right-0 mt-2 w-64'
      }
    >
      <MenuLink link={linkTo('account')}>
        <UserRound className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
        {accountMenu.account}
      </MenuLink>
      <MenuButton onSelect={() => setLocale(next)}>
        <Languages className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
        <span lang={next}>
          {fmt(accountMenu.switchLanguage, {
            language: messages.settings.language.names[next],
          })}
        </span>
      </MenuButton>
      <MenuSeparator />
      <MenuButton onSelect={onOpenGather}>
        <Sparkles className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
        {accountMenu.askGather}
      </MenuButton>
      <MenuButton onSelect={onReportIssue}>
        <Bug className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
        {accountMenu.reportIssue}
      </MenuButton>
      <MenuSeparator />
      <MenuButton onSelect={() => void signOut()}>
        <LogOut className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
        {messages.common.actions.signOut}
      </MenuButton>
    </ShellMenu>
  )
}

/** "Test User" → "TU"; an email → its first letter; nobody yet → "?". */
export function initialsOf(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length > 0)
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
  return (email?.[0] ?? '?').toUpperCase()
}
