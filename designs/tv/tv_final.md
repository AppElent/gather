# Gather TV: dashboard, sign-in and household picker: final (APP-645)

Eric approved this on 27 Nov 2026 ("Goed, bouwen"). It is part of the APP-641 epic and is built in APP-647 (dashboard) and the sign-in issue.

- **Canvas:** https://claude.ai/artifact/MmHpssSZiFAhXoXPxLpnbx ("Gather — TV").
- **Source:** [`tv_final/`](tv_final/). Every artboard imports `TV.dc.html`, which takes these props:
  - `screen`: `signin`, `picker`, `dash`, `dashEmpty` or `dashOffline`
  - `theme`: light or dark
  - `lang`: nl or en
  - `focus`: whether the focus state is shown
  - `safe`: whether the overscan guide is drawn
- **Data model:** none. The household choice is stored locally on the TV.

## Rules

- **Size:** 1920×1080, tvOS. All content sits inside the safe area: 80 px at the sides, 60 px at the top and bottom.
- **Type for 3 m:** titles 64–76 px, headings 38–40 px, body 29–32 px, and nothing smaller than 24 px.
- **Tints:** from `@gather/core/module-tints`. Agenda and Tasks use home (amber), Meals and Groceries use kitchen (teal). Text stays ink, and the current event gets the home wash.
- **Focus:** the focused element scales to 1.08 and gets an inverted fill (ink background, ground text) and a soft shadow.
- **Read-only:** the TV only reads. Updates arrive live through Convex. Finances, energy, notes and loyalty cards stay off the TV.

## Artboards

| Artboard | What it shows |
| --- | --- |
| `Main`, `Dash-Dark` | Dashboard: the day and the clock, and the household switcher top right, which is the only focusable element. Agenda covers today and tomorrow. Meals shows tonight's dinner and the rest of the week. Groceries shows the first five items and "+ N more". Tasks shows what is due today, with late tasks in the danger colour. |
| `Dash-Safe` | The same dashboard, with the safe area drawn as a dashed line. |
| `Dash-Empty`, `Dash-Empty-Dark` | Each panel says what is missing: "Nothing on the calendar", "Nothing planned yet · plan it on your phone", "The list is empty" and "No tasks today". |
| `Dash-Offline` | No connection: the TV keeps the last state and says when it is from ("No connection. This is how it was at 17:20."). |
| `SignIn`, `SignIn-Dark` | The Clerk device flow (APP-644): a QR code and a code, three steps, and "New code" focused, with an expiry line. The verification URL is a placeholder until Clerk gives the real one. |
| `Picker`, `Picker-Dark` | "Which household?": one card per household you are a member of, with the first one focused. With only one household, this screen is skipped. You switch later from the button top right. |
| `Focus-Off` | The picker without focus, for comparison. |

Out of scope: the cooking view and the ambient mode, which are later issues.
