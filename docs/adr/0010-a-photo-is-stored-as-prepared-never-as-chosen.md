# A photo is stored as prepared, never as chosen

Status: accepted (2026-08-03)

A photo chosen from a phone is a 4032×3024 original that no screen in Gather asks
for. Between choosing it and storing it, the person frames it and Gather shrinks
it, and it is that prepared photo that is kept. The file that was chosen is never
stored, anywhere, and cannot be recovered afterwards.

## Why

The largest a photo is ever shown is the recipe hero at 672 CSS px — around 1344
physical px on a phone. A child's photo is a circle 56px across. An iPhone
original is nine times the pixels of the first and thousands of times the second,
so storing what was chosen means storing, forever, a resolution nothing will ever
read.

The alternative was to keep the original as well and store a derivative beside
it, on Convex or on an external tier. That is a different shape of problem, not a
setting: `babies.photoId` and `recipes.imageId` are each one optional
`_storage` id, and a photo that is two blobs in two systems needs a schema that
says so, provider credentials, and a deletion story across both. Gather did not
have the last of those even for one blob when this was decided — nothing in
`convex/` called `ctx.storage.delete`, so every replaced photo was already an
orphan that outlived the row that referenced it. (#38 has since fixed that for
the one-blob case: the mutation that orphans a file deletes it —
`convex/lib/storedFiles.ts`. Files uploaded before any row points at them are
still nobody's, #41.) Adding a second tier would double the number of files whose
lifetime nobody manages. The tier is deferred rather than refused: when a
Module wants full photographs rather than avatars and headers, it will be worth
having, and this ADR is what it will have to argue against.

Preparing also decides *which* pixels survive, and that is a judgement Gather is
not entitled to make alone. A baby's photo is displayed as a circle and cropped
by `object-cover` whatever we do; the only question is whether the person or the
centre of the frame chooses the square. So the person frames every photo, and a
Module says only what it needs — a fixed square at 512px for a child, a free
frame at 1600px for a recipe — from one table rather than from each call site.

## Consequences

**Mis-framing is permanent.** A parent who crops badly cannot re-crop: there is
no original to go back to, only the 512px square. The remedy is to upload the
photo again from the camera roll, which they still have and Gather never did.
This is the price of not keeping originals, and it is why the framing step is
shown on every upload rather than hidden behind an "adjust" affordance nobody
would find.

**Preparing can fail, and then nothing is stored.** A HEIC file that Chrome
cannot decode is refused rather than uploaded untouched. Falling back to the
original would be kinder in the moment and would quietly retire the guarantee:
storage would again hold unbounded photos, on some browsers only, with nothing in
the data to say which rows came through which door.

**The guarantee is about the step, not the table.** Photos stored before this
decision are left alone. A migration could shrink them but could not frame them,
so it would centre-crop every child automatically — the exact mistake the framing
step exists to prevent — and destroy the original doing it. Gather therefore
holds two classes of photo indefinitely, and "no larger than its preset" is true
of everything prepared, not of everything stored.

**One door is still open.** `recipeImport` fetches a remote hero image in an
action and stores it as fetched. Convex's runtime has no canvas, so preparing
there would be a second image pipeline rather than a reuse of this one. Imported
images are accepted as they come until that is shown to matter.
