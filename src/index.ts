#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as azdev from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Parse command line arguments - returns parsed args
function parseArguments() {
  return yargs(hideBin(process.argv))
    .scriptName("mcp-server-azuredevops")
    .usage("Usage: $0 <organization> [options]")
    .version(packageVersion)
    .command("$0 <organization> [options]", "Azure DevOps MCP Server", (yargs) => {
      yargs.positional("organization", {
        describe: "Azure DevOps organization name",
        type: "string",
        demandOption: true,
      });
    })
    .option("domains", {
      alias: "d",
      describe: "Domain(s) to enable: 'all' for everything, or specific domains like 'repositories builds work'. Defaults to 'all'.",
      type: "string",
      array: true,
      default: "all",
    })
    .option("authentication", {
      alias: "a",
      describe: "Type of authentication to use. Supported values are 'interactive', 'azcli', 'env', and 'pat' (default: 'interactive')",
      type: "string",
      choices: ["interactive", "azcli", "env", "pat"],
      default: defaultAuthenticationType,
    })
    .option("tenant", {
      alias: "t",
      describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
      type: "string",
    })
    .help()
    .parseSync();
}

function getAzureDevOpsClient(orgUrl: string, getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer): () => Promise<azdev.WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    const authHandler = azdev.getBearerHandler(accessToken);
    const connection = new azdev.WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  console.error("[MCP] Starting Azure DevOps MCP Server...");
  
  // Parse arguments inside main() so they're available when server actually starts
  const argv = parseArguments();
  const orgName = argv.organization as string;
  const orgUrl = "https://dev.azure.com/" + orgName;
  
  console.error(`[MCP] Organization: ${orgName}`);
  console.error(`[MCP] Authentication: ${argv.authentication}`);
  
  // Get enabled domains
  const domainsManager = new DomainsManager(argv.domains);
  const enabledDomains = domainsManager.getEnabledDomains();
  
  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
    icons: [
      {
        src: "https://cdn.vsassets.io/content/icons/favicon.ico",
      },
    ],
  });
  console.error("[MCP] McpServer created");

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    console.error("[MCP] Server initialized by client");
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };
  
  // For PAT authentication, we don't need tenant lookup (which can block startup)
  // For other auth types, tenant lookup happens lazily on first tool use
  let tenantId: string | undefined = argv.tenant;
  if (argv.authentication !== "pat") {
    console.error("[MCP] Looking up tenant ID...");
    try {
      tenantId = (await getOrgTenant(orgName)) ?? argv.tenant;
      console.error(`[MCP] Tenant ID: ${tenantId || 'none'}`);
    } catch (error) {
      // If tenant lookup fails, continue without it - tools will attempt auth without tenant
      console.error("[MCP] Warning: Could not lookup organization tenant ID:", error);
    }
  } else {
    console.error("[MCP] Skipping tenant lookup for PAT authentication");
  }
  
  console.error("[MCP] Creating authenticator...");
  const authenticator = createAuthenticator(argv.authentication, tenantId);
  console.error("[MCP] Authenticator created");

  // removing prompts untill further notice
  // configurePrompts(server);

  console.error("[MCP] Configuring tools...");
  configureAllTools(server, authenticator, getAzureDevOpsClient(orgUrl, authenticator, userAgentComposer), () => userAgentComposer.userAgent, enabledDomains, orgName);
  console.error(`[MCP] Tools configured for domains: ${Array.from(enabledDomains).join(', ')}`);

  // Smithery's streamable-http transport expects the server WITHOUT transport connected
  // For local/stdio usage, we connect StdioServerTransport
  const connectTransport = process.env.NODE_ENV !== 'smithery' && !process.env.SMITHERY_MODE;
  
  if (connectTransport) {
    console.error("[MCP] Connecting stdio transport for local usage...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[MCP] Transport connected - server ready");
  } else {
    console.error("[MCP] Server ready (transport will be connected by Smithery wrapper)");
  }
  
  return server;
}

// Export for Smithery's streamable-http transport
export default main;
