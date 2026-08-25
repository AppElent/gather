import { useLocalSearchParams } from 'expo-router'
import { Note } from '../../../../../src/modules/notes/NoteScreen'

export default function NoteRoute() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>()
  return <Note noteId={noteId} />
}
