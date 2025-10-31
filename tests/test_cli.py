"""Tests for :mod:`jiihere.cli`."""

from jiihere.cli import main, parse_args, run_from_command_line


def test_parse_args_defaults_to_world() -> None:
    """When no name is provided the parser should default to 'world'."""

    args = parse_args([])
    assert args.name == "world"


def test_main_prints_greeting(capsys) -> None:
    """``main`` should print the greeting and return a zero exit code."""

    status = main(["--name", "Alice"])

    captured = capsys.readouterr()
    assert captured.out.strip() == "Hello, Alice!"
    assert status == 0


def test_run_from_command_line_delegates() -> None:
    """The ``run_from_command_line`` helper should forward arguments."""

    status = run_from_command_line(["--name", "Bob"])
    assert status == 0
