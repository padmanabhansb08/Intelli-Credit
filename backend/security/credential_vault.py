from __future__ import annotations

import base64
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class CredentialVault:
    def __init__(self, raw_key: bytes) -> None:
        if len(raw_key) != 32:
            raise ValueError("Credential vault key must be exactly 32 bytes for AES-256-GCM.")
        self._aesgcm = AESGCM(raw_key)

    @classmethod
    def from_env(cls, env_var: str = "CREDENTIALS_MASTER_KEY") -> "CredentialVault":
        encoded_key = os.getenv(env_var)
        if not encoded_key:
            raise RuntimeError(
                f"Missing {env_var}. Generate a 32-byte base64 key before using credential storage."
            )
        raw_key = base64.urlsafe_b64decode(encoded_key)
        return cls(raw_key)

    def encrypt(self, payload: dict[str, Any]) -> bytes:
        nonce = os.urandom(12)
        serialized = json.dumps(payload).encode("utf-8")
        ciphertext = self._aesgcm.encrypt(nonce, serialized, None)
        return nonce + ciphertext

    def decrypt(self, ciphertext: bytes) -> dict[str, Any]:
        nonce, payload = ciphertext[:12], ciphertext[12:]
        serialized = self._aesgcm.decrypt(nonce, payload, None)
        return json.loads(serialized.decode("utf-8"))

