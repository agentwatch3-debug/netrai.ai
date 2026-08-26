"""Unit tests for MultiFernet PII encryption key rotation."""

import pytest
from cryptography.fernet import Fernet

from pii_engine import PiiEngine, build_multi_fernet


def test_pii_key_rotation_decrypts_old_ciphertexts():
    """Encrypt with key1, add key2 to the front (key2, key1), and verify decryption succeeds."""
    key1 = Fernet.generate_key().decode()
    key2 = Fernet.generate_key().decode()

    # 1. Old service instance running with only key1
    engine_old = PiiEngine(key1)
    payload_old = {
        "input": "Contact me at alice@acme.com or call 9876543210 with PAN ABCDE1234F",
        "output": "Processed PAN ABCDE1234F successfully",
    }
    masked_old, mappings_old = engine_old.mask_json(payload_old)

    assert "<EMAIL_ADDRESS_1>" in masked_old["input"]
    assert "<INDIAN_PAN_1>" in masked_old["input"]
    assert len(mappings_old) >= 3

    # 2. Rotated service instance with new key2 added to the front: [key2, key1]
    engine_rotated = PiiEngine(f"{key2},{key1}")

    # Verify that all ciphertexts generated under key1 can still be decrypted by engine_rotated
    for mapping in mappings_old:
        decrypted = engine_rotated.decrypt(mapping.encrypted_value)
        assert decrypted in ("alice@acme.com", "9876543210", "ABCDE1234F")

    # 3. New writes under engine_rotated are encrypted with key2 (the first key)
    payload_new = {"input": "New user bob@corp.org"}
    masked_new, mappings_new = engine_rotated.mask_json(payload_new)
    assert len(mappings_new) == 1
    new_encrypted_val = mappings_new[0].encrypted_value

    # Verify key2 alone can decrypt the new ciphertext
    engine_key2_only = PiiEngine(key2)
    assert engine_key2_only.decrypt(new_encrypted_val) == "bob@corp.org"

    # Verify key1 alone FAILS to decrypt the new ciphertext
    with pytest.raises(Exception):
        engine_old.decrypt(new_encrypted_val)


def test_build_multi_fernet_from_env_vars(monkeypatch: pytest.MonkeyPatch):
    """Verify build_multi_fernet parses comma-separated PII_FERNET_KEYS and falls back to PII_FERNET_KEY."""
    k1 = Fernet.generate_key().decode()
    k2 = Fernet.generate_key().decode()

    # Plural comma-separated variable
    monkeypatch.setenv("PII_FERNET_KEYS", f" {k2} , {k1} ")
    monkeypatch.delenv("PII_FERNET_KEY", raising=False)

    mf = build_multi_fernet()
    test_token = Fernet(k1.encode()).encrypt(b"secret_data")
    assert mf.decrypt(test_token) == b"secret_data"

    # Singular fallback variable
    monkeypatch.delenv("PII_FERNET_KEYS", raising=False)
    monkeypatch.setenv("PII_FERNET_KEY", k1)

    mf_fallback = build_multi_fernet()
    assert mf_fallback.decrypt(test_token) == b"secret_data"


def test_build_multi_fernet_missing_keys_raises_value_error(monkeypatch: pytest.MonkeyPatch):
    """Verify helpful ValueError when no keys are provided or configured."""
    monkeypatch.delenv("PII_FERNET_KEYS", raising=False)
    monkeypatch.delenv("PII_FERNET_KEY", raising=False)

    with pytest.raises(ValueError) as exc_info:
        build_multi_fernet(None)

    assert "No valid Fernet encryption keys provided" in str(exc_info.value)
