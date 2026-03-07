from __future__ import annotations

import ast
import json
import operator
import re
from copy import deepcopy
from typing import Any, Mapping


EXPRESSION_PATTERN = re.compile(r"{{\s*(.*?)\s*}}")

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
}
_COMPARE_OPS = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.In: lambda left, right: left in right,
    ast.NotIn: lambda left, right: left not in right,
}


class ExpressionEvaluationError(ValueError):
    pass


def _to_expression_string(value: Any) -> str:
    if isinstance(value, str):
        return json.dumps(value)
    return json.dumps(value, default=str)


def _coerce_mapping(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _coerce_mapping(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_coerce_mapping(item) for item in value]
    return value


class SafeExpressionEvaluator(ast.NodeVisitor):
    def __init__(self, context: Mapping[str, Any]) -> None:
        self.context = context

    def evaluate(self, expression: str) -> Any:
        try:
            parsed = ast.parse(expression, mode="eval")
        except SyntaxError as exc:
            raise ExpressionEvaluationError(f"Invalid expression: {expression}") from exc
        return self.visit(parsed)

    def visit_Expression(self, node: ast.Expression) -> Any:
        return self.visit(node.body)

    def visit_Name(self, node: ast.Name) -> Any:
        if node.id in self.context:
            return self.context[node.id]
        if node.id == "True":
            return True
        if node.id == "False":
            return False
        if node.id == "None":
            return None
        raise ExpressionEvaluationError(f"Unknown identifier: {node.id}")

    def visit_Constant(self, node: ast.Constant) -> Any:
        return node.value

    def visit_List(self, node: ast.List) -> list[Any]:
        return [self.visit(item) for item in node.elts]

    def visit_Tuple(self, node: ast.Tuple) -> tuple[Any, ...]:
        return tuple(self.visit(item) for item in node.elts)

    def visit_Dict(self, node: ast.Dict) -> dict[Any, Any]:
        return {
            self.visit(key): self.visit(value)
            for key, value in zip(node.keys, node.values, strict=True)
        }

    def visit_Attribute(self, node: ast.Attribute) -> Any:
        base_value = self.visit(node.value)
        if isinstance(base_value, Mapping):
            if node.attr not in base_value:
                raise ExpressionEvaluationError(f"Missing key: {node.attr}")
            return base_value[node.attr]
        if node.attr.startswith("_") or not hasattr(base_value, node.attr):
            raise ExpressionEvaluationError(f"Unsafe attribute access: {node.attr}")
        return getattr(base_value, node.attr)

    def visit_Subscript(self, node: ast.Subscript) -> Any:
        base_value = self.visit(node.value)
        index = self.visit(node.slice)
        try:
            return base_value[index]
        except (KeyError, IndexError, TypeError) as exc:
            raise ExpressionEvaluationError(f"Invalid lookup: {index}") from exc

    def visit_Index(self, node: ast.Index) -> Any:
        return self.visit(node.value)

    def visit_Slice(self, node: ast.Slice) -> slice:
        return slice(
            self.visit(node.lower) if node.lower else None,
            self.visit(node.upper) if node.upper else None,
            self.visit(node.step) if node.step else None,
        )

    def visit_BoolOp(self, node: ast.BoolOp) -> Any:
        values = [self.visit(value) for value in node.values]
        if isinstance(node.op, ast.And):
            return all(values)
        if isinstance(node.op, ast.Or):
            return any(values)
        raise ExpressionEvaluationError("Unsupported boolean operator")

    def visit_UnaryOp(self, node: ast.UnaryOp) -> Any:
        operand = self.visit(node.operand)
        if isinstance(node.op, ast.Not):
            return not operand
        if isinstance(node.op, ast.USub):
            return -operand
        if isinstance(node.op, ast.UAdd):
            return +operand
        raise ExpressionEvaluationError("Unsupported unary operator")

    def visit_Compare(self, node: ast.Compare) -> bool:
        left = self.visit(node.left)
        for op, comparator in zip(node.ops, node.comparators, strict=True):
            right = self.visit(comparator)
            comparator_fn = _COMPARE_OPS.get(type(op))
            if comparator_fn is None:
                raise ExpressionEvaluationError("Unsupported comparison operator")
            if not comparator_fn(left, right):
                return False
            left = right
        return True

    def visit_BinOp(self, node: ast.BinOp) -> Any:
        left = self.visit(node.left)
        right = self.visit(node.right)
        operator_fn = _BIN_OPS.get(type(node.op))
        if operator_fn is None:
            raise ExpressionEvaluationError("Unsupported arithmetic operator")
        return operator_fn(left, right)

    def generic_visit(self, node: ast.AST) -> Any:
        raise ExpressionEvaluationError(f"Unsupported syntax: {type(node).__name__}")


def evaluate_expression(expression: str, context: Mapping[str, Any]) -> Any:
    evaluator = SafeExpressionEvaluator(_coerce_mapping(context))
    return evaluator.evaluate(expression)


def render_template(value: Any, context: Mapping[str, Any]) -> Any:
    if isinstance(value, Mapping):
        return {key: render_template(item, context) for key, item in value.items()}
    if isinstance(value, list):
        return [render_template(item, context) for item in value]
    if not isinstance(value, str):
        return deepcopy(value)

    matches = list(EXPRESSION_PATTERN.finditer(value))
    if not matches:
        return value

    if len(matches) == 1 and matches[0].span() == (0, len(value)):
        return evaluate_expression(matches[0].group(1), context)

    rendered = value
    for match in matches:
        evaluated = evaluate_expression(match.group(1), context)
        rendered = rendered.replace(match.group(0), str(evaluated))
    return rendered


def render_expression_string(expression: str, context: Mapping[str, Any]) -> str:
    def replacer(match: re.Match[str]) -> str:
        resolved = evaluate_expression(match.group(1), context)
        return _to_expression_string(resolved)

    return EXPRESSION_PATTERN.sub(replacer, expression)


def evaluate_condition(expression: str, context: Mapping[str, Any]) -> bool:
    normalized = expression.strip()
    if normalized.startswith("if "):
        normalized = normalized[3:].strip()
    if normalized.startswith("if(") and normalized.endswith(")"):
        normalized = normalized[2:].strip()
    if normalized.startswith("(") and normalized.endswith(")"):
        normalized = normalized[1:-1].strip()

    rendered = render_expression_string(normalized, context)
    return bool(evaluate_expression(rendered, context))

