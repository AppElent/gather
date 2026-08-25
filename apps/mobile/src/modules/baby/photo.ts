/**
 * The Baby log's photo pipeline — now `src/media/photo.ts`, bound to the
 * `memoryPhoto` preset.
 *
 * The mechanics moved out when the tasting Modules needed the same three-step
 * handshake and the same `expo-file-system` read (#199). What stayed a Baby
 * log decision is *which preset*: a memory is free-framed and not cropped at
 * all, because the whole picture is the point and it was framed by whoever
 * took it. See ADR-0010 and the notes in `src/media/photo.ts`.
 */
import {
  type PhotoSource,
  type PickedPhoto,
  pickPhoto as pickWithPreset,
} from '../../media/photo'

export type { PhotoSource, PickedPhoto } from '../../media/photo'
export { uploadPhoto } from '../../media/photo'

export async function pickPhoto(
  source: PhotoSource,
): Promise<PickedPhoto | null | 'denied'> {
  return await pickWithPreset('memoryPhoto', source)
}
