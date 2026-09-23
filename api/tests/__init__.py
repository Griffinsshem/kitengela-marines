"""Test package.

This module runs before conftest, which makes it the one place the hashing
profile can be set before app.security.passwords is imported.
"""

import os

os.environ.setdefault("PASSWORD_HASHING", "fast")
