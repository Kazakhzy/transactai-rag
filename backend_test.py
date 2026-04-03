#!/usr/bin/env python3

import requests
import sys
import json
import time
from pathlib import Path

class RAGBackendTester:
    def __init__(self, base_url="https:        self.base_url = base_url
        self.session_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_result(self, test_name, success, details=""):
        result = {
            "test": test_name,
            "status": "PASS" if success else "FAIL",
            "details": details
        }
        self.test_results.append(result)
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
    
    def test_root_endpoint(self):
        """Test the root API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Message: {data.get('message', 'N/A')}"
            self.log_result("Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_result("Root Endpoint", False, str(e))
            return False
    
    def test_upload_csv(self):
        """Test CSV file upload endpoint"""
        csv_path = "/tmp/test_transactions.csv"
        
        try:
            # Check if test file exists
            if not Path(csv_path).exists():
                self.log_result("Upload CSV", False, "Test CSV file not found")
                return False
            
            # Upload the file
            with open(csv_path, 'rb') as f:
                files = {'file': ('test_transactions.csv', f, 'text/csv')}
                response = requests.post(f"{self.base_url}/upload", files=files, timeout=30)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                required_fields = ['session_id', 'preview', 'summary', 'chart_data', 'pie_data']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
                else:
                    self.session_id = data['session_id']
                    details += f", Session ID: {self.session_id[:8]}..., Rows: {data.get('row_count', 'N/A')}"
                    details += f", Groups: {len(data.get('chart_data', []))}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Raw response: {response.text[:200]}"
            
            self.log_result("Upload CSV", success, details)
            return success
            
        except Exception as e:
            self.log_result("Upload CSV", False, str(e))
            return False
    
    def test_ask_question(self):
        """Test the AI question endpoint"""
        if not self.session_id:
            self.log_result("Ask Question", False, "No session ID available")
            return False
        
        try:
            question_data = {
                "session_id": self.session_id,
                "question": "Which category has the highest total revenue?"
            }
            
            response = requests.post(
                f"{self.base_url}/ask", 
                json=question_data, 
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                required_fields = ['answer', 'sources']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
                else:
                    answer_length = len(data.get('answer', ''))
                    sources_count = len(data.get('sources', []))
                    details += f", Answer length: {answer_length}, Sources: {sources_count}"
                    
                    # Basic check for meaningful answer
                    if answer_length < 10:
                        details += ", Warning: Very short answer"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Raw response: {response.text[:200]}"
            
            self.log_result("Ask Question", success, details)
            return success
            
        except Exception as e:
            self.log_result("Ask Question", False, str(e))
            return False
    
    def test_ask_invalid_session(self):
        """Test ask endpoint with invalid session ID"""
        try:
            question_data = {
                "session_id": "invalid-session-id",
                "question": "Test question"
            }
            
            response = requests.post(
                f"{self.base_url}/ask", 
                json=question_data, 
                headers={'Content-Type': 'application/json'},
                timeout=15
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                answer = data.get('answer', '')
                # Should return error message for invalid session
                if 'session not found' in answer.lower() or 'upload a csv first' in answer.lower():
                    details += ", Correctly handled invalid session"
                else:
                    details += f", Unexpected response: {answer[:100]}"
            
            self.log_result("Invalid Session Handling", success, details)
            return success
            
        except Exception as e:
            self.log_result("Invalid Session Handling", False, str(e))
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("🧪 RAG Backend API Testing")
        print("=" * 60)
        print(f"Testing against: {self.base_url}")
        print()
        
        # Test sequence
        tests = [
            self.test_root_endpoint,
            self.test_upload_csv,
            self.test_ask_question,
            self.test_ask_invalid_session,
        ]
        
        for test_func in tests:
            try:
                test_func()
                time.sleep(0.5)  # Small delay between tests
            except Exception as e:
                print(f"❌ Unexpected error in {test_func.__name__}: {e}")
                self.tests_run += 1
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return 1

def main():
    tester = RAGBackendTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())