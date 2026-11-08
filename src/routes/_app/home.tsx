import { createFileRoute } from '@tanstack/react-router'
import { GroupHome } from '../../components/home/GroupHome'

/** A Group's Home — what a Member sees on opening it (GLOSSARY.md). */
export const Route = createFileRoute('/_app/home')({ component: GroupHome })
