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
import type * as aiUsage from "../aiUsage.js";
import type * as babies from "../babies.js";
import type * as babyEvents from "../babyEvents.js";
import type * as calendar from "../calendar.js";
import type * as cascade from "../cascade.js";
import type * as dataExport from "../dataExport.js";
import type * as groups from "../groups.js";
import type * as holdings from "../holdings.js";
import type * as houses from "../houses.js";
import type * as integrations from "../integrations.js";
import type * as kitchen from "../kitchen.js";
import type * as lib_aiUsage from "../lib/aiUsage.js";
import type * as lib_anthropic from "../lib/anthropic.js";
import type * as lib_babyEvents from "../lib/babyEvents.js";
import type * as lib_calendar from "../lib/calendar.js";
import type * as lib_dataExport from "../lib/dataExport.js";
import type * as lib_finance from "../lib/finance.js";
import type * as lib_groupAccess from "../lib/groupAccess.js";
import type * as lib_groupCascade from "../lib/groupCascade.js";
import type * as lib_groupSlugs from "../lib/groupSlugs.js";
import type * as lib_kitchen from "../lib/kitchen.js";
import type * as lib_nutrition from "../lib/nutrition.js";
import type * as lib_nutritionAiEstimate from "../lib/nutritionAiEstimate.js";
import type * as lib_order from "../lib/order.js";
import type * as lib_recipeAiExtract from "../lib/recipeAiExtract.js";
import type * as lib_recipeFields from "../lib/recipeFields.js";
import type * as lib_recipeParsing from "../lib/recipeParsing.js";
import type * as lib_safeFetch from "../lib/safeFetch.js";
import type * as lib_seed_apply from "../lib/seed/apply.js";
import type * as lib_seed_sampleHousehold from "../lib/seed/sampleHousehold.js";
import type * as lib_seed_tastingCatalog from "../lib/seed/tastingCatalog.js";
import type * as lib_sharing from "../lib/sharing.js";
import type * as lib_slugs from "../lib/slugs.js";
import type * as lib_stableDigest from "../lib/stableDigest.js";
import type * as lib_storedFiles from "../lib/storedFiles.js";
import type * as lib_taskFields from "../lib/taskFields.js";
import type * as lib_taskLists from "../lib/taskLists.js";
import type * as lib_taskProviders_index from "../lib/taskProviders/index.js";
import type * as lib_taskProviders_notion from "../lib/taskProviders/notion.js";
import type * as lib_taskProviders_todoist from "../lib/taskProviders/todoist.js";
import type * as lib_taskProviders_types from "../lib/taskProviders/types.js";
import type * as lib_tastings from "../lib/tastings.js";
import type * as lib_validators from "../lib/validators.js";
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
  aiUsage: typeof aiUsage;
  babies: typeof babies;
  babyEvents: typeof babyEvents;
  calendar: typeof calendar;
  cascade: typeof cascade;
  dataExport: typeof dataExport;
  groups: typeof groups;
  holdings: typeof holdings;
  houses: typeof houses;
  integrations: typeof integrations;
  kitchen: typeof kitchen;
  "lib/aiUsage": typeof lib_aiUsage;
  "lib/anthropic": typeof lib_anthropic;
  "lib/babyEvents": typeof lib_babyEvents;
  "lib/calendar": typeof lib_calendar;
  "lib/dataExport": typeof lib_dataExport;
  "lib/finance": typeof lib_finance;
  "lib/groupAccess": typeof lib_groupAccess;
  "lib/groupCascade": typeof lib_groupCascade;
  "lib/groupSlugs": typeof lib_groupSlugs;
  "lib/kitchen": typeof lib_kitchen;
  "lib/nutrition": typeof lib_nutrition;
  "lib/nutritionAiEstimate": typeof lib_nutritionAiEstimate;
  "lib/order": typeof lib_order;
  "lib/recipeAiExtract": typeof lib_recipeAiExtract;
  "lib/recipeFields": typeof lib_recipeFields;
  "lib/recipeParsing": typeof lib_recipeParsing;
  "lib/safeFetch": typeof lib_safeFetch;
  "lib/seed/apply": typeof lib_seed_apply;
  "lib/seed/sampleHousehold": typeof lib_seed_sampleHousehold;
  "lib/seed/tastingCatalog": typeof lib_seed_tastingCatalog;
  "lib/sharing": typeof lib_sharing;
  "lib/slugs": typeof lib_slugs;
  "lib/stableDigest": typeof lib_stableDigest;
  "lib/storedFiles": typeof lib_storedFiles;
  "lib/taskFields": typeof lib_taskFields;
  "lib/taskLists": typeof lib_taskLists;
  "lib/taskProviders/index": typeof lib_taskProviders_index;
  "lib/taskProviders/notion": typeof lib_taskProviders_notion;
  "lib/taskProviders/todoist": typeof lib_taskProviders_todoist;
  "lib/taskProviders/types": typeof lib_taskProviders_types;
  "lib/tastings": typeof lib_tastings;
  "lib/validators": typeof lib_validators;
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
