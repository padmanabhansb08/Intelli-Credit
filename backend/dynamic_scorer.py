"""
Dynamic Recursive Policy Scorer
================================
Traverses a CreditPolicy rule_schema tree against LLM-extracted financial data,
producing a final decision (APPROVE / REJECT / MANUAL_REVIEW) and a complete
explainability trail of every triggered node.

This module is **parallel infrastructure** — it does NOT import or modify
the existing main.py, scorer.py (legacy fallback), or any router.

Rule Schema Contract
--------------------
The ``rule_schema`` stored in ``CreditPolicy.rule_schema`` (JSONB) is expected
to follow this recursive structure::

    {
        "rules": [
            {
                "id": "R1",
                "label": "DSCR Threshold Check",
                "field": "dscr",
                "operator": ">=",
                "value": 1.25,
                "on_true": {
                    "action": "continue",
                    "next_rules": [ ... ]          # recurse deeper
                },
                "on_false": {
                    "action": "decision",
                    "decision": "REJECT",
                    "reason": "DSCR below minimum threshold of 1.25"
                }
            }
        ],
        "default_decision": "MANUAL_REVIEW"
    }

Supported operators:  >, >=, <, <=, ==, !=, in, not_in, between
Supported actions:    decision, continue
"""
from __future__ import annotations

import operator
from typing import Any

# ── Operator registry ────────────────────────────────────────────────────────

_OPS: dict[str, Any] = {
    ">":      operator.gt,
    ">=":     operator.ge,
    "<":      operator.lt,
    "<=":     operator.le,
    "==":     operator.eq,
    "!=":     operator.ne,
    "eq":     operator.eq,
    "ne":     operator.ne,
    "gt":     operator.gt,
    "gte":    operator.ge,
    "lt":     operator.lt,
    "lte":    operator.le,
}


def _resolve_field(data: dict, field_path: str) -> Any:
    """Resolve a dot-separated field path from a nested dict.

    Example: ``"financials.dscr"`` →  ``data["financials"]["dscr"]``
    """
    current = data
    for key in field_path.split("."):
        if isinstance(current, dict):
            current = current.get(key)
        else:
            return None
    return current


def _safe_compare(op_str: str, actual: Any, expected: Any) -> bool:
    """Apply an operator string to *actual* vs *expected*, safely.

    Handles ``in``, ``not_in``, and ``between`` as special cases;
    delegates everything else to the ``_OPS`` registry.
    """
    if actual is None:
        return False

    if op_str == "in":
        return actual in expected
    if op_str == "not_in":
        return actual not in expected
    if op_str == "between":
        if isinstance(expected, (list, tuple)) and len(expected) == 2:
            return expected[0] <= actual <= expected[1]
        return False

    comparator = _OPS.get(op_str)
    if comparator is None:
        raise ValueError(f"Unsupported operator: {op_str!r}")

    try:
        return comparator(float(actual), float(expected))
    except (TypeError, ValueError):
        # Fall back to native comparison for non-numeric types
        return comparator(actual, expected)


# ── Recursive Evaluator ─────────────────────────────────────────────────────

def _evaluate_rules(
    rules: list[dict],
    data: dict,
    trail: list[dict],
    default_decision: str = "MANUAL_REVIEW",
) -> dict:
    """Walk a list of rule nodes, recursing into ``on_true`` / ``on_false`` branches.

    Parameters
    ----------
    rules:
        Array of rule objects from the policy schema.
    data:
        Flat or nested dict of financial data points (LLM-extracted).
    trail:
        **Mutable** accumulator — every evaluated node appends its record here.
    default_decision:
        Returned when all rules are exhausted without an explicit decision.

    Returns
    -------
    dict  with keys ``decision``, ``reason``
    """
    for rule in rules:
        rule_id = rule.get("id", "UNKNOWN")
        label = rule.get("label", rule_id)
        field_path = rule.get("field", "")
        op_str = rule.get("operator", "==")
        expected = rule.get("value")

        actual = _resolve_field(data, field_path)
        result = _safe_compare(op_str, actual, expected)

        # Record the node on the trail regardless of outcome
        trail.append({
            "node_id": rule_id,
            "label": label,
            "field": field_path,
            "operator": op_str,
            "expected": expected,
            "actual": actual,
            "result": result,
        })

        branch = rule.get("on_true") if result else rule.get("on_false")

        if branch is None:
            # No branch specified — continue to next sibling rule
            continue

        action = branch.get("action", "continue")

        if action == "decision":
            decision = branch.get("decision", default_decision)
            reason = branch.get(
                "reason",
                f"Node {rule_id} evaluated {field_path} {op_str} {expected} → {result}",
            )
            return {"decision": decision, "reason": reason}

        if action == "continue":
            next_rules = branch.get("next_rules", [])
            if next_rules:
                child_result = _evaluate_rules(
                    next_rules, data, trail, default_decision,
                )
                if child_result.get("decision") != default_decision:
                    return child_result

    # All rules exhausted without a terminal decision
    return {
        "decision": default_decision,
        "reason": "All rule nodes traversed without a terminal decision; defaulting to manual review.",
    }


# ── Public API ───────────────────────────────────────────────────────────────

def evaluate_policy(
    financial_data: dict,
    policy_schema: dict,
) -> dict:
    """Entry-point: evaluate *financial_data* against a *policy_schema*.

    Parameters
    ----------
    financial_data:
        JSON object of extracted financial metrics,
        e.g. output of the existing LLM pipeline (``llm.py``).
    policy_schema:
        The ``rule_schema`` JSONB stored in ``CreditPolicy.rule_schema``.

    Returns
    -------
    A unified JSON response::

        {
            "decision": "APPROVE" | "REJECT" | "MANUAL_REVIEW",
            "reason": "...",
            "execution_trail": [
                {
                    "node_id": "R1",
                    "label": "DSCR Threshold",
                    "field": "dscr",
                    "operator": ">=",
                    "expected": 1.25,
                    "actual": 1.4,
                    "result": true
                },
                ...
            ],
            "nodes_triggered": ["R1", "R2", "R3"]
        }
    """
    rules = policy_schema.get("rules", [])
    default_decision = policy_schema.get("default_decision", "MANUAL_REVIEW")
    trail: list[dict] = []

    outcome = _evaluate_rules(rules, financial_data, trail, default_decision)

    return {
        "decision": outcome["decision"],
        "reason": outcome["reason"],
        "execution_trail": trail,
        "nodes_triggered": [node["node_id"] for node in trail],
    }
