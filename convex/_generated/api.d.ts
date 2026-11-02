/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as automation from "../automation.js";
import type * as dispatch from "../dispatch.js";
import type * as loans from "../loans.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";
import type * as tools from "../tools.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  automation: typeof automation;
  dispatch: typeof dispatch;
  loans: typeof loans;
  profiles: typeof profiles;
  seed: typeof seed;
  tools: typeof tools;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
