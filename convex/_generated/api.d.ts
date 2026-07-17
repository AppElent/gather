/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as groups from "../groups.js";
import type * as integrations from "../integrations.js";
import type * as lib_recipeAiExtract from "../lib/recipeAiExtract.js";
import type * as lib_recipeParsing from "../lib/recipeParsing.js";
import type * as lib_sharing from "../lib/sharing.js";
import type * as lib_taskProviders_index from "../lib/taskProviders/index.js";
import type * as lib_taskProviders_notion from "../lib/taskProviders/notion.js";
import type * as lib_taskProviders_todoist from "../lib/taskProviders/todoist.js";
import type * as lib_taskProviders_types from "../lib/taskProviders/types.js";
import type * as recipeImport from "../recipeImport.js";
import type * as recipes from "../recipes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  groups: typeof groups;
  integrations: typeof integrations;
  "lib/recipeAiExtract": typeof lib_recipeAiExtract;
  "lib/recipeParsing": typeof lib_recipeParsing;
  "lib/sharing": typeof lib_sharing;
  "lib/taskProviders/index": typeof lib_taskProviders_index;
  "lib/taskProviders/notion": typeof lib_taskProviders_notion;
  "lib/taskProviders/todoist": typeof lib_taskProviders_todoist;
  "lib/taskProviders/types": typeof lib_taskProviders_types;
  recipeImport: typeof recipeImport;
  recipes: typeof recipes;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
