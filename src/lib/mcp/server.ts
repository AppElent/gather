import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { accountTools } from './tools/account'
import { calendarTools } from './tools/calendar'
import {
  type AnyToolDefinition,
  registerTools,
  type ToolContext,
} from './tools/define'
import { noteTools } from './tools/notes'
import { recipeTools } from './tools/recipes'
import { taskTools } from './tools/tasks'
import { viewTools } from './tools/views'
import { registerViewResources } from './views/resources'

export const GATHER_MCP_TOOLS: readonly AnyToolDefinition[] = [
  ...accountTools,
  ...recipeTools,
  ...taskTools,
  ...noteTools,
  ...calendarTools,
  ...viewTools,
]

const INSTRUCTIONS = `Gather is the user's household app: recipes, task lists, notes, and calendars, shared within Groups (a household, a club).
- Everything belongs to a Group. Call list_groups first and pass a groupId to every other tool; ask which Group when the user has several and it is unclear.
- IDs come from list tools; never invent them. "Not found" covers both a missing record and one outside that Group.
- Dates are the Group's local calendar days (YYYY-MM-DD); times are local HH:MM. Call get_current_user for the current time.
- Every create tool takes an idempotencyKey: generate a fresh UUID per intended write and reuse it only to retry that same write.
- show_week_agenda, show_task_list and show_recipe show interactive views where the client supports them; prefer them when the user wants to see a week, a list or a recipe.
- Confirm with the user before adding or changing anything they did not clearly ask for. Agents cannot delete anything; deleting happens in the app.`

export function createGatherMcpServer(
  context: ToolContext,
  /** Where recipe photos load from (Convex file storage), for the view CSP. */
  imageOrigin?: string,
): McpServer {
  const server = new McpServer(
    { name: 'gather', title: 'Gather', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  )
  registerTools(server, GATHER_MCP_TOOLS, context)
  registerViewResources(server, context, imageOrigin)
  return server
}
