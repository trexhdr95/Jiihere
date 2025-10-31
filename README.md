# Jiihere

A minimal Python package that demonstrates the project structure for this kata.

## Usage

Run the package as a module to print a friendly greeting:

```bash
python -m jiihere --name Alice
# Hello, Alice!
```

Omit the ``--name`` flag to greet the world by default.

## Development

Create a virtual environment, install the development dependencies, and run the test suite:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r dev-requirements.txt
pytest
```

The package exposes a simple :func:`jiihere.greet` helper that returns a friendly message.
See ``tests/test_core.py`` for examples of expected behaviour.
