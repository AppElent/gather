interface ExportPdfButtonProps {
  onClick: () => void
}

/** Just the trigger — the actual form is `ExportPdfPanel`, rendered by the
 * parent as a standalone full-width block instead of nested here, since
 * nesting a full form inside this button's flex row squeezed it into a
 * shrink-to-fit width instead of the page width. */
export function ExportPdfButton({ onClick }: ExportPdfButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-semibold"
    >
      Export PDF
    </button>
  )
}
