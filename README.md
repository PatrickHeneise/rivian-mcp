# Rivian MCP

Ask Claude or ChatGPT about your Rivian and every drive you take. It runs in your own Cloudflare account, so you control the recorded data. Tool results go to the AI app you connect; see [data handling](docs/cloudflare.md#your-data).

It only reads from Rivian. It sends no commands to your vehicle and changes no settings. This project is unofficial and not affiliated with or endorsed by Rivian.

![Claude showing a recorded drive with its route on a map, distance, speed and elevation](docs/images/claude-show-drive.png)

## Self-host on Cloudflare

You need:

- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account. See [cost](docs/cloudflare.md#cost) and [removal](docs/cloudflare.md#remove-it).
- A free [GitHub](https://github.com/signup) account. The Deploy button asks you to connect it, and Cloudflare keeps your copy of the project there.
- Your Rivian email and password, and the phone or email that gets Rivian's one-time code.

To skip GitHub, [deploy from a terminal](docs/cloudflare.md#set-it-up-from-a-terminal-instead) with Node.js 24.

### 1. Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zentered-studios/rivian-mcp)

1. Select the button and sign in to Cloudflare.
2. Connect your GitHub account when asked.
3. On **Create and deploy**, keep the suggested names and select **Deploy**.
4. In the Worker's **Settings**, then **Build**, clear **Enable Preview Builds**.

The steps in detail, with screenshots and account sign-up, are in [docs/cloudflare.md](docs/cloudflare.md#step-1-deploy).

The first Rivian account that signs in owns your copy. Connect Claude right after you deploy.

Cloudflare creates the storage and starts the server. It shows your address:

```text
https://rivian-mcp.<your-name>.workers.dev
```

Your connector address is that address plus `/mcp`:

```text
https://rivian-mcp.<your-name>.workers.dev/mcp
```

### 2. Connect Claude

Works on claude.ai and in the Claude desktop and mobile apps.

1. Open **Settings**, then **Connectors**, then **Add custom connector**.
2. Name it `Rivian` and paste your connector address.
3. Select **Add**, then **Connect**.
4. Sign in with your Rivian email and password, then enter the one-time code Rivian sends you.

Recording starts as soon as you are signed in. In a new chat, ask "Is the recorder running?"

ChatGPT and Codex work too: [Connect ChatGPT](docs/cloudflare.md#connect-chatgpt), [Connect Codex](docs/cloudflare.md#connect-codex).

### What you can ask

- "Show my last drive."
- "List my drives this week."
- "Show my stats for the last 30 days."
- "Show my charging sessions."
- "Add my last drive to Roadbook."
- "What's my battery level?"
- "Is there a software update available?"
- "Are all the doors locked?"

### Take your drives to Roadbook

[Roadbook](https://roadbook.us) is where you plan electric road trips into the wild places of North America, together, and tell the story afterward. This server exports recorded drives with their route, places and stats in the `roadbook.drive/1` format. Importing them requires a Roadbook connector that exposes `import_drive`; availability and privacy behavior on that side must be checked separately. The export contract is in [docs/roadbook.md](docs/roadbook.md).

### Tools

| Tool                           | What it does                                                        |
| ------------------------------ | ------------------------------------------------------------------- |
| `show_drive`                   | One drive with its route map and speed, energy and elevation charts |
| `show_stats`                   | Totals and efficiency for a period, with every route on one map     |
| `show_charging`                | Charging sessions with energy added, power and battery level curves |
| `list_drives`                  | Drives with places, local times, energy, elevation and quality      |
| `get_drive`                    | One drive as a GeoJSON Feature with the route and all stats         |
| `export_drive`                 | One drive or a date range as a Roadbook payload, GeoJSON or GPX     |
| `recorder_status`              | Whether the recorder is signed in and connected                     |
| `rivian_get_user_info`         | Your account, vehicles and software versions                        |
| `rivian_get_vehicle_state`     | Live battery, doors, tires, location, climate and OTA status        |
| `rivian_get_ota_status`        | Current and available software versions                             |
| `rivian_get_charging_session`  | Active charging session                                             |
| `rivian_get_charging_history`  | Past charging sessions with energy, cost and location               |
| `rivian_get_charging_schedule` | Your charging schedule                                              |
| `rivian_get_drivers_and_keys`  | Drivers and their phone keys and key fobs                           |

Cost, updates, where your data lives and how to remove it are in [docs/cloudflare.md](docs/cloudflare.md).

## Run it locally

The npm package runs on your computer as a CLI or a local MCP server. It needs Node.js 24 or newer. It answers questions about your Rivian as it is now. It does not record drives, because it only runs while you use it.

### CLI

```bash
npx rivian-mcp ota    # software update status
npx rivian-mcp stats  # full vehicle state
```

Or install it globally:

```bash
npm install -g rivian-mcp
rivian ota
rivian stats
```

The CLI reads `RIVIAN_EMAIL` and `RIVIAN_PASSWORD` from the environment, or asks for them. Password and one-time-code prompts require an interactive terminal.

### Local MCP server

```bash
claude mcp add rivian \
  -e RIVIAN_EMAIL=your@email.com \
  -e RIVIAN_PASSWORD=your-password \
  -- npx rivian-mcp
```

<details>
<summary>Manual config</summary>

Add to `~/.claude.json` or your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "rivian": {
      "command": "npx",
      "args": ["-y", "rivian-mcp"],
      "env": {
        "RIVIAN_EMAIL": "your@email.com",
        "RIVIAN_PASSWORD": "your-password"
      }
    }
  }
}
```

</details>

Rivian asks for a one-time code on every new sign-in:

1. Ask Claude, "Log in to Rivian."
2. Rivian sends a code to your phone or email.
3. Tell Claude, "The code is 123456."

The local server adds `rivian_login` and `rivian_submit_otp` for this step. The CLI and the local server share the session in `~/.rivian-mcp/session.json`. It is reused for up to 90 days.

## Support

If you are thinking about getting a Rivian, my referral code gets you benefits on your purchase and supports this project:

[Get a Rivian R1 with referral benefits](https://rivian.com/configurations/list?reprCode=PATRICK4568756)

## Development

```sh
git clone https://github.com/zentered-studios/rivian-mcp.git
cd rivian-mcp
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx wrangler deploy --dry-run
```

Use Node.js 24 or newer. Tests use fixtures, mocked requests and an in-memory SQLite database; they do not need Rivian credentials or a Cloudflare account. The dry run builds the Worker and embedded views without deploying.

For local Worker development, run `npm run worker:dev` and apply the schema with `npx wrangler d1 migrations apply DB --local`. No `.dev.vars` file is required. To pin the owner, create an ignored `.dev.vars` containing `RIVIAN_EMAIL="you@example.com"`. Hosted AI connectors need a publicly reachable HTTPS Worker; localhost is for development.

The shared live-query tools are in `src/tools.ts`; local login tools are in `src/mcp-server.ts`. Recorder tools are in `worker/src/mcp.ts`, and the embedded views are in `worker/ui/`. Add a regression test for behavior changes. Rivian access must remain read-only apart from authentication.

See [tool-call examples](docs/examples.md) for argument shapes and [the review report](docs/codebase-review.md) for findings and verification limits.


The Claude Code plugin teaches Claude this codebase and the Rivian API: confirmed vehicle state fields, the auth flow and the formatters.

```bash
claude /plugin marketplace add zentered-studios/rivian-mcp
claude /plugin install rivian-mcp@rivian-ai
```

## References

- [Rivian API Docs](https://rivian-api.kaedenb.org/app/), community-maintained
- [rivian-python-client](https://github.com/bretterer/rivian-python-client), the Python client this is based on
- [home-assistant-rivian](https://github.com/bretterer/home-assistant-rivian), the Home Assistant integration
