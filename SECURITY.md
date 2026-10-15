# Security policy

## Supported versions

Only the latest release of `rivian-mcp` on npm gets security fixes. The Cloudflare Worker has no releases: update your deployed copy from `main`.

## Reporting a vulnerability

Do not open a public issue for a security problem.

Report it privately through [GitHub private vulnerability reporting](https://github.com/zentered-studios/rivian-mcp/security/advisories/new). Include:

- the affected component: MCP server, CLI, or Cloudflare Worker
- the version or commit
- steps to reproduce, and what an attacker gains

We aim to acknowledge a report within 7 days. We publish a GitHub security advisory once a fix is released, and credit the reporter unless they ask us not to.

## Scope

In scope:

- the stdio MCP server and CLI in `src/`
- session storage in `~/.rivian-mcp/session.json`
- the Cloudflare Worker in `worker/`: OAuth sign-in, the owner check, the recorder and its D1 data

Out of scope:

- Rivian's own API and apps. Report those to Rivian.
- Problems that need an attacker who already controls your machine, your Cloudflare account, or your Rivian account.

This project is read-only against the Rivian API. A way to make it send vehicle commands or write data to Rivian is in scope and high priority.
