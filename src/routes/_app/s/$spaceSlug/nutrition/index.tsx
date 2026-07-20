import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/_app/s/$spaceSlug/nutrition/')({
  component: SpaceNutrition,
})

function SpaceNutrition() {
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({ to: '/nutrition', replace: true })
  }, [navigate])

  return <p className="text-sm opacity-60">Opening Nutrition...</p>
}
