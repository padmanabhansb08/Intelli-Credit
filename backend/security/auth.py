import os
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

# Ensure the Firebase App is only initialized once
if not firebase_admin._apps:
    # Use the default credentials if deployed on GCP, or explicit credentials via environment variables if available.
    # Note: For local development, setting GOOGLE_APPLICATION_CREDENTIALS environment variable is recommended.
    # If not set, initialize_app() without credentials will attempt to use default credentials.
    firebase_admin.initialize_app()

security = HTTPBearer()

def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    FastAPI Dependency to intercept the Authorization header and verify the Firebase JWT.
    """
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
