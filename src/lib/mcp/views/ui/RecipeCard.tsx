import { type ReactNode, useState } from 'react'
import type { RecipeCardResult } from '../types'
import { scaleIngredient } from './scale'
import type { ViewProps } from './ViewRoot'

function hostOf(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function RecipeCard({
  app,
  result,
  text,
  header,
}: ViewProps<RecipeCardResult>) {
  const { t } = text
  const { recipe } = result
  const base = recipe.servings
  const [servings, setServings] = useState(base ?? 0)
  const factor = base ? servings / base : 1
  const meta: { key: string; node: ReactNode }[] = []
  if (recipe.prepMinutes)
    meta.push({
      key: 'prep',
      node: text.fmt(t.recipe.prep, { minutes: recipe.prepMinutes }),
    })
  if (recipe.rating)
    meta.push({
      key: 'rating',
      node: (
        <span role="img" aria-label={text.plural(recipe.rating, t.recipe.rating)}>
          {'★'.repeat(recipe.rating)}
        </span>
      ),
    })
  if (recipe.sharedFrom)
    meta.push({
      key: 'shared',
      node: text.fmt(t.recipe.sharedFrom, { group: recipe.sharedFrom }),
    })
  return (
    <article className="recipe">
      <header className="toolbar">
        <div>
          <p className="eyebrow">{result.groupName}</p>
          <h2>{recipe.title}</h2>
          {meta.length > 0 && (
            <p className="muted small">
              {meta.map((part, index) => (
                <span key={part.key}>
                  {index > 0 ? ' · ' : ''}
                  {part.node}
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="actions">{header}</div>
      </header>
      {recipe.imageUrl && (
        <img className="recipe-photo" src={recipe.imageUrl} alt="" />
      )}
      {recipe.description && <p className="lede">{recipe.description}</p>}
      {recipe.tags.length > 0 && (
        <p className="tags">
          {recipe.tags.map((tag) => (
            <span key={tag} className="label-chip">
              {tag}
            </span>
          ))}
        </p>
      )}
      <div className="recipe-columns">
        <section>
          <div className="section-head">
            <h3>{t.recipe.ingredients}</h3>
            {base ? (
              <div className="stepper" role="group" aria-label={t.recipe.servings}>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t.recipe.fewer}
                  title={t.recipe.fewer}
                  disabled={servings <= 1}
                  onClick={() => setServings((now) => Math.max(1, now - 1))}
                >
                  −
                </button>
                <output aria-live="polite">
                  {servings} {t.recipe.servings.toLowerCase()}
                </output>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t.recipe.more}
                  title={t.recipe.more}
                  disabled={servings >= 100}
                  onClick={() => setServings((now) => Math.min(100, now + 1))}
                >
                  +
                </button>
              </div>
            ) : null}
          </div>
          {base && servings !== base ? (
            <p className="muted small">
              {text.fmt(t.recipe.scaled, { count: base })}
            </p>
          ) : null}
          {recipe.ingredients.length === 0 ? (
            <p className="muted">{t.recipe.noIngredients}</p>
          ) : (
            <ul className="ingredients">
              {recipe.ingredients.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat
                <li key={index}>
                  {scaleIngredient(line, factor, (value) => text.number(value))}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <div className="section-head">
            <h3>{t.recipe.steps}</h3>
          </div>
          {recipe.steps.length === 0 ? (
            <p className="muted">{t.recipe.noSteps}</p>
          ) : (
            <ol className="steps">
              {recipe.steps.map((step, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: steps can repeat
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {recipe.sourceUrl && (
        <p className="muted small source">
          {t.recipe.source}:{' '}
          <a
            href={recipe.sourceUrl}
            onClick={(event) => {
              event.preventDefault()
              void app.openLink({ url: recipe.sourceUrl ?? '' })
            }}
          >
            {hostOf(recipe.sourceUrl)}
          </a>
        </p>
      )}
    </article>
  )
}
