#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CLI entry point for local/stdio usage
 * This file is used when running: npx @azure-devops/mcp or node dist/cli.js
 * Smithery uses src/index.ts directly without this wrapper
 */

import main from "./index.js";

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

