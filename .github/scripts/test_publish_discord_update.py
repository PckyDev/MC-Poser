import unittest

from publish_discord_update import changelog


class ChangelogTests(unittest.TestCase):
    def test_only_public_notes_are_published(self):
        result = changelog([
            "Refactor dialog state\n\nAdd useLayoutEffect and Playwright tests.\n"
            "Discord-Update: Bug reporting is simpler, with a quick reminder before downloading a report.\n"
            "Internal implementation details after the note.",
        ])
        self.assertEqual(result, "**What changed**\n"
                         "• Bug reporting is simpler, with a quick reminder before downloading a report.")

    def test_missing_or_empty_notes_never_expose_commit_text(self):
        for messages in ([], ["Update dependencies\nTests passed"], ["Discord-Update: "]):
            with self.subTest(messages=messages):
                self.assertEqual(changelog(messages),
                                 "A fresh update is available. Open MC Poser to try it out!")

    def test_multiple_commits_and_duplicate_notes(self):
        self.assertEqual(changelog([
            "Internal title\nDiscord-Update: Easier bug reporting.",
            "Other title\nDiscord-Update: Easier bug reporting.\nDiscord-Update: Clearer menus.",
        ]), "**What changed**\n• Easier bug reporting.\n• Clearer menus.")


if __name__ == "__main__":
    unittest.main()
