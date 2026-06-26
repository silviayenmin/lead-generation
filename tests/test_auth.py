import os
import sys
import unittest
from dotenv import load_dotenv

# Add project root to python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from crm.lead_database import (
    create_user,
    authenticate_user,
    update_user_password,
    generate_and_save_otp,
    verify_and_delete_otp,
    get_mongo_db
)

class TestAuthAndDbHelpers(unittest.TestCase):
    def setUp(self):
        self.email = "test_auth_user@example.com"
        self.password = "Secr3tP@ssword"
        self.db = get_mongo_db()
        
        # Clean up existing test users/otps
        self.db["users"].delete_many({"email": self.email})
        self.db["otps"].delete_many({"email": self.email})

    def tearDown(self):
        # Clean up
        self.db["users"].delete_many({"email": self.email})
        self.db["otps"].delete_many({"email": self.email})

    def test_create_and_authenticate_user(self):
        # 1. Create a user
        created = create_user(self.email, self.password)
        self.assertTrue(created, "User creation failed")

        # 2. Prevent duplicate signup
        duplicate = create_user(self.email, "another_pass")
        self.assertFalse(duplicate, "Duplicate user creation was not prevented")

        # 3. Authenticate with valid password
        auth = authenticate_user(self.email, self.password)
        self.assertIsNotNone(auth, "Authentication failed with valid credentials")
        self.assertEqual(auth.get("email"), self.email)

        # 4. Fail authentication with invalid password
        failed_auth = authenticate_user(self.email, "wrong_password")
        self.assertIsNone(failed_auth, "Authentication succeeded with incorrect password")

    def test_update_password(self):
        create_user(self.email, self.password)
        
        # Update user password
        new_password = "NewSecr3tP@ss"
        updated = update_user_password(self.email, new_password)
        self.assertTrue(updated, "Password update failed")
        
        # Verify authentication with old password fails
        old_auth = authenticate_user(self.email, self.password)
        self.assertIsNone(old_auth, "Authentication succeeded with old password after update")
        
        # Verify authentication with new password succeeds
        new_auth = authenticate_user(self.email, new_password)
        self.assertIsNotNone(new_auth, "Authentication failed with new password after update")

    def test_otp_generation_and_verification(self):
        purpose = "verification"
        pending_data = {"temp": "data"}
        
        # Generate OTP code
        otp_code = generate_and_save_otp(self.email, purpose, pending_data)
        self.assertEqual(len(otp_code), 6, "OTP code length is not 6")
        self.assertTrue(otp_code.isdigit(), "OTP code is not digit-only")
        
        # Verify OTP verification with invalid code fails
        failed_verification = verify_and_delete_otp(self.email, purpose, "000000")
        self.assertIsNone(failed_verification, "Invalid OTP verification did not return None")

        # Verify OTP verification with valid code succeeds and returns pending data
        success_verification = verify_and_delete_otp(self.email, purpose, otp_code)
        self.assertEqual(success_verification, pending_data, "OTP verification failed to return original pending data")

        # Verify verified OTP is deleted (cannot verify again)
        reverify = verify_and_delete_otp(self.email, purpose, otp_code)
        self.assertIsNone(reverify, "OTP was not deleted after verification")

if __name__ == "__main__":
    unittest.main()
