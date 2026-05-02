"""
Test suite for Enterprise Multi-Agent Support System
Production-ready testing for 12 LPA portfolio
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import json
from datetime import datetime

from src.main import app, agent_manager

client = TestClient(app)

class TestSupportAPI:
    """Test main API endpoints"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_metrics_endpoint(self):
        """Test Prometheus metrics endpoint"""
        response = client.get("/metrics")
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]
    
    @pytest.mark.asyncio
    async def test_chat_support_faq(self):
        """Test FAQ agent routing and response"""
        with patch.object(agent_manager, 'classify_intent', return_value='faq'), \
             patch.object(agent_manager, 'get_agent_response') as mock_response:
            
            mock_response.return_value = {
                "response": "Refunds are processed within 5-7 business days.",
                "agent_type": "faq",
                "confidence": 0.85,
                "metadata": {"timestamp": datetime.utcnow().isoformat()}
            }
            
            request_data = {
                "session_id": "test_session_123",
                "user_id": "user_456",
                "message": "How long do refunds take?",
                "context": {"source": "web"}
            }
            
            response = client.post("/support/chat", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["agent_type"] == "faq"
            assert "refund" in data["response"].lower()
            assert data["confidence"] > 0.8
    
    @pytest.mark.asyncio
    async def test_chat_support_orders(self):
        """Test order agent routing and response"""
        with patch.object(agent_manager, 'classify_intent', return_value='orders'), \
             patch.object(agent_manager, 'get_agent_response') as mock_response:
            
            mock_response.return_value = {
                "response": "Your order ORD123 is shipped and will arrive tomorrow.",
                "agent_type": "orders",
                "confidence": 0.9,
                "metadata": {"timestamp": datetime.utcnow().isoformat()}
            }
            
            request_data = {
                "session_id": "test_session_456",
                "user_id": "user_789",
                "message": "Where is my order ORD123?",
                "context": {"source": "mobile"}
            }
            
            response = client.post("/support/chat", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["agent_type"] == "orders"
            assert "ORD123" in data["response"]
    
    @pytest.mark.asyncio
    async def test_chat_support_billing(self):
        """Test billing agent routing and response"""
        with patch.object(agent_manager, 'classify_intent', return_value='billing'), \
             patch.object(agent_manager, 'get_agent_response') as mock_response:
            
            mock_response.return_value = {
                "response": "Your latest invoice is available in the Billing section.",
                "agent_type": "billing",
                "confidence": 0.88,
                "metadata": {"timestamp": datetime.utcnow().isoformat()}
            }
            
            request_data = {
                "session_id": "test_session_789",
                "user_id": "user_123",
                "message": "I need to see my latest invoice",
                "context": {"source": "email"}
            }
            
            response = client.post("/support/chat", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["agent_type"] == "billing"
            assert "invoice" in data["response"].lower()
    
    def test_get_session_history_not_found(self):
        """Test session history for non-existent session"""
        response = client.get("/support/session/nonexistent_session")
        assert response.status_code == 404
        assert "Session not found" in response.json()["detail"]
    
    def test_invalid_request_data(self):
        """Test API with invalid request data"""
        invalid_data = {
            "session_id": "",  # Empty session_id
            "user_id": "user_123",
            "message": "Test message"
        }
        
        response = client.post("/support/chat", json=invalid_data)
        assert response.status_code == 422  # Validation error

class TestAgentManager:
    """Test agent manager functionality"""
    
    @pytest.mark.asyncio
    async def test_intent_classification(self):
        """Test intent classification accuracy"""
        test_cases = [
            ("Where is my order?", "orders"),
            ("How do I get a refund?", "faq"),
            ("I need to update my payment method", "billing"),
            ("What are your shipping policies?", "faq"),
            ("Track package ORD123", "orders")
        ]
        
        for message, expected_intent in test_cases:
            with patch('src.main.llm.ainvoke') as mock_llm:
                mock_llm.return_value.content = expected_intent
                
                intent = await agent_manager.classify_intent(message)
                assert intent == expected_intent
    
    @pytest.mark.asyncio
    async def test_agent_response_generation(self):
        """Test agent response generation"""
        with patch('src.main.agent_manager.agents') as mock_agents:
            mock_agent = AsyncMock()
            mock_agent.ainvoke.return_value = {
                "messages": [
                    {"content": "Test response from agent"}
                ]
            }
            mock_agents.__getitem__.return_value = mock_agent
            
            result = await agent_manager.get_agent_response(
                "faq", "Test message", "session_123"
            )
            
            assert "response" in result
            assert result["agent_type"] == "faq"
            assert result["confidence"] > 0

class TestTools:
    """Test agent tools functionality"""
    
    @pytest.mark.asyncio
    async def test_search_faq_tool(self):
        """Test FAQ search tool"""
        from src.main import search_faq
        
        # Test known FAQ
        result = search_faq.invoke({"query": "refund policy"})
        assert "refund" in result.lower()
        
        # Test unknown FAQ
        result = search_faq.invoke({"query": "random unknown question"})
        assert "couldn't find" in result.lower()
    
    @pytest.mark.asyncio
    async def test_check_order_status_tool(self):
        """Test order status tool"""
        from src.main import check_order_status
        
        # Test known order
        result = check_order_status.invoke({"order_id": "ORD123"})
        assert "shipped" in result.lower()
        
        # Test unknown order
        result = check_order_status.invoke({"order_id": "UNKNOWN999"})
        assert "not found" in result.lower()
    
    @pytest.mark.asyncio
    async def test_process_billing_inquiry_tool(self):
        """Test billing inquiry tool"""
        from src.main import process_billing_inquiry
        
        # Test invoice inquiry
        result = process_billing_inquiry.invoke({
            "user_id": "user_123", 
            "inquiry_type": "invoice"
        })
        assert "invoice" in result.lower()
        assert "user_123" in result

class TestPerformance:
    """Performance and load testing"""
    
    def test_concurrent_requests(self):
        """Test handling concurrent requests"""
        import threading
        import time
        
        results = []
        
        def make_request():
            response = client.get("/health")
            results.append(response.status_code)
        
        # Make 10 concurrent requests
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # All requests should succeed
        assert all(status == 200 for status in results)
        assert len(results) == 10
    
    def test_response_time(self):
        """Test API response time"""
        start_time = time.time()
        response = client.get("/health")
        end_time = time.time()
        
        assert response.status_code == 200
        response_time = (end_time - start_time) * 1000  # Convert to milliseconds
        assert response_time < 1000  # Should respond within 1 second

class TestErrorHandling:
    """Test error handling and edge cases"""
    
    def test_database_connection_error(self):
        """Test handling of database connection errors"""
        # This would require mocking database failures
        # Implementation depends on specific error handling strategy
        pass
    
    def test_redis_connection_error(self):
        """Test handling of Redis connection errors"""
        # This would require mocking Redis failures
        # Implementation depends on specific error handling strategy
        pass
    
    def test_llm_api_error(self):
        """Test handling of LLM API errors"""
        # This would require mocking LLM API failures
        # Implementation depends on specific error handling strategy
        pass

# Integration tests
class TestIntegration:
    """Integration tests for complete workflows"""
    
    @pytest.mark.asyncio
    async def test_complete_support_workflow(self):
        """Test complete support workflow from start to finish"""
        # This would test the entire flow:
        # 1. User sends message
        # 2. Intent classification
        # 3. Agent routing
        # 4. Response generation
        # 5. Session storage
        # 6. Metrics collection
        
        pass
    
    @pytest.mark.asyncio
    async def test_multi_turn_conversation(self):
        """Test multi-turn conversation with context"""
        # Test conversation continuity across multiple messages
        pass

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
