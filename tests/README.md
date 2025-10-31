# Tests Directory

This directory contains test scripts for development and verification purposes.

## Available Tests

### test_realtime_quotes.py

Tests the real-time stock quotes functionality including:
- Symbol normalization for A-shares, US stocks, and HK stocks
- Real-time quote retrieval via XueQiu API

**Usage:**
```bash
# Set token first
export XUEQIU_TOKEN="your_token_here"

# Run tests
python tests/test_realtime_quotes.py
```

**Requirements:**
- XueQiu token (see `docs/XUEQIU_TOKEN_SETUP.md`)
- Internet connection

## Running Tests

### Quick Test (No Token Required)
```bash
python tests/test_realtime_quotes.py
```
This will run symbol normalization tests only.

### Full Test (Token Required)
```bash
# Set environment variable
export XUEQIU_TOKEN="your_token_here"

# Run all tests
python tests/test_realtime_quotes.py
```

### Direct Token (Alternative)
Edit `test_realtime_quotes.py` and set the token variable:
```python
token = "your_xueqiu_token_here"
```

## Documentation

For detailed setup and usage instructions, see:
- `docs/XUEQIU_TOKEN_SETUP.md` - Token setup guide
- `docs/REALTIME_QUOTES_QUICKSTART.md` - Quick start guide
- `.kiro/specs/realtime-stock-quotes/` - Implementation specs

## Notes

- Tests are for development purposes only
- Do not commit tokens to version control
- Some tests require network access to external APIs
