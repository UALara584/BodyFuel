import hashlib
import hmac
import secrets


SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SALT_BYTES = 16
HASH_BYTES = 32
PASSWORD_HASH_PREFIX = "scrypt"


def _parse_password_hash(stored_password: str):
    try:
        algorithm, n, r, p, salt_hex, hash_hex = stored_password.split("$", 5)
        if algorithm != PASSWORD_HASH_PREFIX:
            return None

        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
        if len(salt) < SALT_BYTES or len(expected_hash) != HASH_BYTES:
            return None

        n_value = int(n)
        r_value = int(r)
        p_value = int(p)
        if (
            n_value < 2**10
            or n_value > 2**18
            or n_value & (n_value - 1)
            or not 1 <= r_value <= 32
            or not 1 <= p_value <= 16
        ):
            return None

        return n_value, r_value, p_value, salt, expected_hash
    except (AttributeError, TypeError, ValueError):
        return None


def is_password_hash(stored_password: str) -> bool:
    return _parse_password_hash(stored_password) is not None


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(SALT_BYTES)
    derived_key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=HASH_BYTES,
    )
    return (
        f"{PASSWORD_HASH_PREFIX}${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}"
        f"${salt.hex()}${derived_key.hex()}"
    )


def verify_password(password: str, stored_password: str) -> bool:
    parsed_hash = _parse_password_hash(stored_password)
    if parsed_hash is None:
        # Compatibilidad temporal con cuentas creadas antes de usar hashes.
        return hmac.compare_digest(
            str(stored_password).encode("utf-8"),
            password.encode("utf-8"),
        )

    n, r, p, salt, expected_hash = parsed_hash
    try:
        actual_hash = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=len(expected_hash),
        )
    except ValueError:
        return False

    return hmac.compare_digest(actual_hash, expected_hash)


def password_needs_rehash(stored_password: str) -> bool:
    parsed_hash = _parse_password_hash(stored_password)
    if parsed_hash is None:
        return True

    n, r, p, _, expected_hash = parsed_hash
    return (n, r, p, len(expected_hash)) != (
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        HASH_BYTES,
    )
