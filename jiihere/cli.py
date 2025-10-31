"""Command-line interface for :mod:`jiihere`."""

from __future__ import annotations

import argparse
from typing import Iterable, Sequence

from .core import greet


def build_parser() -> argparse.ArgumentParser:
    """Create the argument parser for the CLI."""

    parser = argparse.ArgumentParser(description="Print a friendly greeting")
    parser.add_argument(
        "-n",
        "--name",
        help="Name to greet (defaults to 'world')",
        default="world",
    )
    return parser


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""

    parser = build_parser()
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI and return the exit status code."""

    args = parse_args(argv)
    message = greet(args.name)
    print(message)
    return 0


def run_from_command_line(argv: Iterable[str] | None = None) -> int:
    """Entry point compatible with ``console_scripts`` style callables."""

    if argv is None:
        return main()

    return main(list(argv))


if __name__ == "__main__":  # pragma: no cover - exercised via integration tests
    raise SystemExit(main())
