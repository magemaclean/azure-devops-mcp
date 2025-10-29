// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Smithery entry point - simple server factory
 * Smithery's build system handles the HTTP transport wrapper
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as azdev from "azure-devops-node-api";

import { createAuthenticator } from "./auth.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

// Read config from environment variables (set in smithery.yaml)
const orgName = process.env.AZURE_DEVOPS_ORG || "jestaisinc";
const authType = process.env.AZURE_DEVOPS_AUTH || "pat";
const orgUrl = `https://dev.azure.com/${orgName}`;

console.error(`[Smithery] Initializing Azure DevOps MCP for org: ${orgName}`);

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

// Create the MCP server
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

// Create authenticator (PAT - no tenant lookup)
const authenticator = createAuthenticator(authType, undefined);

// Enable all domains
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

console.error(`[Smithery] Server configured with domains: ${Array.from(enabledDomains).join(", ")}`);

// Export the underlying Server instance for Smithery's HTTP wrapper
export default server.server;

