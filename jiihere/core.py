"""Core helpers for Jiihere."""


def greet(name: str = "world") -> str:
    """Return a friendly greeting for *name*.

    Args:
        name: Recipient of the greeting. Defaults to ``"world"``.

    Returns:
        A formatted greeting string.
    """

    sanitized = name.strip() or "world"
    return f"Hello, {sanitized}!"
