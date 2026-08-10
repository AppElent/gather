# Collapsed Icon Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-visible food-icon grid with an accessible, collapsed trigger that opens a modal bottom sheet.

**Architecture:** `IconPicker` remains the public component used by food and one-off forms. It owns open/closed state and delegates the modal surface to a portal-rendered `IconPickerSheet`, avoiding layout expansion and conflicts with the existing nutrition sheet. The existing `onChange(icon: string | undefined)` interface is unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Testing Library, Vitest, `@appelent/i18n`.

## Global Constraints

- Keep the curated `FOOD_ICONS` set and `onChange(icon: string | undefined)` contract unchanged.
- `undefined` remains the picker clear signal; `FoodForm` must continue to submit it as `null`.
- Add all new chrome strings in both locale dictionaries; stored emoji are content and are not translated.
- The closed trigger is at least 44px square and shows `🍽️` when no icon is selected.
- Do not modify the parent nutrition add sheet's gesture behavior.

---

### Task 1: Establish the collapsed trigger contract

**Files:**

- Modify: `src/components/foods/IconPicker.test.tsx`
- Modify: `src/components/foods/IconPicker.tsx`
- Modify: `src/lib/i18n/messages/en/common.ts`
- Modify: `src/lib/i18n/messages/nl/common.ts`

**Interfaces:**

- Consumes: `value?: string`, `onChange(icon: string | undefined): void`, and `disabled?: boolean`.
- Produces: a trigger button with `aria-expanded`, `aria-haspopup="dialog"`, and selected emoji or `🍽️`.

- [ ] **Step 1: Write the failing test**

```tsx
test('starts collapsed and invites the person to choose an icon', () => {
  renderWithI18n(<IconPicker onChange={vi.fn()} />)
  const trigger = screen.getByRole('button', { name: 'Choose icon' })
  expect(trigger.ariaExpanded).toBe('false')
  expect(trigger).toHaveTextContent('🍽️')
  expect(screen.queryByRole('dialog')).toBeNull()
})
```

- [ ] **Step 2: Verify the red state**

Run: `pnpm test -- IconPicker`

Expected: the trigger query fails because the current picker renders the grid immediately.

- [ ] **Step 3: Implement the minimal trigger**

```tsx
const [open, setOpen] = useState(false)
<button
  type="button"
  aria-expanded={open}
  aria-haspopup="dialog"
  aria-label={value === undefined ? icon.choose : icon.change}
  onClick={() => setOpen(true)}
  className="flex min-h-11 min-w-11 items-center justify-center ..."
>
  {value ?? '🍽️'}
</button>
```

Add `choose` and `change` to both locale dictionaries.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm test -- IconPicker`

Expected: PASS.

```bash
git add src/components/foods/IconPicker.tsx src/components/foods/IconPicker.test.tsx src/lib/i18n/messages/en/common.ts src/lib/i18n/messages/nl/common.ts
git commit -m "feat(foods): collapse icon picker trigger"
```

### Task 2: Add the portal-rendered icon-picker sheet

**Files:**

- Create: `src/components/foods/IconPickerSheet.tsx`
- Modify: `src/components/foods/IconPicker.tsx`
- Modify: `src/components/foods/IconPicker.test.tsx`
- Modify: `src/lib/i18n/messages/en/common.ts`
- Modify: `src/lib/i18n/messages/nl/common.ts`

**Interfaces:**

- Consumes: `open: boolean`, `value?: string`, `disabled?: boolean`, `onChoose(icon: string): void`, `onClear(): void`, and `onClose(): void`.
- Produces: a portal-rendered `role="dialog"`, named by its title, with a backdrop, close button, grid, and conditional clear action.

- [ ] **Step 1: Write the failing selection test**

```tsx
test('choosing an icon in the sheet reports it and collapses the picker', () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose icon' }))
  expect(screen.getByRole('dialog', { name: 'Choose an icon' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '🍕' }))
  expect(onChange).toHaveBeenCalledWith('🍕')
  expect(screen.queryByRole('dialog')).toBeNull()
})
```

- [ ] **Step 2: Verify the red state**

Run: `pnpm test -- IconPicker`

Expected: the dialog query fails because activating the trigger renders no sheet.

- [ ] **Step 3: Implement the minimal sheet**

```tsx
return createPortal(
  <div className="fixed inset-0 z-[60]">
    <button aria-label={icon.close} onClick={onClose} className="absolute inset-0 ..." />
    <section role="dialog" aria-modal="true" aria-labelledby="icon-picker-title" className="absolute inset-x-0 bottom-0 ...">
      <h2 id="icon-picker-title">{icon.chooseTitle}</h2>
      {FOOD_ICONS.map((candidate) => <button onClick={() => onChoose(candidate)}>{candidate}</button>)}
    </section>
  </div>,
  document.body,
)
```

The parent calls `onChange(candidate)` and then closes the sheet.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm test -- IconPicker`

Expected: PASS.

```bash
git add src/components/foods/IconPicker.tsx src/components/foods/IconPickerSheet.tsx src/components/foods/IconPicker.test.tsx src/lib/i18n/messages/en/common.ts src/lib/i18n/messages/nl/common.ts
git commit -m "feat(foods): open icon choices in a sheet"
```

### Task 3: Complete clearing, dismissal, and focus return

**Files:**

- Modify: `src/components/foods/IconPicker.tsx`
- Modify: `src/components/foods/IconPickerSheet.tsx`
- Modify: `src/components/foods/IconPicker.test.tsx`
- Verify: `src/components/foods/FoodForm.test.tsx`

**Interfaces:**

- Consumes: selected `value` and the trigger ref.
- Produces: explicit clearing with `onChange(undefined)`, unchanged state on dismissal, Escape support, and focus returned to the trigger.

- [ ] **Step 1: Write the failing behavior tests**

```tsx
test('clearing from the sheet reports undefined and collapses it', () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker value="🍕" onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Change icon' }))
  fireEvent.click(screen.getByRole('button', { name: 'No icon' }))
  expect(onChange).toHaveBeenCalledWith(undefined)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('Escape dismisses without changing the icon and restores trigger focus', () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker value="🍕" onChange={onChange} />)
  const trigger = screen.getByRole('button', { name: 'Change icon' })
  fireEvent.click(trigger)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onChange).not.toHaveBeenCalled()
  expect(trigger).toHaveFocus()
})
```

- [ ] **Step 2: Verify the red state**

Run: `pnpm test -- IconPicker`

Expected: FAIL because the sheet has no clear action, Escape listener, or focus restoration.

- [ ] **Step 3: Implement the minimal behavior**

```tsx
const triggerRef = useRef<HTMLButtonElement>(null)
const close = () => {
  setOpen(false)
  requestAnimationFrame(() => triggerRef.current?.focus())
}
const clear = () => {
  onChange(undefined)
  close()
}
```

Register an Escape listener only while open. Render the clear action only when `value !== undefined`.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm test -- IconPicker && pnpm test -- FoodForm`

Expected: PASS; the picker emits `undefined` and the existing form seam still submits `icon: null`.

```bash
git add src/components/foods/IconPicker.tsx src/components/foods/IconPickerSheet.tsx src/components/foods/IconPicker.test.tsx
git commit -m "feat(foods): make icon picker sheet dismissible"
```

### Task 4: Verify and hand off

**Files:**

- Verify: `src/components/foods/IconPicker.tsx`
- Verify: `src/components/foods/IconPickerSheet.tsx`
- Verify: `src/components/foods/IconPicker.test.tsx`
- Verify: `src/components/foods/FoodForm.test.tsx`

- [ ] **Step 1: Run focused tests**

Run: `pnpm test -- IconPicker && pnpm test -- FoodForm`

Expected: PASS with no warnings.

- [ ] **Step 2: Run static checks**

Run: `pnpm typecheck && pnpm check`

Expected: PASS.

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 4: Commit the plan and completed implementation**

```bash
git add docs/superpowers/plans/2026-08-10-collapsed-icon-picker.md
git commit -m "docs: plan collapsed icon picker implementation"
```

