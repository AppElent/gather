import { api } from '../../../../convex/_generated/api'
import { defineTool, myGroups, publicDoc } from './define'

export const accountTools = [
  defineTool({
    name: 'get_current_user',
    title: 'Get current user',
    description:
      "Return who this connection acts for (name and email), the access it was granted, and the server's current time. Call it with list_groups (which gives each Group's timeZone when set) to resolve 'today' before date-based tools.",
    access: 'read',
    input: {},
    async run(_, { access, backend, userInfo, now }) {
      const [me, info] = await Promise.all([
        backend.query(api.users.me, {}),
        userInfo().catch(() => undefined),
      ])
      return {
        name:
          me?.name ?? (typeof info?.name === 'string' ? info.name : undefined),
        email: typeof info?.email === 'string' ? info.email : me?.email,
        hasGatherAccount: me !== null,
        scopes: [...access.scopes].sort(),
        serverTime: now().toISOString(),
      }
    },
  }),
  defineTool({
    name: 'list_groups',
    title: 'List groups',
    description:
      "List the Groups (households and other shared spaces) the user is a Member of, with each Group's id, the user's role, and its IANA time zone when one is set. Every other tool takes one of these Group ids.",
    access: 'read',
    input: {},
    async run(_, context) {
      const groups = await myGroups(context)
      return {
        groups: groups.map((group) =>
          publicDoc({
            _id: group._id,
            name: group.name,
            role: group.role,
            ...(group.timeZone ? { timeZone: group.timeZone } : {}),
          }),
        ),
      }
    },
  }),
]
