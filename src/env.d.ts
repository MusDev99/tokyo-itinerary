/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** The signed-in editor (from the session cookie), or null for guests */
    user: import('./utils/auth').SessionUser | null;
  }
}
