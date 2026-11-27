/**
 * Adding to a grocery list (APP-664; `designs/groceries/composer_final.md`):
 * the bar pinned to the bottom of the list, and the keyboard composer it
 * opens. The shell is `ui/keyboard-composer.tsx`; this file is the item's part
 * of it, as `AddTaskComposer.tsx` is a task's.
 *
 * - **The line reads its own amount and aisle**, on the phone and offline.
 *   The amount is highlighted where it stands; both show on their chips, and
 *   a tap changes them (`groceryDraft.ts` decides which wins).
 * - **Completions sit above the card** (APP-311): a tap adds one, or its
 *   amount to the item already open (APP-427).
 * - **Saving keeps it open**, empty and focused. The line under the chips says
 *   what this opening added, and takes back the last of it.
 * - **A failed save keeps its item**: it is asked about, and goes again under
 *   the same key, so a create that did land is not made twice.
 * - **One size.** Nothing in an item needs the room, so there is no expand.
 */
import { useAuth } from '@clerk/expo'
import type { MenuAction } from '@expo/ui/community/menu'
import {
  capitalise,
  GROCERY_AISLES,
  type GroceryUnit,
  groceryLineText,
  isGroceryAisle,
} from '@gather/core/groceries'
import { readTaskRefusal } from '@gather/core/refusals'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { MODULE_ICONS, UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../theme/tokens'
import {
  draftKey,
  forgetSentDraft,
  holdDraft,
  keepDraft,
  keptDraft,
  pendingSave,
} from '../../ui/composer-drafts'
import {
  type ComposerChip,
  type ComposerMoreItem,
  type ComposerTitleField,
  KeyboardComposer,
} from '../../ui/keyboard-composer'
import { ModuleTile } from '../../ui/module-tile'
import { markFresh } from './freshTasks'
import { OFFERED_UNITS, useGroceryAmountText, useTypedAisle } from './GroceryFields'
import { GroceryCompletions, type GroceryPick } from './GrocerySuggestions'
import {
  addedSummary,
  amountSpans,
  type ComposedGrocery,
  composedGrocery,
  emptyGroceryDraft,
  type GroceryDraft,
  isGroceryDirty,
  nextGroceryDraft,
  quantityChoices,
  withAmount,
  withLine,
} from './groceryDraft'
import { groceryListsOf, onShoppingList } from './groceryList'
import { TASK_ICONS } from './icons'
import { QuickAddInput } from './QuickAddParts'
import { quickAddTarget } from './quickAdd'
import {
  type AddedStaple,
  type GroceryDetails,
  useTaskActions,
  useTaskList,
  useTaskLists,
  type WholeAmount,
} from './store'
import type { Task } from './types'

const PILL = 48
const BAR_PADDING = 10

/** The room the bar takes above the tab bar: its pill and its padding. */
export const GROCERY_BAR_HEIGHT = PILL + 2 * BAR_PADDING

/** The bar, and the composer while it is open. */
export function AddGrocery({ listId }: { listId: string }) {
  const { group } = useGroup()
  const { userId } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return open ? (
    <GroceryComposerCard
      draftId={draftKey(userId, group._id, `groceries:${listId}`)}
      listId={listId}
      onClose={() => setOpen(false)}
      onOpenItem={(taskId) => {
        setOpen(false)
        router.push({
          pathname: '/all/tasks/task/[taskId]',
          params: { taskId },
        })
      }}
    />
  ) : (
    <GroceryBar onPress={() => setOpen(true)} />
  )
}

function GroceryBar({ onPress }: { onPress: () => void }) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const words = useI18n().t.composer.grocery
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: tokens.ground,
          borderTopColor: tokens.hair,
          paddingBottom: insets.bottom + BAR_PADDING,
        },
      ]}
    >
      <Pressable
        testID="add-grocery"
        accessibilityRole="button"
        accessibilityLabel={words.barLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: pressed ? tokens.surface2 : tokens.surface },
        ]}
      >
        <Text numberOfLines={1} style={[styles.pillText, { color: tokens.muted }]}>
          {words.bar}
        </Text>
        <View style={[styles.disc, { backgroundColor: tokens.accent }]}>
          <UI_ICONS.Plus size={18} strokeWidth={2.6} color={tokens.onAccent} />
        </View>
      </Pressable>
    </View>
  )
}

/** One thing this opening did, and how to take it back. */
interface Added {
  key: string
  name: string
  /** Said instead of "{name} added": an open item whose amount grew. */
  text?: string
  /** The list its undo reads, for an open item that was changed. */
  listId?: string
  /** That open item: one undo of it at a time. */
  itemId?: string
  undo: () => Promise<unknown>
}

/** A save on its way: what a failure is about, and how it is sent again. */
interface Saving {
  name: string
  send: () => Promise<Landed>
}

interface Landed {
  taskId: string
  added?: Added
  /** Nothing changed: said on the status line, with no undo. */
  already?: boolean
  retry?: () => Promise<unknown>
}

/** The items on screen, and whether the list Undo reads has answered. */
interface Rows {
  tasks: readonly Task[]
  undoListId: string
  undoLoaded: boolean
}

/**
 * This opening's writes to open items. One item's go one after another, and a
 * note written stands until the list shows it: the row may be a moment behind.
 */
class OpenItemWrites {
  private tails = new Map<string, Promise<unknown>>()
  private written = new Map<string, { past: string[]; to: string }>()

  queued<T>(id: string, write: () => Promise<T>): Promise<T> {
    const next = (this.tails.get(id) ?? Promise.resolve()).then(write)
    const tail: Promise<unknown> = next
      .catch(() => {})
      .then(() => {
        if (this.tails.get(id) === tail) this.tails.delete(id)
      })
    this.tails.set(id, tail)
    return next
  }

  busy(id: string) {
    return this.tails.has(id)
  }

  now(key: string, shown: string) {
    const entry = this.written.get(key)
    if (entry?.past.includes(shown)) return entry.to
    this.written.delete(key)
    return shown
  }

  wrote(key: string, from: string, to: string) {
    const past = [...(this.written.get(key)?.past ?? []), from]
    this.written.set(key, { past: past.filter((value) => value !== to), to })
  }
}

function GroceryComposerCard({
  draftId,
  listId: openedOn,
  onClose,
  onOpenItem,
}: {
  draftId: string
  listId: string
  onClose: () => void
  onOpenItem: (taskId: string) => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const words = t.composer
  const own = words.grocery
  const g = t.tasks.grocery
  const actions = useTaskActions()
  const amountText = useGroceryAmountText()
  const lists = useTaskLists()

  const [draft, setDraft] = useState<GroceryDraft>(
    () => keptDraft<GroceryDraft>(draftId) ?? emptyGroceryDraft(),
  )
  const [added, setAdded] = useState<readonly Added[]>([])
  const [already, setAlready] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Reopened while this list's draft was still being saved (All details, then
  // a close): locked until that save settles.
  const [waiting, setWaiting] = useState(() => pendingSave(draftId))
  const submitted = useRef<string | null>(null)
  const mounted = useRef(true)
  const latest = useRef(draft)
  latest.current = draft
  const focusNote = useRef<ComposerTitleField['focusBody']>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const last = latest.current
      keepDraft(draftId, isGroceryDirty(last) ? last : undefined)
    }
  }, [draftId])

  const load = (next: GroceryDraft) => {
    latest.current = next
    setDraft(next)
  }
  const change = (next: GroceryDraft) => {
    load(next)
    setNotice(null)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: settles once per hold
  useEffect(() => {
    if (!waiting) return
    let live = true
    void waiting.then(() => {
      if (!live) return
      setWaiting(undefined)
      load(nextGroceryDraft(latest.current))
    })
    return () => {
      live = false
    }
  }, [waiting])

  // Only lists Gather writes to; a linked one has no rows here (ADR-0021).
  const offered = useMemo(
    () =>
      lists
        ? groceryListsOf(lists).filter((list) => list.writable)
        : undefined,
    [lists],
  )
  const target = offered
    ? quickAddTarget(offered, draft.listId ?? openedOn)
    : undefined
  const { tasks, today } = useTaskList(target?._id ?? openedOn)
  // What Undo would take back may be on a list the chip has left since.
  const undoListId = added.at(-1)?.listId ?? target?._id ?? openedOn
  const undoList = useTaskList(undoListId)
  const undoSync = undoList.list?.sync
  const rows = useRef<Rows>({ tasks: [], undoListId, undoLoaded: false })
  rows.current = {
    tasks: [...tasks, ...undoList.tasks],
    undoListId,
    undoLoaded:
      undoSync === 'live' ||
      undoSync === 'synced' ||
      (lists !== undefined && !lists.some((list) => list._id === undoListId)),
  }
  const [writes] = useState(() => new OpenItemWrites())
  const undoing = useRef(new Set<string>())
  // The staples this opening's saves share, by which of them made each: undo
  // takes one away with the last of its saves, and only if one of them made it.
  const sharedStaples = useRef(
    new Map<string, { created: boolean; saves: Set<string> }>(),
  )
  const noteStaple = (staple: AddedStaple, saveKey: string) => {
    const shared = sharedStaples.current.get(staple.id)
    sharedStaples.current.set(staple.id, {
      created: staple.created || (shared?.created ?? false),
      saves: new Set([...(shared?.saves ?? []), saveKey]),
    })
  }
  const dropStaple = async (id: AddedStaple['id'], saveKey: string) => {
    const shared = sharedStaples.current.get(id)
    if (!shared) return
    shared.saves.delete(saveKey)
    if (shared.saves.size > 0) return
    if (shared.created) await actions.undoStaple(id)
    sharedStaples.current.delete(id)
  }
  // Forgotten once the list shows it, so a later change back is believed.
  useEffect(() => {
    for (const task of rows.current.tasks) {
      writes.now(`notes:${task.id}`, task.notes ?? '')
    }
  })

  const item = composedGrocery(draft)
  // With its amount, as the server reads it: "2 blik tomaten" is in tins.
  const detected = useTypedAisle(
    target?._id,
    item.title ? groceryLineText(item.title, item.quantity, item.unit) : '',
  )
  const aisle = draft.aisle ?? detected
  const hasAmount = item.quantity !== undefined || item.unit !== undefined
  const amount = hasAmount
    ? { quantity: item.quantity, unit: item.unit }
    : undefined
  const amountLabel = hasAmount
    ? (amountText(item.quantity, item.unit) ?? '1')
    : undefined
  const canSave = Boolean(item.title && target) && !waiting

  // ---------------------------------------------------------------- saving

  /** A new item with everything chosen for it. */
  const saveNew = (to: string, saving: ComposedGrocery, saveKey: string): Saving => {
    return {
      name: capitalise(saving.title),
      send: async () => {
        const saved = await actions.addComposedGrocery(to, saving, saveKey)
        let stapleId: AddedStaple['id'] | undefined
        const keepStaple = ({ staple }: GroceryDetails) => {
          if (!staple) return
          noteStaple(staple, saveKey)
          stapleId = staple.id
        }
        keepStaple(saved)
        let deleted = false
        const retried = (retry: NonNullable<GroceryDetails['retry']>) => async () => {
          if (deleted) return undefined
          const again = await retry()
          keepStaple(again)
          if (again.retry) offerDetails(retried(again.retry))
          return undefined
        }
        return {
          taskId: saved.taskId,
          ...(saved.retry ? { retry: retried(saved.retry) } : {}),
          added: {
            key: saveKey,
            name: capitalise(saving.title),
            undo: async () => {
              if (!deleted) await actions.deleteTask(saved.taskId)
              deleted = true
              if (stapleId) await dropStaple(stapleId, saveKey)
            },
          },
        }
      },
    }
  }

  /**
   * A completion that is open already: its amount, and what was chosen. The
   * server adds it to what the item has then, so two quick picks, or another
   * Member's, add up (APP-671).
   */
  const saveOnto = (
    pick: GroceryPick & { open: NonNullable<GroceryPick['open']> },
    saving: ComposedGrocery,
    saveKey: string,
  ): Saving => {
    const { open: item } = pick
    const name = capitalise(pick.title)
    const rowNow = () => rows.current.tasks.find((task) => task.id === item.id)
    const notesOf = (row: Task) => writes.now(`notes:${item.id}`, row.notes ?? '')
    const setNotes = async (from: string, to: string) => {
      await actions.setNotes(item.id, to)
      writes.wrote(`notes:${item.id}`, from, to)
    }
    return {
      name,
      send: () =>
        writes.queued(item.id, async () => {
          const did: {
            amount?: { from: WholeAmount; to: WholeAmount }
            note?: { from: string; to: string }
            staple?: AddedStaple['id']
          } = {}
          let undone = false
          if (pick.merged)
            did.amount = await actions.addAmount(item.id, {
              quantity: saving.quantity,
              unit: saving.unit,
            })
          const merged = did.amount?.to
          /** Answers the details that did not save, to send only those again. */
          const details = async (wanted: { note?: string; staple?: boolean }) => {
            const addNote = async (note: string) => {
              const had = notesOf(rowNow() ?? item)
              const to = [had.trim(), note].filter(Boolean).join('\n')
              await setNotes(had, to)
              did.note = { from: had, to }
            }
            const addStaple = async () => {
              const staple = await actions.addStaple(item.title)
              noteStaple(staple, saveKey)
              did.staple = staple.id
            }
            const [note, staple] = await Promise.allSettled([
              wanted.note ? addNote(wanted.note) : null,
              wanted.staple ? addStaple() : null,
            ])
            return {
              note: note.status === 'rejected' ? wanted.note : undefined,
              staple: staple.status === 'rejected',
            }
          }
          const retryOf =
            (failed: Awaited<ReturnType<typeof details>>) => async () => {
              if (undone) return
              const left = await writes.queued(item.id, () => details(failed))
              if (left.note || left.staple) offerDetails(retryOf(left))
            }
          const asked = Number(Boolean(saving.note)) + Number(saving.staple)
          const failed = await details(saving)
          const missed = Number(Boolean(failed.note)) + Number(failed.staple)
          if (!merged && asked === 0) return { taskId: item.id, already: true }
          if (!merged && missed === asked) throw new Error('Nothing saved')
          return {
            taskId: item.id,
            ...(missed ? { retry: retryOf(failed) } : {}),
            added: {
              key: saveKey,
              name,
              listId: item.listId,
              itemId: item.id,
              text: merged
                ? fmt(own.merged, {
                    name,
                    amount:
                      amountText(
                        merged.quantity ?? undefined,
                        merged.unit ?? undefined,
                      ) ?? '1',
                  })
                : undefined,
              undo: async () => {
                // A later change of ours is on its way: not under its feet.
                if (writes.busy(item.id)) throw new Error('Still saving')
                const row = rowNow()
                if (did.amount || did.note) {
                  const loaded =
                    rows.current.undoListId === item.listId && rows.current.undoLoaded
                  // Gone is undone; not loaded is not known.
                  if (!row && !loaded) throw new Error('Not loaded')
                }
                undone = true
                // In turn with this item's saves.
                await writes.queued(item.id, async () => {
                  // Another Member may have changed it since: theirs stands.
                  if (row && did.amount)
                    await actions
                      .setAmount(item.id, did.amount.from, did.amount.to)
                      .catch((error) => {
                        if (readTaskRefusal(error) !== 'amount-changed') throw error
                      })
                  did.amount = undefined
                  if (row && did.note && notesOf(row) === did.note.to)
                    await setNotes(did.note.to, did.note.from)
                })
                if (did.staple) await dropStaple(did.staple, saveKey)
              },
            },
          }
        }),
    }
  }

  const landed = (saved: Landed, name: string, saveKey: string) => {
    forgetSentDraft<GroceryDraft>(draftId, saveKey)
    haptics.itemSaved()
    markFresh(saved.taskId, 'kitchen')
    if (mounted.current) {
      setAlready(saved.already ? name : null)
      const entry = saved.added
      if (entry) setAdded((all) => [...all, entry])
    }
    AccessibilityInfo.announceForAccessibility(
      saved.already
        ? fmt(own.already, { name })
        : (saved.added?.text ?? fmt(own.added, { name })),
    )
    if (saved.retry) offerDetails(saved.retry)
  }

  /** The item went in, not all of its details: offered again. */
  const offerDetails = (retry: () => Promise<unknown>) =>
    showAlert(own.detailsFailed, undefined, [
      { text: words.ok, style: 'cancel' },
      { text: words.tryAgain, onPress: () => void retry() },
    ])

  /**
   * A failed save, asked about: never poured over what is being typed now,
   * and sent again whole, under the same key. Answers the item once it landed,
   * or undefined when it was discarded.
   */
  const offerRetry = (saving: Saving, saveKey: string): Promise<Landed | undefined> =>
    new Promise((resolve) => {
      showAlert(
        fmt(words.notAdded, { title: saving.name }),
        undefined,
        [
          {
            text: words.discard,
            style: 'destructive',
            onPress: () => {
              // Discarded is gone: a close mid-save kept it for the list.
              forgetSentDraft<GroceryDraft>(draftId, saveKey)
              resolve(undefined)
            },
          },
          {
            text: words.tryAgain,
            onPress: () =>
              void saving.send().then(
                (saved) => {
                  landed(saved, saving.name, saveKey)
                  resolve(saved)
                },
                () => {
                  haptics.actionFailed()
                  void offerRetry(saving, saveKey).then(resolve)
                },
              ),
          },
        ],
        { cancelable: false },
      )
    })

  async function run(saving: Saving, openAfter = false) {
    // The draft this render shows, whose item `saving` is: `latest` has the
    // next item's key already when a second Return comes before the render.
    const sent = draft
    const { saveKey } = sent
    if (busy || waiting || submitted.current === saveKey) return
    submitted.current = saveKey
    setNotice(null)
    let settle: (saved: boolean) => void = () => {}
    if (openAfter) {
      // All details keeps the draft while it saves: a close now keeps it for
      // the list, held until the save, or the retry asked about it, settles.
      setBusy(true)
      holdDraft(
        draftId,
        new Promise<boolean>((resolve) => {
          settle = resolve
        }),
      )
    } else {
      // Cleared first: the next item can be typed at once.
      load(nextGroceryDraft(sent))
    }
    const saved = await saving.send().then(
      (result) => {
        landed(result, saving.name, saveKey)
        return result
      },
      () => {
        haptics.actionFailed()
        return offerRetry(saving, saveKey)
      },
    )
    settle(saved !== undefined)
    if (!openAfter || !mounted.current) return
    setBusy(false)
    load(nextGroceryDraft(sent))
    if (saved) onOpenItem(saved.taskId)
  }

  const save = (openAfter = false) => {
    if (!item.title || !target) {
      haptics.actionFailed()
      return
    }
    void run(saveNew(target._id, item, draft.saveKey), openAfter)
  }

  const pick = (picked: GroceryPick) => {
    if (!target) return
    const saving: ComposedGrocery = {
      ...item,
      title: picked.title,
      quantity: picked.quantity,
      unit: picked.unit,
    }
    void run(
      picked.open
        ? saveOnto({ ...picked, open: picked.open }, saving, draft.saveKey)
        : saveNew(target._id, saving, draft.saveKey),
    )
  }

  const undo = () => {
    const last = added.at(-1)
    if (!last) return
    const { itemId } = last
    // The one before it takes back what this one leaves: it waits for it.
    if (itemId && undoing.current.has(itemId)) return
    if (itemId) undoing.current.add(itemId)
    haptics.selectionChanged()
    setAdded((all) => all.filter((entry) => entry !== last))
    void last
      .undo()
      .catch(() => {
        haptics.actionFailed()
        setAdded((all) => [...all, last])
        setNotice(own.undoFailed)
      })
      .finally(() => {
        if (itemId) undoing.current.delete(itemId)
      })
  }

  // ---------------------------------------------------------------- chips

  const removeGroup = (id: string): MenuAction => ({
    id: `${id}:group`,
    title: '',
    displayInline: true,
    subactions: [
      { id, title: words.remove, attributes: { destructive: true } },
    ],
  })
  const quantityText = (quantity: number) =>
    amountText(quantity, item.unit) ?? '1'
  const units =
    item.unit && !OFFERED_UNITS.includes(item.unit)
      ? [...OFFERED_UNITS, item.unit]
      : OFFERED_UNITS
  const amountMenu: MenuAction[] = [
    ...quantityChoices(item).map((quantity) => ({
      id: `quantity:${quantity}`,
      title: quantityText(quantity),
      state:
        hasAmount && (item.quantity ?? 1) === quantity
          ? ('on' as const)
          : ('off' as const),
    })),
    {
      id: 'units',
      title: own.unit,
      subactions: units.map((unit) => ({
        id: `unit:${unit}`,
        title: unit === 'stuks' ? g.units[unit].other : g.units[unit].one,
        state: item.unit === unit ? ('on' as const) : ('off' as const),
      })),
    },
    ...(hasAmount ? [removeGroup('amount:remove')] : []),
  ]
  const aisleMenu: MenuAction[] = [
    ...GROCERY_AISLES.map((id) => ({
      id: `aisle:${id}`,
      title: g.aisles[id],
      state: id === aisle ? ('on' as const) : ('off' as const),
    })),
    // Back to the list's own answer.
    ...(draft.aisle ? [removeGroup('aisle:remove')] : []),
  ]

  const onMenu = (id: string) => {
    const at = id.indexOf(':')
    const kind = id.slice(0, at)
    const value = id.slice(at + 1)
    if (id === 'more:all') {
      save(true)
      return
    }
    haptics.selectionChanged()
    const now = latest.current
    if (kind === 'list') change({ ...now, listId: value })
    else if (kind === 'quantity')
      change(withAmount(now, { ...amount, quantity: Number(value) }))
    else if (kind === 'unit')
      change(withAmount(now, { quantity: item.quantity ?? 1, unit: value as GroceryUnit }))
    else if (id === 'amount:remove')
      // A typed amount's words stay as the name; a tapped one just goes.
      change({ ...now, amount: now.amount ? undefined : null })
    else if (id === 'aisle:remove') change({ ...now, aisle: undefined })
    // Any aisle tapped is a choice, the one shown too: "keep it in Other"
    // holds against a later AI answer.
    else if (kind === 'aisle' && isGroceryAisle(value))
      change({ ...now, aisle: value })
    else if (id === 'more:staple') change({ ...now, staple: !now.staple })
    else if (id === 'more:note') {
      if (now.showNote && !now.note.trim()) change({ ...now, showNote: false })
      else {
        change({ ...now, showNote: true })
        focusNote.current?.()
      }
    }
  }

  const named = (name: string, value?: string) =>
    value ? `${name}: ${value}` : name
  const chips: ComposerChip[] = [
    ...(target
      ? [
          {
            id: 'list',
            label: target.name,
            accessibilityLabel: fmt(t.tasks.quickAdd.listChip, { list: target.name }),
            set: false,
            leading: (
              <ModuleTile group="kitchen" glyph={MODULE_ICONS.ShoppingCart} size="xs" />
            ),
            // One grocery list: nothing to choose between.
            ...(offered && offered.length > 1
              ? {
                  menu: offered.map((list) => ({
                    id: `list:${list._id}`,
                    title: list.name,
                    state:
                      list._id === target._id ? ('on' as const) : ('off' as const),
                  })),
                  onMenu,
                }
              : {}),
            testID: 'composer-chip-list',
          },
        ]
      : []),
    {
      id: 'amount',
      label: amountLabel ?? g.amount,
      accessibilityLabel: named(g.amount, amountLabel),
      set: hasAmount,
      icon: TASK_ICONS.Amount,
      menu: amountMenu,
      onMenu,
      testID: 'composer-chip-amount',
    },
    {
      id: 'aisle',
      label: aisle ? g.aisles[aisle] : g.aisle,
      accessibilityLabel: named(g.aisle, aisle && g.aisles[aisle]),
      set: aisle !== undefined,
      icon: TASK_ICONS.Aisle,
      menu: aisleMenu,
      onMenu,
      testID: 'composer-chip-aisle',
    },
    ...(draft.staple
      ? [
          {
            id: 'staple',
            label: own.staple,
            accessibilityLabel: own.staple,
            set: true,
            icon: UI_ICONS.House,
            onPress: () => onMenu('more:staple'),
            testID: 'composer-chip-staple',
          },
        ]
      : []),
  ]

  const showNote = draft.showNote || Boolean(draft.note.trim())
  const moreItems: ComposerMoreItem[] = [
    {
      id: 'more:amount',
      title: g.amount,
      image: 'number',
      state: hasAmount ? 'on' : 'off',
      subactions: amountMenu,
    },
    {
      id: 'more:aisle',
      title: g.aisle,
      image: 'tablecells',
      state: aisle ? 'on' : 'off',
      subactions: aisleMenu,
    },
    {
      id: 'more:note',
      title: own.note,
      image: 'text.alignleft',
      state: showNote ? 'on' : 'off',
    },
    {
      id: 'more:staple',
      title: own.staple,
      image: 'house',
      state: draft.staple ? 'on' : 'off',
    },
  ]

  const last = added.at(-1)
  const statusText = already
    ? fmt(own.already, { name: already })
    : last
      ? added.length === 1 && last.text
        ? last.text
        : addedSummary(
            added.map((entry) => entry.name),
            own,
          )
      : null

  return (
    <KeyboardComposer
      testID="grocery-keyboard-composer"
      group="kitchen"
      expandable={false}
      saveLabel={own.send}
      onClose={onClose}
      renderTitle={(field) => {
        focusNote.current = field.focusBody
        return (
          <QuickAddInput
            testID="composer-title"
            group="kitchen"
            inputRef={field.inputRef}
            editable={field.editable && !waiting}
            autoFocus
            line={draft.line}
            parsed={{ parts: amountSpans(draft) }}
            onChangeText={(line) => change(withLine(latest.current, line))}
            placeholder={own.title}
            placeholderTextColor={field.placeholderTextColor}
            accessibilityLabel={fmt(own.titleLabel, { list: target?.name ?? '' })}
            returnKeyType="done"
            // Stays focused: the next item is typed at once (APP-521).
            submitBehavior="submit"
            onSubmitEditing={field.onSubmitEditing}
            style={field.style}
          />
        )
      }}
      body={{
        value: draft.note,
        onChange: (note) => change({ ...latest.current, note }),
        visible: showNote,
        placeholder: own.notePlaceholder,
        accessibilityLabel: own.note,
      }}
      above={
        target && item.title && !busy && !waiting ? (
          <GroceryCompletions
            listId={target._id}
            line={item.title}
            amount={amount}
            // A repeating item waiting for its next date is not on the list
            // (APP-520): typing its name adds a row that shows now.
            tasks={tasks.filter((task) => onShoppingList(task, today))}
            onPick={pick}
          />
        ) : null
      }
      chips={chips}
      allChips={chips}
      more={{
        items: moreItems,
        allDetails: {
          id: 'more:all',
          title: words.allDetails,
          image: 'arrow.up.forward.square',
          attributes: { disabled: !canSave },
        },
        onPress: onMenu,
      }}
      canSave={canSave}
      busy={busy || waiting !== undefined}
      onSave={() => save()}
      status={
        statusText ? (
          <View style={styles.status} testID="grocery-status">
            <UI_ICONS.Check
              size={14}
              strokeWidth={2.6}
              color={tokens.accentText}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text
              numberOfLines={2}
              style={[styles.statusText, { color: tokens.muted }]}
            >
              {statusText}
            </Text>
            {last && !already ? (
              <Pressable
                testID="grocery-undo"
                accessibilityRole="button"
                accessibilityLabel={`${own.undo}: ${last.name}`}
                hitSlop={8}
                onPress={undo}
                style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
              >
                <Text style={[styles.undoText, { color: tokens.ink }]}>
                  {own.undo}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null
      }
      notice={
        notice ??
        (offered !== undefined && target === undefined ? t.tasks.quickAdd.noList : null)
      }
    />
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: BAR_PADDING,
    paddingHorizontal: SPACE[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    minHeight: PILL,
    borderRadius: RADIUS.pill,
    paddingLeft: SPACE[4],
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
  },
  pillText: { ...TYPE.body, flex: 1 },
  disc: {
    width: SIZE.tileM,
    height: SIZE.tileM,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { ...TYPE.footnote, flex: 1 },
  undo: { minHeight: 32, justifyContent: 'center' },
  undoText: { ...TYPE.footnoteStrong },
  pressed: { opacity: 0.6 },
})
