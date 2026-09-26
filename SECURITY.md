# Security policy

## Supported versions

Security fixes target the latest code on `main` and the current hosted app.
Older copies and forks do not have a separate maintenance guarantee.

## Report a vulnerability privately

Do not publish exploit details, credentials, private skins, or sensitive
diagnostic files in a public GitHub issue or Discord channel.

Use [GitHub's private vulnerability reporting form](https://github.com/PckyDev/MC-Poser/security/advisories/new)
under **Security > Report a vulnerability**. If it is unavailable, contact **PockyDev** through
[Pockyverse](https://discord.pcky.dev) to arrange a private conversation before
sending details. Public channels should only be used to request private contact.

Include the affected feature, steps to reproduce, likely impact, and a minimal
proof of concept that does not expose anyone else's data. Please allow time to
investigate before publishing details. There is no guaranteed response time or
bug bounty program.

## Safe testing and sharing

- Prefer a local copy and synthetic test data. Do not disrupt the hosted app or
  access other people's data.
- Review diagnostics before sharing. They include the active workspace, images,
  names, environment details, and error text.
- Store deployment credentials and `DISCORD_WEBHOOK_URL` in the appropriate
  secret store, never in source files or client-side `VITE_*` variables.
- If a credential is exposed, revoke or rotate it. Deleting it from the latest
  revision alone does not remove it from Git history.
