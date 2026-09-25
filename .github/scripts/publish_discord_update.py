#!/usr/bin/env python3
"""Publish player-facing update notes without exposing raw commit messages."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


APP_URL = "https://mcposer.pcky.dev"
BRAND_ICON_URL = "https://raw.githubusercontent.com/PckyDev/MC-Poser/main/brand/icon.jpg"


def event_payload() -> dict:
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path:
        return {}
    return json.loads(Path(event_path).read_text(encoding="utf-8"))


def commit_messages(event: dict) -> list[str]:
    messages = [str(item.get("message", "")).strip() for item in event.get("commits", [])]
    messages = [message for message in messages if message]
    if messages:
        return messages
    latest = subprocess.run(
        ["git", "log", "-1", "--pretty=%B"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return [latest] if latest else ["Manual update notification"]


def changelog(messages: list[str]) -> str:
    # Only explicitly authored public copy belongs in Discord. Never fall back
    # to commit titles/bodies, which can contain implementation and test details.
    changes = []
    for message in messages:
        for line in message.splitlines():
            prefix = "Discord-Update:"
            if line.strip().startswith(prefix):
                note = line.strip()[len(prefix):].strip()
                if note and note not in changes:
                    changes.append(note)
    if not changes:
        return "A fresh update is available. Open MC Poser to try it out!"
    changes = ["• " + note for note in changes]
    return "**What changed**\n" + "\n".join(changes)


def main() -> None:
    webhook = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    parsed = urllib.parse.urlparse(webhook)
    if parsed.scheme != "https" or parsed.hostname not in {"discord.com", "discordapp.com"} or "/api/webhooks/" not in parsed.path:
        raise RuntimeError("DISCORD_WEBHOOK_URL is not a valid HTTPS Discord webhook")

    event = event_payload()
    description = changelog(commit_messages(event))
    payload = {
        "username": "MC Poser Updates",
        "avatar_url": BRAND_ICON_URL,
        "content": "A new **MC Poser** update has been published!",
        "allowed_mentions": {"parse": []},
        "embeds": [
            {
                "title": "MC Poser update",
                "url": APP_URL,
                "description": description[:4096],
                "color": 0x55A7FF,
                "fields": [
                    {"name": "Try it", "value": f"[Open MC Poser]({APP_URL})", "inline": True},
                ],
            }
        ],
    }
    target = urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode([("wait", "true")])))
    request = urllib.request.Request(
        target,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "MC-Poser-GitHub-Actions/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status not in (200, 204):
                raise RuntimeError(f"Discord returned HTTP {response.status}")
    except urllib.error.HTTPError as error:
        response_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Discord returned HTTP {error.code}: {response_body}") from error


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"::error::{error}", file=sys.stderr)
        raise SystemExit(1)
