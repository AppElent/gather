import { createFileRoute } from '@tanstack/react-router'
import { TastingIndexPage } from '../../../components/tastings/TastingIndexPage'

export const Route = createFileRoute('/_app/beers/')({
  component: () => <TastingIndexPage kind="beer" />,
})
