/**
 * The synced surface of gather's mobile design system.
 *
 * One entry per exported component. `specimen` is a JavaScript expression
 * evaluated inside a preview card, where `G` is `window.GatherMobile` and
 * `G.h` is `React.createElement` — cards are plain HTML with no build step, so
 * specimens are written without JSX.
 */

export const GROUPS = ['Auth', 'Groups', 'Shell', 'Settings']

/** Wrap a specimen in a fixed-height box, for components that position absolutely. */
const box = (height, child) =>
  `G.h(G.React.Fragment, null, G.h('div', { style: { position: 'relative', height: ${height}, width: '100%' } }, ${child}))`

export const COMPONENTS = [
  // ─────────────────────────────────────────────────────────── Auth ──
  {
    name: 'AuthButton',
    group: 'Auth',
    summary:
      'The three weights of action the front door needs — primary (ink), secondary (outlined), ghost.',
    pad: 24,
    specimen: `G.h(G.React.Fragment, null,
      G.h(G.AuthButton, { label: 'Sign in', onPress: function () {} }),
      G.h('div', { style: { height: 10 } }),
      G.h(G.AuthButton, { label: 'Create an account', variant: 'secondary', onPress: function () {} }),
      G.h('div', { style: { height: 10 } }),
      G.h(G.AuthButton, { label: 'Continue as guest', variant: 'ghost', onPress: function () {} }),
      G.h('div', { style: { height: 10 } }),
      G.h(G.AuthButton, { label: 'Signing in', busy: true, onPress: function () {} }),
      G.h('div', { style: { height: 10 } }),
      G.h(G.AuthButton, { label: 'Unavailable', disabled: true, onPress: function () {} })
    )`,
    types: `import type { StyleProp, ViewStyle } from 'react-native'

export interface AuthButtonProps {
  label: string
  onPress: () => void
  /**
   * \`primary\` is ink — the front door belongs to no Module, and the accent rule
   * makes the accent ink where you are looking at everything. None of the three
   * take a tint: a tinted "Sign in" claims the person is somewhere they have
   * not arrived yet.
   */
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Adds a spinner beside the label. The label stays, so width does not jump. */
  busy?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export declare function AuthButton(props: AuthButtonProps): JSX.Element
`,
    prompt: `# AuthButton

The three weights of action the front door needs.

\`\`\`jsx
<AuthButton label="Sign in" onPress={submit} />
<AuthButton label="Create an account" variant="secondary" onPress={goToSignUp} />
<AuthButton label="Forgot password" variant="ghost" onPress={goToReset} />
\`\`\`

## Variants

| Variant | Look | Use for |
| --- | --- | --- |
| \`primary\` (default) | Solid \`tokens.accent\`, label in \`tokens.onAccent\` | The one action the screen exists for |
| \`secondary\` | Transparent with a \`tokens.border\` hairline | The real alternative to it |
| \`ghost\` | Transparent, no border, tighter padding | Anything below those two |

## Rules

- **Never pass a Module tint to an auth button.** \`primary\` is ink by design
  (the accent rule): a tinted "Sign in" claims the reader is inside a Module
  they have not reached yet.
- **Use \`busy\`, not a swapped label.** It keeps the label and adds a spinner
  beside it, so the button does not change width mid-tap.
- \`busy\` implies inert — you do not also need \`disabled\` while submitting.
- The label is the accessible name; there is no separate \`accessibilityLabel\`.
`,
    usage: `import { AuthButton } from '@gather/mobile'

export function SignInActions({ submit, busy, goToSignUp }) {
  return (
    <>
      <AuthButton label="Sign in" busy={busy} onPress={submit} />
      <AuthButton
        label="Create an account"
        variant="secondary"
        onPress={goToSignUp}
      />
    </>
  )
}
`,
  },

  {
    name: 'AuthField',
    group: 'Auth',
    summary:
      'A labelled TextInput, with the platform autofill affordances as props and a reveal toggle for passwords.',
    pad: 24,
    specimen: `G.h(G.React.Fragment, null,
      G.h(G.AuthField, { label: 'Email', value: 'sam@example.com', placeholder: 'you@example.com', onChangeText: function () {} }),
      G.h('div', { style: { height: 16 } }),
      G.h(G.AuthField, { label: 'Password', value: 'hunter2hunter2', secure: true, onChangeText: function () {} }),
      G.h('div', { style: { height: 16 } }),
      G.h(G.AuthField, { label: 'Invite code', value: 'nope', invalid: true, onChangeText: function () {} })
    )`,
    types: `import type { TextInput, TextInputProps } from 'react-native'

export interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label: string
  /** Renders the reveal toggle and starts obscured. */
  secure?: boolean
  /** Marks the border with \`tokens.danger\` and is announced with the field. */
  invalid?: boolean
}

export declare const AuthField: React.ForwardRefExoticComponent<
  AuthFieldProps & React.RefAttributes<TextInput>
>
`,
    prompt: `# AuthField

A labelled text field. Plain React Native \`TextInput\` underneath — no wrapper
library — so the platform affordances are yours to pass.

\`\`\`jsx
<AuthField
  label="Email"
  value={email}
  onChangeText={setEmail}
  autoComplete="email"
  textContentType="emailAddress"
  keyboardType="email-address"
  autoCapitalize="none"
/>

<AuthField label="Password" secure value={password} onChangeText={setPassword} />
\`\`\`

## Rules

- **Pass \`autoComplete\` and \`textContentType\`.** They are the two halves of
  password-manager fill and save — \`autoComplete\` for Android, \`textContentType\`
  for iOS. Omitting them silently costs autofill.
- **\`secure\` gives you the reveal toggle for free.** Do not build your own; the
  toggle's accessible name is already translated.
- **\`invalid\` marks the border, it does not print the message.** Put the sentence
  in an \`AuthError\` above the actions.
- It forwards a ref to the underlying \`TextInput\`, so \`returnKeyType="next"\` plus
  \`onSubmitEditing={() => next.current?.focus()}\` works as usual.
- Every other \`TextInputProps\` passes straight through, except \`style\` — the
  field owns its own look.

## Anti-pattern

For an invite code, turn the keyboard's helpfulness off — it is generated hex,
not a word: \`autoCapitalize="none"\` and \`autoCorrect={false}\`.
`,
    usage: `import { useRef } from 'react'
import { AuthField } from '@gather/mobile'

export function Credentials({ email, setEmail, password, setPassword, submit }) {
  const passwordRef = useRef(null)

  return (
    <>
      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={setPassword}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
    </>
  )
}
`,
  },

  {
    name: 'AuthError',
    group: 'Auth',
    summary:
      'What went wrong, said once, above the actions. Renders nothing when the message is null.',
    pad: 24,
    specimen: `G.h(G.AuthError, { message: 'That email and password do not match an account.' })`,
    types: `export interface AuthErrorProps {
  /** \`null\` renders nothing, so this can sit unconditionally in a form. */
  message: string | null
}

export declare function AuthError(props: AuthErrorProps): JSX.Element | null
`,
    prompt: `# AuthError

One failure, stated above the actions.

\`\`\`jsx
<AuthError message={error} />
\`\`\`

## Rules

- **Render it unconditionally.** \`message={null}\` returns \`null\`, so
  \`{error && <AuthError …/>}\` is redundant — and the unconditional form is what
  keeps the live region mounted so a screen reader announces the change.
- It carries \`accessibilityLiveRegion="polite"\` and \`role="alert"\`. Without
  those, a screen-reader user taps Sign in, hears nothing, and reads the form as
  simply unresponsive.
- **One per form, above the actions.** Two error boxes on one screen means the
  reader has to work out which control each belongs to.
- The message is prose you supply, already in the reader's language.
`,
    usage: `import { AuthError, AuthButton } from '@gather/mobile'

export function SubmitRow({ error, submit, busy }) {
  return (
    <>
      <AuthError message={error} />
      <AuthButton label="Sign in" busy={busy} onPress={submit} />
    </>
  )
}
`,
  },

  {
    name: 'AuthLink',
    group: 'Auth',
    summary:
      'A sentence with one tappable half — "Don\'t have an account? Create one."',
    pad: 24,
    specimen: `G.h(G.React.Fragment, null,
      G.h(G.AuthLink, { prompt: "Don't have an account?", label: 'Create one', onPress: function () {} }),
      G.h(G.AuthLink, { label: 'Forgot your password?', onPress: function () {} })
    )`,
    types: `export interface AuthLinkProps {
  /** The inert half of the sentence. Omit for a bare link. */
  prompt?: string
  label: string
  onPress: () => void
}

export declare function AuthLink(props: AuthLinkProps): JSX.Element
`,
    prompt: `# AuthLink

A line of prose with one tappable half.

\`\`\`jsx
<AuthLink prompt="Don't have an account?" label="Create one" onPress={goToSignUp} />
<AuthLink label="Forgot your password?" onPress={goToReset} />
\`\`\`

## Rules

- **Use this instead of a third button.** The two real actions on a form screen
  are the submit and the way out of it; a third button-shaped thing dilutes both.
- **Only \`label\` is tappable.** The \`prompt\` half stays inert, and the touch
  target is padded to clear 44pt without making the whole sentence a control.
- The accessible name is the full sentence (\`prompt\` + \`label\`), announced with
  \`role="link"\` — so it is never read as one unlabelled control.
- Belongs in \`AuthScreen\`'s \`footer\`, which centres it.
`,
    usage: `import { AuthScreen, AuthLink } from '@gather/mobile'

export function SignIn({ goToSignUp, children }) {
  return (
    <AuthScreen
      heading="Welcome back"
      footer={
        <AuthLink
          prompt="Don't have an account?"
          label="Create one"
          onPress={goToSignUp}
        />
      }
    >
      {children}
    </AuthScreen>
  )
}
`,
  },

  {
    name: 'AuthScreen',
    group: 'Auth',
    summary:
      'The shape every pushed auth screen has: heading, explanation, fields, error, actions, footer.',
    pad: 0,
    specimen: `G.h(G.AuthScreen, {
      heading: 'Welcome back',
      subtitle: 'Sign in to get back to your household.',
      footer: G.h(G.AuthLink, { prompt: "Don't have an account?", label: 'Create one', onPress: function () {} })
    },
      G.h(G.AuthField, { label: 'Email', value: 'sam@example.com', onChangeText: function () {} }),
      G.h(G.AuthField, { label: 'Password', secure: true, value: 'hunter2hunter2', onChangeText: function () {} }),
      G.h(G.AuthButton, { label: 'Sign in', onPress: function () {} })
    )`,
    types: `import type { ReactNode } from 'react'

export interface AuthScreenProps {
  heading: string
  subtitle?: string
  children: ReactNode
  /** Sits below the actions, against the bottom of the scroll content. */
  footer?: ReactNode
}

export declare function AuthScreen(props: AuthScreenProps): JSX.Element
`,
    prompt: `# AuthScreen

The frame every pushed auth screen shares. Handles the keyboard, the scroll, and
the heading block; you supply the fields and the actions.

\`\`\`jsx
<AuthScreen
  heading="Welcome back"
  subtitle="Sign in to get back to your household."
  footer={<AuthLink prompt="New here?" label="Create an account" onPress={goToSignUp} />}
>
  <AuthField label="Email" value={email} onChangeText={setEmail} />
  <AuthField label="Password" secure value={password} onChangeText={setPassword} />
  <AuthError message={error} />
  <AuthButton label="Sign in" busy={busy} onPress={submit} />
</AuthScreen>
\`\`\`

## Rules

- **The heading goes here, not in the navigation header.** Leave the stack's
  header as a bare back chevron. A 28pt in-body heading survives being read at
  arm's length; a header title plus an in-body heading is the same words twice.
- **Children are the form body**, spaced 18pt apart automatically — do not add
  your own gaps between fields.
- \`footer\` is centred and pinned below the actions. Put the way out there.
- It already handles \`KeyboardAvoidingView\` and
  \`keyboardShouldPersistTaps="handled"\` — the latter is why the submit button
  works on the first tap while a field has focus. Do not nest another ScrollView.
`,
    usage: `import { AuthScreen, AuthField, AuthError, AuthButton, AuthLink } from '@gather/mobile'

export function SignInScreen(props) {
  return (
    <AuthScreen
      heading="Welcome back"
      subtitle="Sign in to get back to your household."
      footer={<AuthLink prompt="New here?" label="Create an account" onPress={props.goToSignUp} />}
    >
      <AuthField label="Email" value={props.email} onChangeText={props.setEmail} />
      <AuthField label="Password" secure value={props.password} onChangeText={props.setPassword} />
      <AuthError message={props.error} />
      <AuthButton label="Sign in" busy={props.busy} onPress={props.submit} />
    </AuthScreen>
  )
}
`,
  },

  {
    name: 'AuthUnavailable',
    group: 'Auth',
    summary: 'The gate shown when gather cannot be reached at all, with one retry.',
    pad: 0,
    specimen: `G.h(G.AuthUnavailable, { onRetry: function () {}, retrying: false })`,
    types: `export interface AuthUnavailableProps {
  onRetry: () => void
  /** Puts the retry button in its busy state. */
  retrying: boolean
}

export declare function AuthUnavailable(props: AuthUnavailableProps): JSX.Element
`,
    prompt: `# AuthUnavailable

The full-screen gate for "gather cannot be reached". Not a route — reaching it
is not navigating anywhere, and it has to be able to vanish the moment the
connection returns.

\`\`\`jsx
<AuthUnavailable onRetry={retry} retrying={retrying} />
\`\`\`

## Rules

- **Render it instead of the shell, not inside it.** Chrome drawn around an
  unreachable service is navigation that leads nowhere.
- It hides the native splash on layout, because on a cold start this can be the
  first screen mounted.
- Its words come from the shared message tree; there is no prop for them.
- It fills its parent (\`flex: 1\`) — give it a definite height or a flex parent.
`,
    usage: `import { AuthUnavailable } from '@gather/mobile'

export function Gate({ mode, retry, retrying, children }) {
  if (mode === 'unavailable') {
    return <AuthUnavailable onRetry={retry} retrying={retrying} />
  }
  return children
}
`,
  },

  {
    name: 'SocialSoon',
    group: 'Auth',
    summary:
      'Apple, Microsoft and Google — placed, named, and honestly marked as not here yet.',
    pad: 24,
    specimen: `G.h(G.SocialSoon, null)`,
    types: `export declare function SocialSoon(): JSX.Element
`,
    prompt: `# SocialSoon

The three social providers, staged and visibly not wired up.

\`\`\`jsx
<SocialSoon />
\`\`\`

## Rules

- **Takes no props.** The provider list, the wording and the "Soon" badge are all
  fixed — this is a statement about what is not built, not a configurable row.
- **The rows are deliberately inert**, at 62% opacity, with
  \`accessibilityState.disabled\` so a screen reader is told what sighted users
  can see. A control that looks live and does nothing is worse than one that
  says "Soon".
- **No brand marks, on purpose.** Apple's, Google's and Microsoft's sign-in
  buttons each carry mandatory asset and layout rules a greyed-out placeholder
  cannot satisfy. Do not add approximate logos.
- Place it below the primary actions on the front door, above the footer link.
`,
    usage: `import { WelcomeActions, SocialSoon } from '@gather/mobile'

export function FrontDoor() {
  return (
    <>
      <WelcomeActions />
      <SocialSoon />
    </>
  )
}
`,
  },

  {
    name: 'WelcomeActions',
    group: 'Auth',
    summary:
      'The three things you can do from the front door, in the order they deserve.',
    pad: 24,
    specimen: `G.h(G.WelcomeActions, null)`,
    types: `export declare function WelcomeActions(): JSX.Element
`,
    prompt: `# WelcomeActions

The front door's action block: Sign in (ink), Create an account (outlined), and
— only in builds pointing at a test Clerk instance — a dev sign-in shortcut.

\`\`\`jsx
<WelcomeActions />
\`\`\`

## Rules

- **Takes no props.** It owns its own navigation (\`/sign-in\`, \`/sign-up\`) and its
  own sign-in state.
- **The dev shortcut is gated on the publishable key's prefix, not \`__DEV__\`.**
  In any build pointing at a live instance it renders nothing extra, so you never
  need to conditionally exclude this component.
- Both actions are real destinations rather than sheets: the reset flow comes off
  the sign-in screen, and a sheet that pushes three more sheets is a stack in
  disguise.
`,
    usage: `import { AuthScreen, WelcomeActions, SocialSoon, CatalogueStrip } from '@gather/mobile'

export function Welcome() {
  return (
    <AuthScreen heading="gather" subtitle="Everything your household shares.">
      <CatalogueStrip />
      <WelcomeActions />
      <SocialSoon />
    </AuthScreen>
  )
}
`,
  },

  // ───────────────────────────────────────────────────────── Groups ──
  {
    name: 'GroupForms',
    group: 'Groups',
    summary:
      'The two ways into a Group you are not in yet: start one, or use an invite code.',
    pad: 20,
    specimen: `G.h(G.GroupForms, null)`,
    types: `export declare function GroupForms(): JSX.Element
`,
    prompt: `# GroupForms

Two cards — create a Group, or join one with an invite code.

\`\`\`jsx
<GroupForms />
\`\`\`

## Rules

- **Takes no props, and owns its own submission.** It calls the \`groups\`
  mutations directly and holds its own busy/failed state per form.
- **Use the same component in both places** it is needed — the Groups screen and
  the no-Group state. A second create surface is a second thing to keep in step.
- **A failure never shows what was thrown.** The backend throws English
  sentences; the shell may be in Dutch. The message comes from the shared tree
  and the thrown detail is logged. The trade — "invalid code" and "you are
  offline" reading the same — is deliberate.
- Failure is reported per form, not above the pair: both cards are on screen at
  once, and a floating message reads as belonging to whichever one you were not
  using.
- Submission is guarded against double-fire, because creating a Group is not
  idempotent — two taps would make two identically-named Groups.
`,
    usage: `import { GroupForms } from '@gather/mobile'

export function GroupsScreen() {
  return <GroupForms />
}
`,
  },

  {
    name: 'GroupPending',
    group: 'Groups',
    summary: 'Behind the door, before the Groups have arrived. No retry, by design.',
    pad: 0,
    specimen: `G.h(G.GroupPending, null)`,
    types: `export declare function GroupPending(): JSX.Element
`,
    prompt: `# GroupPending

The waiting state between "signed in" and "we know which Groups you are in".

\`\`\`jsx
<GroupPending />
\`\`\`

## Rules

- **There is no retry, deliberately.** The query behind it is a live
  subscription — it resolves itself when the connection does. A retry button here
  would be an invented affordance that does nothing.
- Not a route: reaching it is not navigating anywhere, and it must vanish the
  moment the query answers.
- It hides the native splash on layout — on a cold start with a retained session
  this is the first screen mounted.
- Fills its parent (\`flex: 1\`).
`,
    usage: `import { GroupPending, NoGroup } from '@gather/mobile'

export function GroupGate({ groups, signOut, children }) {
  if (groups === undefined) return <GroupPending />
  if (groups.length === 0) return <NoGroup onSignOut={signOut} />
  return children
}
`,
  },

  {
    name: 'NoGroup',
    group: 'Groups',
    summary:
      'The one signed-in state with no Group at all — and the forms to fix it.',
    pad: 0,
    specimen: `G.h(G.NoGroup, { onSignOut: function () {} })`,
    types: `export interface NoGroupProps {
  onSignOut: () => void
}

export declare function NoGroup(props: NoGroupProps): JSX.Element
`,
    prompt: `# NoGroup

What a signed-in person sees when they belong to no Group. Renders \`GroupForms\`,
so the one screen with nothing else to do can fix itself.

\`\`\`jsx
<NoGroup onSignOut={signOut} />
\`\`\`

## Rules

- **Render it instead of the shell, never inside it.** A shell drawn around a
  Group that does not exist is chrome that leads nowhere.
- It means "you are in no Group", never "the list has not arrived" — show
  \`GroupPending\` for that.
- Sign-out is disabled while the service is unreachable, read from availability
  rather than passed in.
- It scrolls, and that is not decoration: two forms plus a keyboard do not fit on
  a small phone, and a create button under the fold is the same dead end in a
  different disguise.
`,
    usage: `import { NoGroup } from '@gather/mobile'

export function Shell({ groups, signOut, children }) {
  if (groups.length === 0) return <NoGroup onSignOut={signOut} />
  return children
}
`,
  },

  // ────────────────────────────────────────────────────────── Shell ──
  {
    name: 'ModulePlaceholder',
    group: 'Shell',
    summary:
      'The honest destination for a Module with no native workflow yet — hero in the group tint, then what will live there.',
    pad: 0,
    specimen: `G.h(G.ModulePlaceholder, { module: G.moduleById('recipes') })`,
    types: `import type { ModuleDef } from '@gather/core/modules'

export interface ModulePlaceholderProps {
  module: ModuleDef
  /** Also renders a native stack header titled with the Module's name. */
  showHeader?: boolean
}

export declare function ModulePlaceholder(props: ModulePlaceholderProps): JSX.Element
`,
    prompt: `# ModulePlaceholder

The destination for any Module that is listed but not built on the phone.

\`\`\`jsx
import { moduleById } from '@gather/core/modules'

<ModulePlaceholder module={moduleById('recipes')} />
<ModulePlaceholder module={module} showHeader />
\`\`\`

## Rules

- **Pass a \`ModuleDef\`, not an id.** Get it from \`moduleById(id)\` or \`MODULES\`.
- **The tint comes from the Module's group, automatically** — \`kitchen\`, \`money\`,
  \`home\` or \`tasting\`. Never override the hero colour; the four bands are what
  keep thirteen Modules from reading as confetti.
- \`showHeader\` is for a pushed route that needs a native title bar. A tab leaf
  leaves it off — the tab bar already names it.
- **A Module being live on the web is not evidence it is live here.** This is the
  one clear answer no matter where the Module was opened from.
- Its words come from the shared message tree, keyed by Module id.
`,
    usage: `import { moduleById } from '@gather/core/modules'
import { ModulePlaceholder } from '@gather/mobile'

export function ModuleRoute({ moduleId }) {
  const module = moduleById(moduleId)
  if (!module) return null
  return <ModulePlaceholder module={module} showHeader />
}
`,
  },

  {
    name: 'ModuleTab',
    group: 'Shell',
    summary:
      'The three tabs that are a Module and nothing else yet — one component, the same placeholder.',
    pad: 0,
    specimen: `G.h(G.ModuleTab, { tab: 'nutrition' })`,
    types: `import type { ModuleId } from '@gather/core/modules'

export interface ModuleTabProps {
  tab: Extract<ModuleId, 'recipes' | 'tasks' | 'nutrition'>
}

export declare function ModuleTab(props: ModuleTabProps): JSX.Element
`,
    prompt: `# ModuleTab

The tab-leaf wrapper for the three Modules nailed to the tab bar.

\`\`\`jsx
<ModuleTab tab="recipes" />
<ModuleTab tab="tasks" />
<ModuleTab tab="nutrition" />
\`\`\`

## Rules

- **Only those three ids type-check.** Five tab slots are fixed for everybody;
  that is a decision about navigation, not a claim about what is built.
- Each is a leaf — there is nothing to push into yet, so there is no stack and
  nothing for a Group switch to reset.
- **It exists so the three fixed tabs land on the exact same placeholder** as a
  Module opened from Home or All. Do not hand-roll a per-tab screen.
- It throws on an unknown id rather than rendering an empty square.
`,
    usage: `import { ModuleTab } from '@gather/mobile'

export default function NutritionTab() {
  return <ModuleTab tab="nutrition" />
}
`,
  },

  {
    name: 'CatalogueStrip',
    group: 'Shell',
    summary:
      'The thirteen Modules as tinted chips — the band under the pitch, where words lead and tints confirm.',
    pad: 20,
    specimen: `G.h(G.CatalogueStrip, null)`,
    types: `export declare function CatalogueStrip(): JSX.Element
`,
    prompt: `# CatalogueStrip

Every Module as a small tinted chip, ordered by group.

\`\`\`jsx
<CatalogueStrip />
\`\`\`

## Rules

- **Takes no props.** It renders the whole catalogue, in group order, so the four
  tints read as four bands rather than confetti.
- **Not interactive, on purpose.** A tile that looked tappable and was not would
  be a worse promise than one that plainly is not — and there is nothing behind
  it until you are signed in.
- Use it as the band *under* a pitch, where the words lead. When the catalogue
  itself is the pitch, use \`CatalogueGrid\`.
- Labels come from the shared message tree, so it is translated with the app.
`,
    usage: `import { CatalogueStrip } from '@gather/mobile'

export function Pitch() {
  return (
    <>
      <Text>Everything your household shares, in one place.</Text>
      <CatalogueStrip />
    </>
  )
}
`,
  },

  {
    name: 'CatalogueGrid',
    group: 'Shell',
    summary:
      'The same thirteen Modules as square tinted tiles, three to a row — the hero variant.',
    pad: 20,
    specimen: `G.h(G.CatalogueGrid, null)`,
    types: `export declare function CatalogueGrid(): JSX.Element
`,
    prompt: `# CatalogueGrid

The catalogue as the hero: thirteen square tiles, three to a row, in group order.

\`\`\`jsx
<CatalogueGrid />
\`\`\`

## Rules

- **Takes no props**, same as \`CatalogueStrip\`, and is equally non-interactive.
- **Use it where the catalogue *is* the pitch** and the words are a caption. Use
  \`CatalogueStrip\` where the words lead.
- Three to a row at any width (31.9% each plus two 8pt gaps) — do not wrap it in
  a fixed-width container that breaks that.
- \`CatalogueStrip\` and \`CatalogueGrid\` exist so the choice can be made from
  screenshots. One of them is expected to be deleted; do not build a third.
`,
    usage: `import { CatalogueGrid } from '@gather/mobile'

export function WelcomeHero() {
  return (
    <>
      <CatalogueGrid />
      <Text>Thirteen Modules. Every one of them in every Group.</Text>
    </>
  )
}
`,
  },

  {
    name: 'ConnectionLostBanner',
    group: 'Shell',
    summary:
      'An absolutely-positioned alert across the top when the service drops, with a retry.',
    pad: 0,
    specimen: box(
      200,
      `G.h(G.ConnectionLostBanner, null)`,
    ),
    types: `export declare function ConnectionLostBanner(): JSX.Element
`,
    prompt: `# ConnectionLostBanner

A top-of-screen alert for a connection that dropped after it had worked.

\`\`\`jsx
<View style={{ flex: 1 }}>
  {degraded ? <ConnectionLostBanner /> : null}
  {children}
</View>
\`\`\`

## Rules

- **It positions itself absolutely** (\`top: 0\`, \`zIndex: 10\`) and already adds the
  safe-area top inset. Put it inside a relatively-positioned or flex parent — not
  in a scroll view's content.
- **Takes no props.** Retry and busy state are read from availability, so every
  banner in the app retries the same way.
- Show it for a connection that was working and stopped. For "never connected",
  the gate (\`AuthUnavailable\`) is the right surface.
- It carries \`role="alert"\`, so it is announced when it appears.
`,
    usage: `import { View } from 'react-native'
import { ConnectionLostBanner } from '@gather/mobile'

export function Shell({ degraded, children }) {
  return (
    <View style={{ flex: 1 }}>
      {degraded ? <ConnectionLostBanner /> : null}
      {children}
    </View>
  )
}
`,
  },

  {
    name: 'QuickActionSheet',
    group: 'Shell',
    summary:
      'The Add tab\'s modal sheet — pick a quick action, capture it inline, or hand off to a full screen.',
    pad: 0,
    specimen: `G.h(G.QuickActionSheet, { visible: true, groupName: 'Kitchen Table', onClose: function () {} })`,
    types: `export interface QuickActionSheetProps {
  visible: boolean
  /** Named in the sheet's heading, so it is clear which Group you are adding to. */
  groupName: string
  onClose: () => void
}

export declare function QuickActionSheet(props: QuickActionSheetProps): JSX.Element
`,
    prompt: `# QuickActionSheet

The sheet behind the Add tab: a list of quick actions, some captured inline,
some handing off to a full screen.

\`\`\`jsx
<QuickActionSheet
  visible={open}
  groupName={group.name}
  onClose={() => setOpen(false)}
/>
\`\`\`

## Rules

- **Always mount it and drive \`visible\`** — it is a \`Modal\`, and its body only
  mounts while visible, so state resets between openings by design.
- **\`groupName\` is required.** Adding something without saying where it lands is
  the ambiguity this sheet exists to remove.
- Actions come from the shared quick-action list, not from props — that is what
  keeps the sheet and the Add tab in agreement.
- A \`handoff\` action closes the sheet and routes to the full create screen; a
  \`sheet\` action captures inline. You do not choose per call site.
`,
    usage: `import { useState } from 'react'
import { QuickActionSheet } from '@gather/mobile'

export function AddTab({ groupName }) {
  const [open, setOpen] = useState(true)
  return (
    <QuickActionSheet
      visible={open}
      groupName={groupName}
      onClose={() => setOpen(false)}
    />
  )
}
`,
  },

  // ─────────────────────────────────────────────────────── Settings ──
  {
    name: 'Segmented',
    group: 'Settings',
    summary:
      'A row of mutually exclusive choices, styled from tokens rather than the platform control.',
    pad: 24,
    specimen: `G.h(function SegmentedSpecimen() {
      var appearance = G.React.useState('light')
      var language = G.React.useState('en')
      return G.h(G.React.Fragment, null,
        G.h(G.Segmented, {
          options: [
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ],
          value: appearance[0],
          onChange: appearance[1]
        }),
        G.h('div', { style: { height: 16 } }),
        G.h(G.Segmented, {
          options: [
            { value: 'en', label: 'English' },
            { value: 'nl', label: 'Nederlands' }
          ],
          value: language[0],
          onChange: language[1]
        })
      )
    })`,
    types: `export interface SegmentedOption<Value extends string> {
  value: Value
  label: string
  /** Spoken instead of the label, where the label alone is not a sentence. */
  accessibilityLabel?: string
}

export interface SegmentedProps<Value extends string> {
  options: readonly SegmentedOption<Value>[]
  value: Value
  onChange: (next: Value) => void
}

export declare function Segmented<Value extends string>(
  props: SegmentedProps<Value>,
): JSX.Element
`,
    prompt: `# Segmented

A row of mutually exclusive choices. Generic over the value type, so the
selected value stays a union rather than \`string\`.

\`\`\`jsx
<Segmented
  options={[
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ]}
  value={preference}
  onChange={setPreference}
/>
\`\`\`

## Rules

- **Not the platform segmented control, deliberately.** A native picker cannot
  take the palette — including in the case that matters most, someone reading the
  appearance switch in the appearance they are about to leave.
- **Options share the width equally** (\`flex: 1\`), so keep labels short. Long
  labels truncate to one line rather than wrapping.
- **Selection is announced, not only drawn**: each option carries
  \`accessibilityState.selected\`, which is what makes this a set of choices to a
  screen reader instead of N buttons with different backgrounds.
- Add \`accessibilityLabel\` where a bare label is not a sentence ("Light" →
  "Light appearance").
- The selected option fills with \`tokens.accent\`; on a Group-less screen that is
  ink, per the accent rule.
- Every option clears 44pt minimum height. Do not shrink it.
`,
    usage: `import { Segmented } from '@gather/mobile'

export function AppearanceSetting({ preference, setPreference }) {
  return (
    <Segmented
      options={[
        { value: 'system', label: 'System', accessibilityLabel: 'Match the phone' },
        { value: 'light', label: 'Light', accessibilityLabel: 'Light appearance' },
        { value: 'dark', label: 'Dark', accessibilityLabel: 'Dark appearance' },
      ]}
      value={preference}
      onChange={setPreference}
    />
  )
}
`,
  },

  {
    name: 'SettingsCard',
    group: 'Settings',
    summary:
      'A titled card with a sentence saying what the setting does — the shape every utility surface is made of.',
    pad: 20,
    specimen: `G.h(G.React.Fragment, null,
      G.h(G.SettingsCard, { title: 'Appearance', description: 'How gather looks on this phone.' },
        G.h(G.Segmented, {
          options: [
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ],
          value: 'system',
          onChange: function () {}
        })
      ),
      G.h('div', { style: { height: 14 } }),
      G.h(G.SettingsCard, { title: 'Account' },
        G.h(G.SettingsRow, { label: 'Profile', onPress: function () {} }),
        G.h(G.SettingsRow, { label: 'Groups', onPress: function () {} }),
        G.h(G.SettingsRow, { label: 'Sign out', onPress: function () {}, disabled: true })
      )
    )`,
    types: `import type { ReactNode } from 'react'

export interface SettingsCardProps {
  title?: string
  /** What the setting means. Optional: a list of Groups explains itself. */
  description?: string
  children?: ReactNode
}

export declare function SettingsCard(props: SettingsCardProps): JSX.Element
`,
    prompt: `# SettingsCard

The card every utility surface above the tabs is made of.

\`\`\`jsx
<SettingsCard title="Appearance" description="How gather looks on this phone.">
  <Segmented options={options} value={value} onChange={onChange} />
</SettingsCard>
\`\`\`

## Rules

- **Use one card shape for Settings, Account and Groups.** Three subtly different
  cards read as three apps. This is the phone's counterpart to the web's
  \`SurfaceCard\` — the same idea, not a port; the phone owns its look.
- \`title\` and \`description\` are both optional. Drop the description when the
  content explains itself, such as a list of Groups.
- The title carries \`role="header"\`, so it is a navigable landmark.
- Children are spaced 10pt apart. Pair it with \`SettingsRow\` for navigation, or
  put any control inside.
`,
    usage: `import { SettingsCard, SettingsRow, Segmented } from '@gather/mobile'

export function SettingsScreen({ preference, setPreference, goTo }) {
  return (
    <>
      <SettingsCard title="Appearance" description="How gather looks on this phone.">
        <Segmented
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={preference}
          onChange={setPreference}
        />
      </SettingsCard>

      <SettingsCard title="Account">
        <SettingsRow label="Profile" onPress={() => goTo('profile')} />
        <SettingsRow label="Groups" onPress={() => goTo('groups')} />
      </SettingsCard>
    </>
  )
}
`,
  },

  {
    name: 'SettingsRow',
    group: 'Settings',
    summary: 'A row that goes somewhere else, with a decorative chevron.',
    pad: 20,
    specimen: `G.h(G.SettingsCard, { title: 'Account' },
      G.h(G.SettingsRow, { label: 'Profile', onPress: function () {} }),
      G.h(G.SettingsRow, { label: 'Groups', onPress: function () {} }),
      G.h(G.SettingsRow, { label: 'Language', onPress: function () {} }),
      G.h(G.SettingsRow, { label: 'Sign out', onPress: function () {}, disabled: true })
    )`,
    types: `export interface SettingsRowProps {
  label: string
  onPress: () => void
  disabled?: boolean
}

export declare function SettingsRow(props: SettingsRowProps): JSX.Element
`,
    prompt: `# SettingsRow

A row inside a \`SettingsCard\` that navigates somewhere.

\`\`\`jsx
<SettingsCard title="Account">
  <SettingsRow label="Profile" onPress={goToProfile} />
  <SettingsRow label="Sign out" onPress={signOut} disabled={!online} />
</SettingsCard>
\`\`\`

## Rules

- **The label is the accessible name; the chevron is hidden from screen readers.**
  Where the row leads is the label — the icon adds nothing to say out loud.
- **Belongs inside a \`SettingsCard\`.** It has no border or background of its own.
- \`disabled\` dims to 45% and is announced via \`accessibilityState\`. Use it for an
  action that needs a connection, rather than hiding the row — a row that
  disappears is harder to understand than one that is visibly unavailable.
- Clears 44pt minimum height.
`,
    usage: `import { SettingsCard, SettingsRow } from '@gather/mobile'

export function AccountCard({ goTo, signOut, online }) {
  return (
    <SettingsCard title="Account">
      <SettingsRow label="Profile" onPress={() => goTo('profile')} />
      <SettingsRow label="Sign out" onPress={signOut} disabled={!online} />
    </SettingsCard>
  )
}
`,
  },
]
