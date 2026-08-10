/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as babies from "../babies.js";
import type * as babyEvents from "../babyEvents.js";
import type * as combos from "../combos.js";
import type * as consumption from "../consumption.js";
import type * as externalTasks from "../externalTasks.js";
import type * as foods from "../foods.js";
import type * as foodsLookup from "../foodsLookup.js";
import type * as groups from "../groups.js";
import type * as integrations from "../integrations.js";
import type * as lib_babyAccess from "../lib/babyAccess.js";
import type * as lib_babyEvents from "../lib/babyEvents.js";
import type * as lib_combos from "../lib/combos.js";
import type * as lib_consumption from "../lib/consumption.js";
import type * as lib_foodSearchText from "../lib/foodSearchText.js";
import type * as lib_groupAccess from "../lib/groupAccess.js";
import type * as lib_groupSlugs from "../lib/groupSlugs.js";
import type * as lib_nutrition from "../lib/nutrition.js";
import type * as lib_nutritionAiEstimate from "../lib/nutritionAiEstimate.js";
import type * as lib_offFetch from "../lib/offFetch.js";
import type * as lib_offMapping from "../lib/offMapping.js";
import type * as lib_recipeAiExtract from "../lib/recipeAiExtract.js";
import type * as lib_recipeParsing from "../lib/recipeParsing.js";
import type * as lib_seed_apply from "../lib/seed/apply.js";
import type * as lib_seed_catalogFoods from "../lib/seed/catalogFoods.js";
import type * as lib_seed_sampleHousehold from "../lib/seed/sampleHousehold.js";
import type * as lib_servings from "../lib/servings.js";
import type * as lib_sharing from "../lib/sharing.js";
import type * as lib_slugs from "../lib/slugs.js";
import type * as lib_stableDigest from "../lib/stableDigest.js";
import type * as lib_storedFiles from "../lib/storedFiles.js";
import type * as lib_taskAccess from "../lib/taskAccess.js";
import type * as lib_taskCache from "../lib/taskCache.js";
import type * as lib_taskProviders_index from "../lib/taskProviders/index.js";
import type * as lib_taskProviders_notion from "../lib/taskProviders/notion.js";
import type * as lib_taskProviders_todoist from "../lib/taskProviders/todoist.js";
import type * as lib_taskProviders_types from "../lib/taskProviders/types.js";
import type * as maintenance from "../maintenance.js";
import type * as recipeImport from "../recipeImport.js";
import type * as recipeNutrition from "../recipeNutrition.js";
import type * as recipes from "../recipes.js";
import type * as seed from "../seed.js";
import type * as taskLists from "../taskLists.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  babies: typeof babies;
  babyEvents: typeof babyEvents;
  combos: typeof combos;
  consumption: typeof consumption;
  externalTasks: typeof externalTasks;
  foods: typeof foods;
  foodsLookup: typeof foodsLookup;
  groups: typeof groups;
  integrations: typeof integrations;
  "lib/babyAccess": typeof lib_babyAccess;
  "lib/babyEvents": typeof lib_babyEvents;
  "lib/combos": typeof lib_combos;
  "lib/consumption": typeof lib_consumption;
  "lib/foodSearchText": typeof lib_foodSearchText;
  "lib/groupAccess": typeof lib_groupAccess;
  "lib/groupSlugs": typeof lib_groupSlugs;
  "lib/nutrition": typeof lib_nutrition;
  "lib/nutritionAiEstimate": typeof lib_nutritionAiEstimate;
  "lib/offFetch": typeof lib_offFetch;
  "lib/offMapping": typeof lib_offMapping;
  "lib/recipeAiExtract": typeof lib_recipeAiExtract;
  "lib/recipeParsing": typeof lib_recipeParsing;
  "lib/seed/apply": typeof lib_seed_apply;
  "lib/seed/catalogFoods": typeof lib_seed_catalogFoods;
  "lib/seed/sampleHousehold": typeof lib_seed_sampleHousehold;
  "lib/servings": typeof lib_servings;
  "lib/sharing": typeof lib_sharing;
  "lib/slugs": typeof lib_slugs;
  "lib/stableDigest": typeof lib_stableDigest;
  "lib/storedFiles": typeof lib_storedFiles;
  "lib/taskAccess": typeof lib_taskAccess;
  "lib/taskCache": typeof lib_taskCache;
  "lib/taskProviders/index": typeof lib_taskProviders_index;
  "lib/taskProviders/notion": typeof lib_taskProviders_notion;
  "lib/taskProviders/todoist": typeof lib_taskProviders_todoist;
  "lib/taskProviders/types": typeof lib_taskProviders_types;
  maintenance: typeof maintenance;
  recipeImport: typeof recipeImport;
  recipeNutrition: typeof recipeNutrition;
  recipes: typeof recipes;
  seed: typeof seed;
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
