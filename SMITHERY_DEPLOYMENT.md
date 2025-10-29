# Smithery Deployment Configuration

This document describes how to deploy the Azure DevOps MCP Server to Smithery.

## Prerequisites

- Azure DevOps organization
- Smithery account

## Quick Setup (Recommended: PAT Token)

The easiest way to deploy is using a Personal Access Token (PAT):

### 1. Create Azure DevOps Personal Access Token

1. Go to your Azure DevOps organization: `https://dev.azure.com/{YOUR_ORG}`
2. Click on **User Settings** (icon in top right) → **Personal Access Tokens**
3. Click **+ New Token**
4. Configure the token:
   - **Name**: `smithery-mcp-server`
   - **Organization**: Select your organization
   - **Expiration**: Choose appropriate duration (90 days, 1 year, or custom)
   - **Scopes**: Select the scopes your MCP server needs:
     - ✅ **Work Items** - Read, Write & Manage (for work item operations)
     - ✅ **Code** - Read & Write (for repository operations)  
     - ✅ **Build** - Read & Execute (for pipeline operations)
     - ✅ **Release** - Read, Write & Execute (for release operations)
     - ✅ **Wiki** - Read & Write (for wiki operations)
     - ✅ **Test Management** - Read & Write (for test operations)
     - Or select **Full access** for complete access
5. Click **Create**
6. **Copy the token immediately** - it won't be shown again!

### 2. Configure Smithery Environment Variable

In your Smithery deployment settings, add this environment variable:

| Variable | Value | Description |
|----------|-------|-------------|
| `AZURE_DEVOPS_PAT` | `<your-pat-token>` | Personal Access Token from step 1 |

Alternatively, you can use `ADO_PAT` as the variable name - both are supported.

### 3. Update smithery.yaml

Ensure your `smithery.yaml` is configured with:

```yaml
runtime: typescript
transport: streamable-http
args:
  - <YOUR_ORG_NAME>  # Your Azure DevOps organization name
  - --authentication
  - pat
```

### 4. Deploy

Commit and push your changes:

```bash
git add smithery.yaml SMITHERY_DEPLOYMENT.md src/auth.ts src/index.ts
git commit -m "Add PAT token authentication for Smithery deployment"
git push
```

Smithery will automatically deploy your MCP server with the configured environment variable.

### 5. Test Locally (Optional)

Test PAT authentication locally before deploying:

```bash
export AZURE_DEVOPS_PAT="<your-pat-token>"
npm run build
node dist/index.js <YOUR_ORG> --authentication pat
```

## Alternative: Service Principal (Advanced)

For production deployments or when you need programmatic access, you can use Azure Service Principals:

### 1. Create Service Principal

```bash
az ad sp create-for-rbac --name "smithery-ado-mcp" --role contributor
```

Save the `appId`, `password`, and `tenant` values.

### 2. Grant Azure DevOps Access

Add the service principal to your Azure DevOps organization:
- Go to: `https://dev.azure.com/{YOUR_ORG}/_settings/users`
- Add the service principal using its `appId`
- Assign appropriate access level

### 3. Configure Environment Variables

Set these in Smithery:
- `AZURE_CLIENT_ID` = `<appId>`
- `AZURE_CLIENT_SECRET` = `<password>`
- `AZURE_TENANT_ID` = `<tenant>`

### 4. Update smithery.yaml

```yaml
runtime: typescript
transport: streamable-http
args:
  - <YOUR_ORG_NAME>
  - --authentication
  - env
```

## Troubleshooting

### PAT Token Errors

If you see authentication errors with PAT:

1. **Verify token is set correctly** in Smithery environment variables (`AZURE_DEVOPS_PAT` or `ADO_PAT`)
2. **Check token hasn't expired** - PAT tokens have expiration dates
3. **Verify token scopes** - ensure the PAT has permissions for operations you're performing
4. **Test token manually** using Azure DevOps REST API:
   ```bash
   curl -u :<YOUR_PAT> https://dev.azure.com/{ORG}/_apis/projects?api-version=7.0
   ```

### Permission Errors

If you get 403 Forbidden errors:

1. **Review PAT token scopes** - the token needs appropriate permissions
2. **Check project access** - ensure you have access to the projects you're querying
3. **Verify organization** - ensure you're using the correct organization name

### Token Expiration

PAT tokens expire. When yours expires:

1. Create a new PAT token following the same steps
2. Update the `AZURE_DEVOPS_PAT` environment variable in Smithery
3. Redeploy or restart your MCP server

## Security Best Practices

- **Never commit PAT tokens to git** - always use environment variables
- **Use scoped tokens** - grant only the permissions needed for your MCP server
- **Set appropriate expiration** - balance security with maintenance burden
- **Rotate tokens regularly** - especially before expiration
- **Monitor token usage** - review Azure DevOps usage patterns
- **Revoke unused tokens** - clean up old tokens from your PAT management page

## Additional Resources

- [Azure DevOps Personal Access Tokens](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
- [Azure DevOps REST API Authentication](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/authentication-guidance)
- [Smithery Documentation](https://smithery.ai/docs)

