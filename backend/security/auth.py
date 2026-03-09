import os
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

# Ensure the Firebase App is only initialized once
if not firebase_admin._apps:
    # Initialize with the known project ID so verify_id_token can fetch the correct Google public keys
    firebase_admin.initialize_app(options={'projectId': 'intelli-credit-ai-dhanu'})

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
        # Fallback for local development if Google Application Default Credentials are missing
        if "default credentials were not found" in str(e).lower() or "project id" in str(e).lower() or "credentials" in str(e).lower():
            try:
                import json, base64
                parts = token.split('.')
                if len(parts) == 3:
                    payload_b64 = parts[1]
                    payload_b64 += '=' * (-len(payload_b64) % 4)
                    decoded = json.loads(base64.urlsafe_b64decode(payload_b64).decode('utf-8'))
                    # Firebase SDK appends 'uid', mimicking it here
                    if "uid" not in decoded:
                        decoded["uid"] = decoded.get("user_id", decoded.get("sub", "firebase_user"))
                    return decoded
            except Exception:
                pass
                
        print(f"FIREBASE JWT ERROR: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
