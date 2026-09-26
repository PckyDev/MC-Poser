# Contributing to MC Poser

Thanks for helping improve MC Poser! Small fixes, clear bug reports, and focused
feature suggestions are welcome.

## Report a bug or suggest an idea

Search [existing issues](https://github.com/PckyDev/MC-Poser/issues) first, then
use the bug-report or feature-request form. You can also join
[Pockyverse](https://discord.pcky.dev) and use **#mc-poser**.

For rendering bugs, include the avatar type, arm model, skin dimensions/source,
layer settings, browser, and steps to reproduce. Screenshots are helpful.
**Help > Download Diagnostics** can save a report with the active workspace.
Review it before attaching it: it contains skin/item images, names, and error
text. Use a sample skin if you do not want to share your own.

For security vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of filing
a public issue.

## Set up a development environment

1. Fork the repository and clone your fork.
2. Install Node.js 22.12 or newer in the Node.js 22 series, plus npm and Python 3.
3. Run `npm ci` to install the locked dependencies.
4. Run `npx playwright install chromium` to install the test browser.
5. Run `npm run dev` and open the local URL printed in your terminal.

The development server includes the username lookup endpoint. Uploaded PNG skins
can be used without relying on the external username lookup service.

## Make a focused change

- Start a branch for your change and describe the problem it solves.
- Keep unrelated refactors and formatting changes out of the same pull request.
- Follow the surrounding React/TypeScript conventions and use npm only.
- Add regression coverage for changed behavior, especially skin mapping, avatar
  rigs, arm models, outer layers, and workspace saving/loading.
- Add only assets you have permission to distribute. Document their source and
  license in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Never commit credentials, webhook URLs, private skins, diagnostic downloads,
  or personal workspace files.

## Check your work

```sh
npm run typecheck
npm run build
npm run test:e2e
python -m unittest discover -s .github/scripts -p "test_*.py"
```

On Linux, use `npx playwright install --with-deps chromium` if browser system
dependencies are missing. Browser tests use generated skins and mocked username
lookups. They do not require a Discord webhook or Cloudflare credentials.

In your pull request, describe the user-visible change, list the checks you ran,
and include before/after screenshots for layout changes. Mention limitations or
checks you could not run. Maintainers may request changes before merging.

## Public update notes

The Discord workflow posts only commit-body lines prefixed with `Discord-Update:`.
Write these in plain language about what users can do or what improved. Do not
include code terminology, dependency names, paths, test output, or internal
implementation details. Ordinary commit text is never used as public update copy.

## Community expectations

Be respectful, constructive, and patient. Do not harass others, publish private
information, or spam issues and pull requests. Discuss the work, not the person.
See the [Code of Conduct](CODE_OF_CONDUCT.md) for expectations and reporting.
