#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { runEnvCli } from '@appelent/dev/env'

const root = fileURLToPath(new URL('..', import.meta.url))
process.exitCode = (await runEnvCli(process.argv.slice(2), { root })).exitCode
