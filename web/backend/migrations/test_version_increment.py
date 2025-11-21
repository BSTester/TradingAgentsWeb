"""
Test script to verify version increment logic
"""

def test_version_increment():
    """Test the version increment logic"""
    
    test_cases = [
        ("1.0", "1.1"),
        ("1.1", "1.2"),
        ("2.5", "2.6"),
        ("1.0_edited", "1.1"),
        ("1.0_edited_edited", "1.1"),
        ("1.0_edited_edited_edited", "1.1"),
        ("invalid_version", "1.0"),
        ("", "1.0"),
        (None, "1.0"),
    ]
    
    print("Testing version increment logic:\n")
    
    for current, expected in test_cases:
        # Simulate the logic from prompt_routes.py
        if current:
            try:
                # Extract numeric version (handle cases like "1.0_edited" -> "1.0")
                version_str = current.split('_')[0]
                current_version = float(version_str)
                result = f"{current_version + 0.1:.1f}"
            except (ValueError, IndexError):
                # If version parsing fails, reset to 1.0
                result = "1.0"
        else:
            result = "1.0"
        
        status = "✓" if result == expected else "✗"
        print(f"{status} '{current}' -> '{result}' (expected: '{expected}')")

if __name__ == "__main__":
    test_version_increment()
