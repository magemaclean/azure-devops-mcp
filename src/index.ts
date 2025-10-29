// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Smithery-compatible entry point for Azure DevOps MCP Server
 * Exports createServer function as required by Smithery deployment
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as azdev from "azure-devops-node-api";
import { z } from "zod";

import { createAuthenticator } from "./auth.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

// Configuration schema for Smithery session configuration
export const configSchema = z.object({
  organization: z.string().describe("Azure DevOps organization name"),
  pat: z.string().describe("Azure DevOps Personal Access Token (required for authentication)"),
  domains: z.array(z.string()).default(["all"]).describe("Domains to enable (default: all)"),
});

type Config = z.infer<typeof configSchema>;

function getAzureDevOpsClient(
  orgUrl: string,
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

// Required by Smithery: Export default createServer function
export default function createServer({ config }: { config: Config }) {
  console.error("[Smithery] Creating Azure DevOps MCP Server");
  console.error(`[Smithery] Organization: ${config.organization}`);

  const orgUrl = `https://dev.azure.com/${config.organization}`;

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

  // Create authenticator using PAT from config
  const authenticator = async () => config.pat;

  // Get enabled domains
  const domainsManager = new DomainsManager(config.domains);
  const enabledDomains = domainsManager.getEnabledDomains();

  // Configure all tools
  configureAllTools(
    server,
    authenticator,
    getAzureDevOpsClient(orgUrl, authenticator, userAgentComposer),
    () => userAgentComposer.userAgent,
    enabledDomains,
    config.organization
  );

  console.error(`[Smithery] Server configured with domains: ${Array.from(enabledDomains).join(", ")}`);

  // Required: Return the MCP server object
  return server.server;
}
