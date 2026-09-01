/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as activity from "../activity.js";
import type * as babies from "../babies.js";
import type * as babyEvents from "../babyEvents.js";
import type * as cascade from "../cascade.js";
import type * as combos from "../combos.js";
import type * as consumption from "../consumption.js";
import type * as foods from "../foods.js";
import type * as foodsLookup from "../foodsLookup.js";
import type * as groups from "../groups.js";
import type * as holdings from "../holdings.js";
import type * as houses from "../houses.js";
import type * as integrations from "../integrations.js";
import type * as kitchen from "../kitchen.js";
import type * as lib_babyAccess from "../lib/babyAccess.js";
import type * as lib_babyEvents from "../lib/babyEvents.js";
import type * as lib_combos from "../lib/combos.js";
import type * as lib_consumption from "../lib/consumption.js";
import type * as lib_finance from "../lib/finance.js";
import type * as lib_foodSearchText from "../lib/foodSearchText.js";
import type * as lib_groupAccess from "../lib/groupAccess.js";
import type * as lib_groupCascade from "../lib/groupCascade.js";
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
import type * as lib_seed_tastingCatalog from "../lib/seed/tastingCatalog.js";
import type * as lib_servings from "../lib/servings.js";
import type * as lib_sharing from "../lib/sharing.js";
import type * as lib_slugs from "../lib/slugs.js";
import type * as lib_stableDigest from "../lib/stableDigest.js";
import type * as lib_storedFiles from "../lib/storedFiles.js";
import type * as lib_taskAccess from "../lib/taskAccess.js";
import type * as lib_taskProviders_index from "../lib/taskProviders/index.js";
import type * as lib_taskProviders_notion from "../lib/taskProviders/notion.js";
import type * as lib_taskProviders_todoist from "../lib/taskProviders/todoist.js";
import type * as lib_taskProviders_types from "../lib/taskProviders/types.js";
import type * as lib_tastings from "../lib/tastings.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations from "../migrations.js";
import type * as mortgages from "../mortgages.js";
import type * as netWorth from "../netWorth.js";
import type * as notes from "../notes.js";
import type * as recipeImport from "../recipeImport.js";
import type * as recipeNutrition from "../recipeNutrition.js";
import type * as recipes from "../recipes.js";
import type * as recurringCosts from "../recurringCosts.js";
import type * as savingsGoals from "../savingsGoals.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as splitScenarios from "../splitScenarios.js";
import type * as taskLists from "../taskLists.js";
import type * as tasks from "../tasks.js";
import type * as tastings from "../tastings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  activity: typeof activity;
  babies: typeof babies;
  babyEvents: typeof babyEvents;
  cascade: typeof cascade;
  combos: typeof combos;
  consumption: typeof consumption;
  foods: typeof foods;
  foodsLookup: typeof foodsLookup;
  groups: typeof groups;
  holdings: typeof holdings;
  houses: typeof houses;
  integrations: typeof integrations;
  kitchen: typeof kitchen;
  "lib/babyAccess": typeof lib_babyAccess;
  "lib/babyEvents": typeof lib_babyEvents;
  "lib/combos": typeof lib_combos;
  "lib/consumption": typeof lib_consumption;
  "lib/finance": typeof lib_finance;
  "lib/foodSearchText": typeof lib_foodSearchText;
  "lib/groupAccess": typeof lib_groupAccess;
  "lib/groupCascade": typeof lib_groupCascade;
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
  "lib/seed/tastingCatalog": typeof lib_seed_tastingCatalog;
  "lib/servings": typeof lib_servings;
  "lib/sharing": typeof lib_sharing;
  "lib/slugs": typeof lib_slugs;
  "lib/stableDigest": typeof lib_stableDigest;
  "lib/storedFiles": typeof lib_storedFiles;
  "lib/taskAccess": typeof lib_taskAccess;
  "lib/taskProviders/index": typeof lib_taskProviders_index;
  "lib/taskProviders/notion": typeof lib_taskProviders_notion;
  "lib/taskProviders/todoist": typeof lib_taskProviders_todoist;
  "lib/taskProviders/types": typeof lib_taskProviders_types;
  "lib/tastings": typeof lib_tastings;
  maintenance: typeof maintenance;
  migrations: typeof migrations;
  mortgages: typeof mortgages;
  netWorth: typeof netWorth;
  notes: typeof notes;
  recipeImport: typeof recipeImport;
  recipeNutrition: typeof recipeNutrition;
  recipes: typeof recipes;
  recurringCosts: typeof recurringCosts;
  savingsGoals: typeof savingsGoals;
  search: typeof search;
  seed: typeof seed;
  splitScenarios: typeof splitScenarios;
  taskLists: typeof taskLists;
  tasks: typeof tasks;
  tastings: typeof tastings;
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
