import ast
from pathlib import Path
import unittest


PAGE_ROUTES = Path("web/backend/routes/page_routes.py")


def _template_response_call(function_name: str) -> ast.Call:
    tree = ast.parse(PAGE_ROUTES.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == function_name:
            for child in ast.walk(node):
                if (
                    isinstance(child, ast.Call)
                    and isinstance(child.func, ast.Attribute)
                    and child.func.attr == "TemplateResponse"
                ):
                    return child
    raise AssertionError(f"TemplateResponse call not found in {function_name}")


class PageRoutesTemplateResponseTests(unittest.TestCase):
    def assert_template_response_uses_starlette_1x_signature(self, function_name: str, template_name: str):
        call = _template_response_call(function_name)

        self.assertGreaterEqual(len(call.args), 2)
        self.assertIsInstance(call.args[0], ast.Name)
        self.assertEqual(call.args[0].id, "request")
        self.assertIsInstance(call.args[1], ast.Constant)
        self.assertEqual(call.args[1].value, template_name)

    def test_index_uses_request_first_template_response_signature(self):
        self.assert_template_response_uses_starlette_1x_signature("index", "index.html")

    def test_results_uses_request_first_template_response_signature(self):
        self.assert_template_response_uses_starlette_1x_signature("results_page", "results.html")


if __name__ == "__main__":
    unittest.main()
