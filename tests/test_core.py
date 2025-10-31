"""Tests for :mod:`jiihere.core`."""

import pytest

from jiihere import greet


@pytest.mark.parametrize(
    "name, expected",
    [
        ("world", "Hello, world!"),
        ("Alice", "Hello, Alice!"),
        ("   Bob   ", "Hello, Bob!"),
        ("", "Hello, world!"),
    ],
)
def test_greet(name: str, expected: str) -> None:
    """``greet`` should normalise whitespace and empty names."""

    assert greet(name) == expected
