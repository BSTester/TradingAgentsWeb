import ast
from pathlib import Path
import unittest


CONVERSATION_ROUTES = Path("web/backend/routes/conversation_routes.py")


def _trigger_analysis_events() -> list[str]:
    tree = ast.parse(CONVERSATION_ROUTES.read_text(encoding="utf-8"))
    function = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "_trigger_analysis"
    )
    events: list[str] = []
    for node in ast.walk(function):
        if isinstance(node, ast.Await):
            call = node.value
            if (
                isinstance(call, ast.Call)
                and isinstance(call.func, ast.Attribute)
                and isinstance(call.func.value, ast.Name)
                and call.func.value.id == "db"
                and call.func.attr in {"flush", "commit"}
            ):
                events.append(f"db.{call.func.attr}")
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "submit_task"
        ):
            events.append("submit_task")
    return events


class ConversationDispatchCommitTests(unittest.TestCase):
    def test_trigger_analysis_commits_record_before_worker_submit(self):
        events = _trigger_analysis_events()

        self.assertIn("db.flush", events)
        self.assertIn("db.commit", events)
        self.assertIn("submit_task", events)
        self.assertLess(events.index("db.flush"), events.index("db.commit"))
        self.assertLess(events.index("db.commit"), events.index("submit_task"))


if __name__ == "__main__":
    unittest.main()
