# Azure DevOps MCP Server - Agent Instructions

## Overview

This MCP server provides tools for interacting with Azure DevOps. It exposes a thin abstraction layer over Azure DevOps REST APIs, letting you handle complex reasoning while the tools handle data access.

## Key Principles

- **Simple & Focused**: Each tool does one thing well. Use multiple tools for complex tasks.
- **Always Check Available Tools**: Before attempting any Azure DevOps operation, check if a relevant tool exists.
- **Domain-Specific**: Tools are organized by domains (core, work, work-items, repositories, pipelines, wiki, test-plans, search, advanced-security).

## Available Domains

Tools are organized into these domains:

- **core**: Projects, teams, identities
- **work**: Iterations management
- **work-items**: Backlogs, work items, comments, linking
- **repositories**: Repos, pull requests, branches, commits
- **pipelines**: Builds, definitions, releases
- **wiki**: Wiki pages and content
- **test-plans**: Test plans, cases, results
- **search**: Search across code, wiki, work items
- **advanced-security**: Security alerts

## Common Workflows

### Starting Any Task
1. First, list projects with `core_list_projects` to get the project name/ID
2. For team-specific operations, use `core_list_project_teams` to identify the team

### Working with Work Items
- Use `wit_my_work_items` to find user's work items
- Use `wit_get_work_item` for details (use `expand: "relations"` to get child items)
- Use `wit_update_work_item` for updates
- Link work items with `wit_work_items_link` or link to PRs with `wit_link_work_item_to_pull_request`

### Repository Operations
- List repos: `repo_list_repos_by_project`
- List PRs: `repo_list_pull_requests_by_repo` or `repo_list_pull_requests_by_project`
- Get PR details: `repo_get_pull_request_by_id` (use `includeWorkItemRefs: true` for linked work items)
- List PR threads/comments: `repo_list_pull_request_threads` and `repo_list_pull_request_thread_comments`

### Pipeline Operations
- List build definitions: `build_get_definitions`
- Get builds: `build_get_builds`
- Trigger builds: `build_run_build`
- Get build logs: `build_get_log` or `build_get_log_by_id`

### Wiki Operations
- List wikis: `wiki_list_wikis`
- List pages: `wiki_list_pages`
- Get page content: `wiki_get_page_content`
- Create/update pages: `wiki_create_or_update_page`

## Authentication

The server handles authentication automatically:
- **interactive** (default): Browser-based OAuth flow
- **azcli**: Uses Azure CLI credentials
- **env**: Uses environment variables

Users authenticate once per session when the first tool is invoked.

## Best Practices

1. **Always specify required IDs**: Use project names/IDs, repo IDs, work item IDs explicitly
2. **Use filters**: Most list operations support filtering - use them to narrow results
3. **Check tool schemas**: Review input schemas to understand required vs optional parameters
4. **Handle pagination**: Use `top` and `skip` parameters for large result sets
5. **Expand related data**: Use `expand` parameters to get related entities in one call
6. **Project context**: Most operations require a project - always get this first

## Error Handling

- If authentication fails, the user will be prompted to log in via browser
- If a tool returns an error about missing permissions, the user may need higher access levels
- If a resource isn't found, verify IDs are correct and the user has access to the organization/project

## Example Prompts

- "List my work items in project 'Contoso'"
- "Show me active pull requests in the 'ContosoApp' repository"
- "Get the latest build status for 'Contoso' project"
- "Create a wiki page at '/Documentation/API' with REST API documentation"
- "List all teams in the 'Contoso' project"
- "Show me failed builds from the last 7 days"

