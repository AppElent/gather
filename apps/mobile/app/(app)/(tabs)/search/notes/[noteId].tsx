/** A note opened from Search; Back returns to the results. */
import { useLocalSearchParams } from 'expo-router'
import { Note } from '../../../../../src/modules/notes/NoteScreen'

export default function SearchNote() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>()
  return <Note noteId={noteId} />
}
