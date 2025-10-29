// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Smithery-specific entry point using Smithery SDK's createStatefulServer
 * This properly integrates with Smithery's HTTP transport
 */

import { createStatefulServer } from "@smithery/sdk";
import type { CreateServerArg } from "@smithery/sdk/server/stateful.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as azdev from "azure-devops-node-api";
import { z } from "zod";

import { createAuthenticator } from "./auth.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

// Configuration schema for Smithery
const ConfigSchema = z.object({
  organization: z.string().describe("Azure DevOps organization name"),
  authentication: z.enum(["pat", "interactive", "azcli", "env"]).describe("Authentication method"),
  domains: z.array(z.string()).describe("Domains to enable"),
});

type Config = z.infer<typeof ConfigSchema>;

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

// Server factory function - called for each new session
function createMcpServer({ sessionId, config, logger }: CreateServerArg<Config>): Server {
  logger.info(`Creating MCP server for session ${sessionId}`);
  logger.info(`Organization: ${config.organization}, Auth: ${config.authentication}`);

  const orgUrl = `https://dev.azure.com/${config.organization}`;
  
  const server = new Server(
    {
      name: "Azure DevOps MCP Server",
      version: packageVersion,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.oninitialized = () => {
    logger.info("Server initialized by client");
    userAgentComposer.appendMcpClientInfo(server.getClientVersion());
  };

  // Create authenticator (no tenant lookup for PAT)
  const authenticator = createAuthenticator(config.authentication, undefined);

  // Get enabled domains
  const domainsManager = new DomainsManager(config.domains);
  const enabledDomains = domainsManager.getEnabledDomains();

  // Configure tools using the MCP SDK Server (not McpServer wrapper)
  const serverWrapper = { server } as any; // Wrap for compatibility with existing tool configuration
  configureAllTools(
    serverWrapper,
    authenticator,
    getAzureDevOpsClient(orgUrl, authenticator, userAgentComposer),
    () => userAgentComposer.userAgent,
    enabledDomains,
    config.organization
  );

  logger.info(`Server configured with domains: ${Array.from(enabledDomains).join(", ")}`);
  
  return server;
}

// Export the Express app from Smithery SDK's stateful server
const { app } = createStatefulServer(createMcpServer, {
  schema: ConfigSchema,
  logLevel: "info",
});

export default app;

