import { useLocalSearchParams } from 'expo-router'

import { EnergyAssetScreen } from '../../../../../src/features/energy/energy-asset-screen'

/** `?id=` edits that asset; without one the screen adds a new one. */
export default function EnergyAsset() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  return <EnergyAssetScreen key={id ?? 'new'} assetId={id} />
}
