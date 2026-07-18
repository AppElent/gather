import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { BarcodeScanner } from '../../../components/foods/BarcodeScanner'

export const Route = createFileRoute('/_app/foods/')({
  component: FoodsIndex,
})

function FoodsIndex() {
  const [term, setTerm] = useState('')
  const results = useQuery(api.foods.search, { term })
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Foods</h1>

      <div className="mb-6 rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">Scan a barcode</p>
        <BarcodeScanner
          onDetected={(barcode) =>
            navigate({ to: '/foods/new', search: { barcode } })
          }
        />
      </div>

      <label className="mb-4 block text-sm">
        <span className="mb-1 block font-medium">Search foods</span>
        <input
          className="w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. hagelslag"
        />
      </label>

      <Link
        to="/foods/new"
        className="mb-4 inline-block rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-1.5 text-sm no-underline"
      >
        Add manually
      </Link>

      <ul className="divide-y divide-[var(--app-border)]">
        {results?.map((food) => (
          <li key={food._id}>
            <Link
              to="/foods/$foodId"
              params={{ foodId: food._id }}
              className="block py-2 no-underline"
            >
              <span className="font-medium">{food.name}</span>
              {food.brand && (
                <span className="ml-2 text-sm opacity-60">{food.brand}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {results?.length === 0 && term.trim() && (
        <p className="text-sm opacity-60">No foods found for "{term}".</p>
      )}
    </div>
  )
}
