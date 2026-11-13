import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WATCHPACK_PATCH_SYMBOL = Symbol.for("kff.watchpack.serializedAggregated");

function warmRouteDirectoryCache(dir: string) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      try {
        fs.statSync(fullPath);
      } catch {
        // Ignore transient stat failures while warming the OS cache.
      }
      if (entry.isDirectory()) {
        warmRouteDirectoryCache(fullPath);
      }
    }
  } catch {
    // Ignore missing directories during build/config evaluation.
  }
}

function installDevWatchpackGuard() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  for (const rootFile of [".env", ".env.local", ".env.development", "tsconfig.json"]) {
    try {
      fs.statSync(path.join(ROOT_DIR, rootFile));
    } catch {
      // Ignore optional root files.
    }
  }
  warmRouteDirectoryCache(path.join(ROOT_DIR, "src", "app"));

  try {
    const require = createRequire(import.meta.url);
    const Watchpack = require("next/dist/compiled/watchpack") as {
      prototype?: {
        [WATCHPACK_PATCH_SYMBOL]?: boolean;
        options?: { aggregateTimeout?: number };
        watcherOptions?: { aggregateTimeout?: number };
        on: (event: string, listener: (...args: unknown[]) => unknown) => unknown;
      };
    };

    const proto = Watchpack?.prototype;
    if (!proto || proto[WATCHPACK_PATCH_SYMBOL]) {
      return;
    }

    const originalOn = proto.on;
    proto.on = function patchedWatchpackOn(
      this: {
        options?: { aggregateTimeout?: number };
        watcherOptions?: { aggregateTimeout?: number };
      },
      event: string,
      listener: (...args: unknown[]) => unknown
    ) {
      if (event !== "aggregated" || typeof listener !== "function") {
        return originalOn.call(this, event, listener);
      }

      // Next.js 16 sets aggregateTimeout: 5ms in setup-dev-bundler, which splits
      // nested route-group scans across multiple overlapping async 'aggregated'
      // callbacks on Windows and allows an earlier partial scan to overwrite
      // serverFields.appPathRoutes after a later complete scan finishes.
      if (this.options && this.options.aggregateTimeout === 5) {
        this.options.aggregateTimeout = 100;
      }
      if (this.watcherOptions && this.watcherOptions.aggregateTimeout === 5) {
        this.watcherOptions.aggregateTimeout = 100;
      }

      let running = false;
      let pendingArgs: unknown[] | null = null;

      const serializedListener = async (...args: unknown[]) => {
        if (running) {
          pendingArgs = args;
          return;
        }
        running = true;
        let currentArgs: unknown[] | null = args;
        try {
          while (currentArgs !== null) {
            const invokeArgs = currentArgs;
            currentArgs = null;
            await listener.apply(this, invokeArgs);
            if (pendingArgs !== null) {
              currentArgs = pendingArgs;
              pendingArgs = null;
            }
          }
        } finally {
          running = false;
        }
      };

      return originalOn.call(this, event, serializedListener);
    };

    proto[WATCHPACK_PATCH_SYMBOL] = true;
  } catch {
    // Fallback gracefully if Next.js internals change.
  }
}

installDevWatchpackGuard();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

