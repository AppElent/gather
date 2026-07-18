/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as foods from "../foods.js";
import type * as foodsLookup from "../foodsLookup.js";
import type * as groups from "../groups.js";
import type * as integrations from "../integrations.js";
import type * as lib_nutrition from "../lib/nutrition.js";
import type * as lib_nutritionAiEstimate from "../lib/nutritionAiEstimate.js";
import type * as lib_offFetch from "../lib/offFetch.js";
import type * as lib_offMapping from "../lib/offMapping.js";
import type * as lib_recipeAiExtract from "../lib/recipeAiExtract.js";
import type * as lib_recipeParsing from "../lib/recipeParsing.js";
import type * as lib_sharing from "../lib/sharing.js";
import type * as lib_taskAccess from "../lib/taskAccess.js";
import type * as lib_taskProviders_index from "../lib/taskProviders/index.js";
import type * as lib_taskProviders_notion from "../lib/taskProviders/notion.js";
import type * as lib_taskProviders_todoist from "../lib/taskProviders/todoist.js";
import type * as lib_taskProviders_types from "../lib/taskProviders/types.js";
import type * as maintenance from "../maintenance.js";
import type * as recipeImport from "../recipeImport.js";
import type * as recipeNutrition from "../recipeNutrition.js";
import type * as recipes from "../recipes.js";
import type * as taskLists from "../taskLists.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  foods: typeof foods;
  foodsLookup: typeof foodsLookup;
  groups: typeof groups;
  integrations: typeof integrations;
  "lib/nutrition": typeof lib_nutrition;
  "lib/nutritionAiEstimate": typeof lib_nutritionAiEstimate;
  "lib/offFetch": typeof lib_offFetch;
  "lib/offMapping": typeof lib_offMapping;
  "lib/recipeAiExtract": typeof lib_recipeAiExtract;
  "lib/recipeParsing": typeof lib_recipeParsing;
  "lib/sharing": typeof lib_sharing;
  "lib/taskAccess": typeof lib_taskAccess;
  "lib/taskProviders/index": typeof lib_taskProviders_index;
  "lib/taskProviders/notion": typeof lib_taskProviders_notion;
  "lib/taskProviders/todoist": typeof lib_taskProviders_todoist;
  "lib/taskProviders/types": typeof lib_taskProviders_types;
  maintenance: typeof maintenance;
  recipeImport: typeof recipeImport;
  recipeNutrition: typeof recipeNutrition;
  recipes: typeof recipes;
  taskLists: typeof taskLists;
  tasks: typeof tasks;
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
