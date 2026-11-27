import { createFileRoute } from '@tanstack/react-router'
import { TasksSettingsPage } from '../../../components/tasks/TasksSettingsPage'

export const Route = createFileRoute('/_app/tasks/settings')({
  component: TasksSettingsPage,
})
