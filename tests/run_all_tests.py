import os
import sys
import unittest

# Add project root to python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

def run_suite():
    print("=" * 60)
    print("STARTING COMPREHENSIVE PRODUCTION READINESS TEST SUITE")
    print("=" * 60)
    
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=os.path.join(PROJECT_ROOT, "tests"), pattern="test_*.py")
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("\n" + "=" * 60)
    print("TEST SUITE RUN COMPLETED")
    print(f"Total Tests Run: {result.testsRun}")
    print(f"Errors: {len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print("=" * 60)
    
    if not result.wasSuccessful():
        print("\n[WARNING] Some tests failed. Please review the details above.")
        sys.exit(1)
    else:
        print("\n[SUCCESS] All production readiness tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    run_suite()
