# Public recipe collections are Group settings

Status: accepted (2026-08-08)

A Group may make its Recipes Module public. The setting applies to the Group's
recipe collection, not to individual recipes.

## What public means

Public recipes are readable without joining the Group. They are read-only to
the public: edits remain writes to the home Group. Someone who wants to change
a public recipe copies it into a Group of their own; that copy is independent.

Public visibility replaces named-Group sharing for a public recipe collection.
Private Groups retain the existing explicit sharing behavior.

## Consequences

Public read access must be enforced independently of signed-in Group membership,
while every write must continue to authorize the home Group. Public browsing,
copying, attribution, and removal of public access need explicit tests.
