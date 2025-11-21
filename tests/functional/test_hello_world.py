"""
Functional test: Hello World with OpenRouter integration

This test validates the end-to-end flow:
1. Create a Python agent with AI capabilities using OpenRouter
2. Agent auto-registers with the control plane
3. Execute a reasoner through the control plane API
4. Validate that the LLM-generated response is correct
5. Check execution metadata (workflow ID, execution ID, timing)
"""

import asyncio
import os
import socket
import threading
from typing import Dict

import httpx
import pytest
import uvicorn
from agentfield import Agent


@pytest.mark.functional
@pytest.mark.openrouter
@pytest.mark.asyncio
async def test_hello_world_with_openrouter(
    make_test_agent,
    openrouter_config,
    control_plane_url,
    async_http_client,
):
    """
    Test basic agent execution with real OpenRouter LLM calls.
    
    This test creates an agent with a simple reasoner that uses OpenRouter
    to answer a basic math question, then validates the entire execution flow.
    """
    # ========================================================================
    # Step 1: Create agent with OpenRouter configuration
    # ========================================================================
    agent = make_test_agent(
        node_id="hello-world-agent",
        ai_config=openrouter_config,
    )
    
    # ========================================================================
    # Step 2: Define a simple reasoner that uses AI
    # ========================================================================
    @agent.reasoner()
    async def ask_math_question(question: str) -> Dict[str, str]:
        """
        Ask a simple math question and get the answer from the LLM.
        
        Args:
            question: The math question to ask
            
        Returns:
            Dictionary with the question and answer
        """
        # Use the agent's AI capability to answer the question
        response = await agent.ai(
            system="You are a helpful math assistant. Provide only the numeric answer.",
            user=f"Answer this math question with just the number, no explanation: {question}",
        )
        answer_text = getattr(response, "text", None) or str(response)
        
        return {
            "question": question,
            "answer": answer_text.strip(),
        }
    
    # ========================================================================
    # Step 3: Start agent server on a free port
    # ========================================================================
    # Find a free port
    agent_bind_host = os.environ.get("TEST_AGENT_BIND_HOST", "127.0.0.1")
    agent_callback_host = os.environ.get("TEST_AGENT_CALLBACK_HOST", "127.0.0.1")
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((agent_bind_host, 0))
        agent_port = s.getsockname()[1]
    
    agent.base_url = f"http://{agent_callback_host}:{agent_port}"
    
    # Configure and start uvicorn server
    config = uvicorn.Config(
        app=agent,
        host=agent_bind_host,
        port=agent_port,
        log_level="error",
        access_log=False,
    )
    server = uvicorn.Server(config)
    loop = asyncio.new_event_loop()
    
    def run_server():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(server.serve())
    
    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()
    
    # Wait for server to be ready
    await asyncio.sleep(2)
    
    try:
        # ====================================================================
        # Step 4: Register agent with control plane
        # ====================================================================
        await agent.agentfield_handler.register_with_agentfield_server(agent_port)
        # Disable AgentField callback handshakes so reasoner responses remain synchronous
        agent.agentfield_server = None
        
        # Wait for registration to propagate
        await asyncio.sleep(2)
        
        # Verify registration by checking the nodes endpoint
        nodes_response = await async_http_client.get(f"/api/v1/nodes/{agent.node_id}")
        assert nodes_response.status_code == 200, f"Agent not found in registry: {nodes_response.text}"
        
        node_data = nodes_response.json()
        assert node_data["id"] == agent.node_id
        assert "ask_math_question" in [r["id"] for r in node_data.get("reasoners", [])]
        
        print(f"✓ Agent registered successfully: {agent.node_id}")
        
        # ====================================================================
        # Step 5: Execute reasoner through control plane
        # ====================================================================
        execution_request = {
            "input": {
                "question": "What is 7 + 5?"
            }
        }
        
        execution_response = await async_http_client.post(
            f"/api/v1/reasoners/{agent.node_id}.ask_math_question",
            json=execution_request,
            timeout=60.0,
        )
        
        assert execution_response.status_code == 200, (
            f"Execution failed: {execution_response.status_code} - {execution_response.text}"
        )
        
        result_data = execution_response.json()
        
        print(f"✓ Execution completed successfully")
        print(f"  Response: {result_data}")
        
        # ====================================================================
        # Step 6: Validate execution result
        # ====================================================================
        # Check that we have the expected structure
        assert "result" in result_data, "Missing 'result' in response"
        assert "node_id" in result_data, "Missing 'node_id' in response"
        assert "duration_ms" in result_data, "Missing 'duration_ms' in response"
        
        # Validate node ID
        assert result_data["node_id"] == agent.node_id
        
        # Validate result content
        result = result_data["result"]
        assert "question" in result
        assert "answer" in result
        assert result["question"] == "What is 7 + 5?"
        
        # The LLM should answer with "12" or something containing "12"
        answer = result["answer"]
        assert "12" in answer, f"Expected answer to contain '12', got: {answer}"
        
        print(f"✓ Result validation passed")
        print(f"  Question: {result['question']}")
        print(f"  Answer: {result['answer']}")
        
        # ====================================================================
        # Step 7: Validate execution metadata
        # ====================================================================
        # Check for execution metadata headers/fields
        headers = execution_response.headers
        assert "X-Workflow-ID" in headers or "x-workflow-id" in headers, (
            "Missing workflow ID in response headers"
        )
        assert "X-Execution-ID" in headers or "x-execution-id" in headers, (
            "Missing execution ID in response headers"
        )
        
        # Validate timing
        assert result_data["duration_ms"] >= 0, "Duration should be non-negative"
        
        # For OpenRouter calls, we expect some non-trivial execution time
        assert result_data["duration_ms"] > 0, "Duration should be greater than 0 for real API calls"
        
        print(f"✓ Metadata validation passed")
        print(f"  Duration: {result_data['duration_ms']}ms")
        print(f"  Workflow ID: {headers.get('X-Workflow-ID', headers.get('x-workflow-id', 'N/A'))}")
        print(f"  Execution ID: {headers.get('X-Execution-ID', headers.get('x-execution-id', 'N/A'))}")
        
        print("\n✅ All validations passed! End-to-end test successful.")
        
    finally:
        # ====================================================================
        # Cleanup: Stop agent server
        # ====================================================================
        server.should_exit = True
        if loop.is_running():
            loop.call_soon_threadsafe(lambda: None)
        thread.join(timeout=10)


@pytest.mark.functional
@pytest.mark.asyncio
async def test_control_plane_health(async_http_client):
    """
    Simple sanity test to ensure the control plane is responding.
    
    This test doesn't require OpenRouter and serves as a quick smoke test.
    """
    response = await async_http_client.get("/api/v1/health")
    assert response.status_code == 200
    
    health_data = response.json()
    assert "status" in health_data or response.text == "OK" or response.status_code == 200
    
    print("✓ Control plane health check passed")
