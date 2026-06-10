import unittest

from app.schemas import UserResponse
from app.security import (
    hash_password,
    is_password_hash,
    password_needs_rehash,
    verify_password,
)


class PasswordSecurityTests(unittest.TestCase):
    def test_hash_is_salted_and_verifiable(self):
        first_hash = hash_password("una-clave-segura")
        second_hash = hash_password("una-clave-segura")

        self.assertNotEqual(first_hash, second_hash)
        self.assertNotIn("una-clave-segura", first_hash)
        self.assertTrue(is_password_hash(first_hash))
        self.assertTrue(verify_password("una-clave-segura", first_hash))
        self.assertFalse(verify_password("clave-incorrecta", first_hash))
        self.assertFalse(password_needs_rehash(first_hash))

    def test_legacy_plaintext_password_can_be_migrated(self):
        self.assertTrue(verify_password("clave-antigua", "clave-antigua"))
        self.assertTrue(verify_password("contraseña-antigua", "contraseña-antigua"))
        self.assertFalse(verify_password("otra-clave", "clave-antigua"))
        self.assertTrue(password_needs_rehash("clave-antigua"))

    def test_public_user_response_does_not_include_password(self):
        user = UserResponse(
            id=1,
            email="user@example.com",
            nombre="User",
            peso=70,
            altura=175,
            objetivo="mantener",
        )

        self.assertNotIn("password", user.model_dump())


if __name__ == "__main__":
    unittest.main()
