import os
import logging
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth
from core.config import settings

logger = logging.getLogger("auth")

# Ensure the Firebase App is only initialized once
if not firebase_admin._apps:
    # Initialize with the known project ID so verify_id_token can fetch the correct Google public keys
    firebase_admin.initialize_app(options={'projectId': settings.FIREBASE_PROJECT_ID})

security = HTTPBearer()

def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    FastAPI Dependency to intercept the Authorization header and verify the Firebase JWT.
    """
    token = credentials.credentials
    try:
        # Enforce strict validation, also check revoked status
        decoded_token = auth.verify_id_token(token, check_revoked=True)
        return decoded_token
    except Exception as e:
        logger.error(f"FIREBASE JWT ERROR: verification failed: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
