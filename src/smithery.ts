// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Smithery-specific entry point for streamable-http transport
 * This file exports a simple server factory without CLI argument parsing
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as azdev from "azure-devops-node-api";

import { createAuthenticator } from "./auth.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

// Get config from environment variables (Smithery passes these)
const orgName = process.env.AZURE_DEVOPS_ORG || "jestaisinc";
const orgUrl = `https://dev.azure.com/${orgName}`;
const authType = process.env.AUTH_TYPE || "pat";

function getAzureDevOpsClient(
  getAzureDevOpsToken: () => Promise<string>,
  userAgentComposer: UserAgentComposer
): () => Promise<azdev.WebApi> {
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

// Export a simple function that creates and returns the server
export default function createServer() {
  console.error(`[Smithery] Creating MCP server for org: ${orgName}`);
  
  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
    icons: [
      {
        src: "https://cdn.vsassets.io/content/icons/favicon.ico",
      },
    ],
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    console.error("[Smithery] Server initialized by client");
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };

  // Use PAT authentication (no tenant lookup needed)
  const authenticator = createAuthenticator(authType, undefined);

  // Enable all domains for Smithery deployment
  const domainsManager = new DomainsManager(["all"]);
  const enabledDomains = domainsManager.getEnabledDomains();

  // Configure tools
  configureAllTools(
    server,
    authenticator,
    getAzureDevOpsClient(authenticator, userAgentComposer),
    () => userAgentComposer.userAgent,
    enabledDomains,
    orgName
  );

  console.error("[Smithery] Server configured and ready");
  
  // Return the underlying Server instance for Smithery's HTTP wrapper
  return server.server;
}

