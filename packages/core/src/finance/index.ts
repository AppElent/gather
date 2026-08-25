/**
 * The one calculation seam the Finances Module is built on.
 *
 * Pure, portable and unaware of React, Convex and the phone: the arithmetic is
 * the product here, so it is the part with tests around it and the part the web
 * can reuse when its turn comes. Everything that reads a database, renders a
 * row or speaks a language lives somewhere else.
 */

export * from './buyingCosts'
export * from './dates'
export * from './money'
export * from './mortgage'
export * from './netWorth'
export * from './portfolio'
export * from './recurring'
export * from './savings'
export * from './split'
