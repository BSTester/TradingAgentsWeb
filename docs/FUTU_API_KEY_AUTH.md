# Futu API Key Authentication

## Overview

Added API key authentication support for Futu trading API requests. All requests now include an `X-API-Key` header when an API key is configured.

## Configuration

### Method 1: Environment Variable (Recommended)

Add to your `.env` file:

```bash
FUTU_API_KEY=3rxV9wC1pX-kCsgFJ4b5vmtSBC9XChvle-aHiGV6iLo
```

### Method 2: Config File

Add to your configuration:

```python
config = {
    "futu_api_key": "3rxV9wC1pX-kCsgFJ4b5vmtSBC9XChvle-aHiGV6iLo"
}
```

## Implementation Details

### API Key Retrieval

The system checks for API key in the following order:

1. **Environment Variable**: `FUTU_API_KEY`
2. **Config File**: `config["futu_api_key"]`
3. **None**: If not configured, requests proceed without authentication (may fail if server requires auth)

```python
def _get_api_key() -> Optional[str]:
    """Get Futu API key from environment variable or config."""
    import os
    
    # Try environment variable first
    api_key = os.getenv("FUTU_API_KEY")
    if api_key:
        return api_key
    
    # Try config as fallback
    try:
        from .config import get_config
        config = get_config()
        api_key = config.get("futu_api_key")
        if api_key:
            return api_key
    except Exception:
        pass
    
    return None
```

### Request Header

When an API key is configured, all requests include the header:

```
X-API-Key: <your-api-key>
```

### Code Changes

**File**: `tradingagents/dataflows/futu_trading.py`

```python
def _make_request(method, endpoint, params=None, json_data=None):
    base_url = _get_base_url()
    timeout = _get_timeout()
    api_key = _get_api_key()  # NEW
    url = f"{base_url}{endpoint}"
    
    # Prepare headers
    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key  # NEW
    
    # Make request with headers
    if method.upper() == "GET":
        response = _session.get(url, params=params, headers=headers, timeout=timeout)
    elif method.upper() == "POST":
        response = _session.post(url, json=json_data, headers=headers, timeout=timeout)
```

## Usage

### With Authentication

```bash
# Set API key in .env
export FUTU_API_KEY=3rxV9wC1pX-kCsgFJ4b5vmtSBC9XChvle-aHiGV6iLo

# Run your application
python cli/main.py
```

All Futu API requests will automatically include the authentication header.

### Without Authentication

If no API key is configured:
- Requests proceed without `X-API-Key` header
- A warning is logged: "No Futu API key configured - requests may fail if authentication is required"
- Server may reject requests if authentication is required

## Affected Functions

All Futu trading functions now support authentication:

- `get_account_info()`
- `get_positions()`
- `get_quote()`
- `place_order()`
- `cancel_order()`
- `get_orders()`
- `get_kline_data()`
- `get_hot_stocks()`
- `get_hot_news()`
- `get_technical_analysis()`

## Security Best Practices

### 1. Use Environment Variables

✅ **Recommended**:
```bash
# .env file
FUTU_API_KEY=your-api-key-here
```

❌ **Not Recommended**:
```python
# Hardcoded in code
config = {"futu_api_key": "your-api-key-here"}
```

### 2. Keep API Key Secret

- ✅ Add `.env` to `.gitignore`
- ✅ Use different keys for development and production
- ✅ Rotate keys regularly
- ❌ Never commit API keys to version control
- ❌ Never share API keys in public channels

### 3. Verify .gitignore

Ensure your `.gitignore` includes:

```gitignore
.env
.env.local
.env.*.local
```

## Logging

### Debug Logs

When API key is configured:
```
DEBUG: Using Futu API key from environment variable
DEBUG: Added X-API-Key header to request
```

When API key is not configured:
```
WARNING: No Futu API key configured - requests may fail if authentication is required
```

### Production Logs

API keys are never logged in production. Only status messages are logged:
```
INFO: GET /api/kline completed in 0.45s with status 200
```

## Testing

### Test with API Key

```python
import os
os.environ["FUTU_API_KEY"] = "test-key-123"

from tradingagents.dataflows.futu_trading import get_quote

# Request will include X-API-Key header
quote = get_quote("AAPL")
```

### Test without API Key

```python
import os
if "FUTU_API_KEY" in os.environ:
    del os.environ["FUTU_API_KEY"]

from tradingagents.dataflows.futu_trading import get_quote

# Request will NOT include X-API-Key header
# May fail if server requires authentication
quote = get_quote("AAPL")
```

## Troubleshooting

### Issue: 401 Unauthorized

**Symptom**: Requests fail with 401 status code

**Solution**:
1. Verify API key is set: `echo $FUTU_API_KEY`
2. Check API key is correct
3. Ensure `.env` file is loaded
4. Restart application after setting API key

### Issue: API Key Not Being Used

**Symptom**: Warning message "No Futu API key configured"

**Solution**:
1. Check environment variable: `echo $FUTU_API_KEY`
2. Verify `.env` file exists and contains `FUTU_API_KEY=...`
3. Ensure `python-dotenv` is installed: `pip install python-dotenv`
4. Check `.env` is loaded in your application:
   ```python
   from dotenv import load_dotenv
   load_dotenv()
   ```

### Issue: 403 Forbidden

**Symptom**: Requests fail with 403 status code

**Solution**:
1. API key may be invalid or expired
2. API key may not have required permissions
3. Contact API provider to verify key status

## Migration Guide

### Existing Deployments

If you have existing deployments without API key:

1. **Add API key to environment**:
   ```bash
   # Add to .env
   echo "FUTU_API_KEY=your-api-key-here" >> .env
   ```

2. **Restart application**:
   ```bash
   # Docker
   docker-compose restart
   
   # Local
   # Stop and restart your application
   ```

3. **Verify authentication**:
   - Check logs for "Added X-API-Key header to request"
   - Verify requests succeed with 200 status

### Backward Compatibility

✅ **Fully backward compatible**

- If no API key is configured, requests work as before (without authentication)
- Existing code requires no changes
- Only add API key when server requires authentication

## Related Files

- `tradingagents/dataflows/futu_trading.py` - Main implementation
- `.env.example` - Configuration template
- `docs/FUTU_TRADING_SETUP.md` - Futu trading setup guide

## Example .env File

```bash
# Futu Trading API Configuration
FUTU_API_BASE_URL=http://localhost:8000
FUTU_API_KEY=3rxV9wC1pX-kCsgFJ4b5vmtSBC9XChvle-aHiGV6iLo
FUTU_API_TIMEOUT=30
```
