# Rivian MCP

Read-only [MCP server](https://modelcontextprotocol.io) for Rivian's undocumented GraphQL API. Check your vehicle's battery, range, OTA updates, charging status, and more — right from Claude.

**Strictly read-only** — no vehicle commands, no settings changes.

## Setup

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
      "args": ["rivian-mcp"],
      "env": {
        "RIVIAN_EMAIL": "your@email.com",
        "RIVIAN_PASSWORD": "your-password"
      }
    }
  }
}
```

</details>

### First-time login

Rivian requires 2FA on every new login:

1. Ask Claude: **"Log in to Rivian"**
2. Rivian sends a verification code to your phone/email
3. Tell Claude the code: **"The code is 123456"**

Your session is saved to `~/.rivian-mcp/session.json` and reused automatically until it expires (7 days).

## What you can ask

- "What's my battery level?"
- "Is there a software update available?"
- "Are all the doors locked?"
- "Show me the full vehicle status"
- "Who has keys to my R1S?"
- "Am I currently charging?"
- "Show my charging history"
- "What's my charging schedule?"

## Tools

| Tool | What it does |
|---|---|
| `rivian_login` | Start sign-in (triggers verification code) |
| `rivian_submit_otp` | Complete sign-in with the verification code |
| `rivian_get_user_info` | Your account, vehicles, and software versions |
| `rivian_get_vehicle_state` | Live status — battery, doors, tires, location, climate, OTA |
| `rivian_get_ota_status` | Current and available software versions |
| `rivian_get_charging_session` | Active charging session details |
| `rivian_get_charging_history` | Past charging sessions — energy, cost, location |
| `rivian_get_charging_schedule` | Your configured charging schedule |
| `rivian_get_drivers_and_keys` | Drivers and their phone keys / key fobs |

## Requirements

- Node.js 24+
- A Rivian account with a vehicle

## Support

If you're thinking about getting a Rivian and don't have a referral yet, here's mine — you'll get benefits on your purchase and it helps support this project:

[Get a Rivian R1 with referral benefits](https://rivian.com/configurations/list?reprCode=PATRICK4568756)

## References

- [Rivian API Docs](https://rivian-api.kaedenb.org/app/) — community-maintained
- [rivian-python-client](https://github.com/bretterer/rivian-python-client) — Python client this is based on
- [home-assistant-rivian](https://github.com/bretterer/home-assistant-rivian) — Home Assistant integration
