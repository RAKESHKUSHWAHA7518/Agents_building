"""
Enterprise Multi-Agent Customer Support System
Production-ready implementation for 12 LPA GenAI roles
"""

import os
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import logging

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis
from sqlalchemy import create_engine, Column, String, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import prometheus_client as prom

# LangChain imports
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Enterprise Multi-Agent Support System",
    description="Production-ready customer support with multi-agent orchestration",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
REQUEST_COUNT = prom.Counter('support_requests_total', 'Total support requests', ['agent_type'])
REQUEST_DURATION = prom.Histogram('support_request_duration_seconds', 'Request duration')
ACTIVE_SESSIONS = prom.Gauge('active_sessions', 'Active user sessions')

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/support_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, engine=engine)
Base = declarative_base()

# Redis setup
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

# Models
class Conversation(Base):
    __tablename__ = "conversations"
    
    session_id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    messages = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SupportRequest(BaseModel):
    session_id: str = Field(..., description="Unique session identifier")
    user_id: str = Field(..., description="User identifier")
    message: str = Field(..., description="User query")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")

class SupportResponse(BaseModel):
    session_id: str
    response: str
    agent_type: str
    confidence: float
    metadata: Optional[Dict[str, Any]] = None

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.1
)

# Tools for agents
@tool
def search_faq(query: str) -> str:
    """Search FAQ database for relevant answers"""
    # Simulated FAQ search - in production, connect to real FAQ system
    faq_data = {
        "refund": "Refunds are processed within 5-7 business days. You can track your refund status in your account.",
        "shipping": "Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days.",
        "account": "You can update your account information in the Profile section of your dashboard.",
        "payment": "We accept all major credit cards, debit cards, and digital payment methods including UPI."
    }
    
    query_lower = query.lower()
    for key, value in faq_data.items():
        if key in query_lower:
            return value
    
    return "I couldn't find a specific answer in our FAQ. Let me connect you with a specialized agent."

@tool
def check_order_status(order_id: str) -> str:
    """Check order status and details"""
    # Simulated order status check - in production, connect to real order system
    orders = {
        "ORD123": "Your order ORD123 is shipped and will arrive by tomorrow. Tracking number: TRK789",
        "ORD456": "Your order ORD456 is being processed and will ship within 24 hours.",
        "ORD789": "Your order ORD789 was delivered yesterday. Please rate your experience!"
    }
    
    return orders.get(order_id, f"Order {order_id} not found. Please check the order number and try again.")

@tool
def process_billing_inquiry(user_id: str, inquiry_type: str) -> str:
    """Handle billing-related inquiries"""
    # Simulated billing system - in production, connect to real billing system
    billing_responses = {
        "invoice": f"Your latest invoice for user {user_id} is available in the Billing section. Amount: $45.99",
        "payment_method": "You can update your payment method in Account Settings > Payment Methods",
        "refund_status": f"Refund for user {user_id} is being processed. Expected completion: 3-5 business days"
    }
    
    return billing_responses.get(inquiry_type, "I'll help you with your billing inquiry. Let me check your account details.")

# Agent definitions
class AgentManager:
    def __init__(self):
        self.agents = {}
        self.memory = MemorySaver()
        self._initialize_agents()
    
    def _initialize_agents(self):
        """Initialize all specialized agents"""
        
        # FAQ Agent
        self.agents['faq'] = create_react_agent(
            llm,
            [search_faq],
            checkpointer=self.memory,
            state_modifier="You are a FAQ specialist. Help users with common questions and direct them to appropriate resources."
        )
        
        # Order Agent
        self.agents['orders'] = create_react_agent(
            llm,
            [check_order_status],
            checkpointer=self.memory,
            state_modifier="You are an order management specialist. Help users track orders, check status, and handle order-related issues."
        )
        
        # Billing Agent
        self.agents['billing'] = create_react_agent(
            llm,
            [process_billing_inquiry],
            checkpointer=self.memory,
            state_modifier="You are a billing specialist. Help users with payment issues, invoices, and refund requests."
        )
        
        # Router Agent
        self.router_prompt = """
        You are a customer support router. Analyze the user query and route to the appropriate agent:
        
        - FAQ Agent: General questions, policies, how-to guides
        - Orders Agent: Order tracking, shipping, returns, product issues
        - Billing Agent: Payments, invoices, refunds, subscriptions
        
        Respond with only the agent name: 'faq', 'orders', or 'billing'
        """
    
    async def classify_intent(self, message: str) -> str:
        """Classify user intent and route to appropriate agent"""
        try:
            response = await llm.ainvoke([
                SystemMessage(content=self.router_prompt),
                HumanMessage(content=message)
            ])
            
            intent = response.content.strip().lower()
            return intent if intent in ['faq', 'orders', 'billing'] else 'faq'
            
        except Exception as e:
            logger.error(f"Intent classification error: {e}")
            return 'faq'
    
    async def get_agent_response(self, agent_type: str, message: str, session_id: str) -> Dict[str, Any]:
        """Get response from specialized agent"""
        try:
            agent = self.agents[agent_type]
            config = RunnableConfig(configurable={"thread_id": session_id})
            
            result = await agent.ainvoke(
                {"messages": [HumanMessage(content=message)]},
                config=config
            )
            
            response_text = result["messages"][-1].content
            
            return {
                "response": response_text,
                "agent_type": agent_type,
                "confidence": 0.85,  # In production, calculate actual confidence
                "metadata": {
                    "message_count": len(result["messages"]),
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Agent response error: {e}")
            return {
                "response": "I'm having trouble processing your request. Let me connect you with a human agent.",
                "agent_type": agent_type,
                "confidence": 0.0,
                "metadata": {"error": str(e)}
            }

# Initialize agent manager
agent_manager = AgentManager()

# API Endpoints
@app.post("/support/chat", response_model=SupportResponse)
async def chat_support(request: SupportRequest, background_tasks: BackgroundTasks):
    """Main chat endpoint with multi-agent orchestration"""
    
    start_time = datetime.utcnow()
    
    try:
        # Update active sessions
        ACTIVE_SESSIONS.inc()
        
        # Store message in Redis for session continuity
        session_key = f"session:{request.session_id}"
        message_data = {
            "user_id": request.user_id,
            "message": request.message,
            "timestamp": datetime.utcnow().isoformat(),
            "context": request.context
        }
        
        # Add to session history
        redis_client.lpush(session_key, json.dumps(message_data))
        redis_client.expire(session_key, 3600)  # 1 hour expiration
        
        # Classify intent and route to appropriate agent
        agent_type = await agent_manager.classify_intent(request.message)
        
        # Get agent response
        response_data = await agent_manager.get_agent_response(
            agent_type, request.message, request.session_id
        )
        
        # Store in database
        db = SessionLocal()
        try:
            conversation = db.query(Conversation).filter(
                Conversation.session_id == request.session_id
            ).first()
            
            if not conversation:
                conversation = Conversation(
                    session_id=request.session_id,
                    user_id=request.user_id,
                    messages=[]
                )
                db.add(conversation)
            
            # Add messages to conversation
            conversation.messages.append({
                "role": "user",
                "content": request.message,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            conversation.messages.append({
                "role": "assistant",
                "content": response_data["response"],
                "agent_type": agent_type,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            conversation.updated_at = datetime.utcnow()
            db.commit()
            
        finally:
            db.close()
        
        # Update metrics
        REQUEST_COUNT.labels(agent_type=agent_type).inc()
        duration = (datetime.utcnow() - start_time).total_seconds()
        REQUEST_DURATION.observe(duration)
        
        return SupportResponse(
            session_id=request.session_id,
            response=response_data["response"],
            agent_type=agent_type,
            confidence=response_data["confidence"],
            metadata=response_data["metadata"]
        )
        
    except Exception as e:
        logger.error(f"Chat support error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
    finally:
        ACTIVE_SESSIONS.dec()

@app.get("/support/session/{session_id}")
async def get_session_history(session_id: str):
    """Get conversation history for a session"""
    try:
        db = SessionLocal()
        conversation = db.query(Conversation).filter(
            Conversation.session_id == session_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "session_id": session_id,
            "user_id": conversation.user_id,
            "messages": conversation.messages,
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at
        }
        
    finally:
        db.close()

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    from fastapi.responses import Response
    return Response(prom.generate_latest(), media_type="text/plain")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Redis connection
        redis_client.ping()
        
        # Check database connection
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        
        return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

# Background task for session cleanup
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Enterprise Multi-Agent Support System starting up...")
    
    # Warm up Redis connection
    try:
        redis_client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
    
    # Check database connection
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        logger.info("Database connection established")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
