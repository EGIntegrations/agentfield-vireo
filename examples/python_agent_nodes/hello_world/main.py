"""
Hello World Agent - Simple Agentfield Example

Demonstrates:
- Simple Pydantic schema (2-3 attributes)
- Deterministic skill (template retrieval)
- AI-powered reasoner (personalization)
- Orchestrator pattern (coordination)
"""

import os
from agentfield import Agent
from agentfield import AIConfig
from pydantic import BaseModel, Field
from typing import Literal

# ============= INITIALIZATION =============

app = Agent(
    node_id="hello-world",
    agentfield_server="http://localhost:8080",
    version="1.0.0",
    ai_config=AIConfig(
        model=os.getenv(
            "SMALL_MODEL", "openai/gpt-4.1-mini"
        ),  # Default to fast, cheap model
        temperature=0.7,
        max_tokens=500,
        fallback_models=[
            os.getenv("SMALL_MODEL", "openai/gpt-4.1-mini"),
            os.getenv("FALLBACK_MODEL", "openai/gpt-4.1"),
        ],
    ),
    dev_mode=True,  # Enables helpful development features
)

# ============= SCHEMAS (SIMPLE, 2-3 ATTRIBUTES) =============


class PersonalizedGreeting(BaseModel):
    """AI-generated personalized greeting."""

    greeting: str = Field(description="The personalized greeting message")
    tone: Literal["formal", "casual", "enthusiastic"] = Field(
        description="The tone of the greeting"
    )
    personalization_note: str = Field(
        description="Brief note explaining the personalization"
    )


# ============= SKILLS (DETERMINISTIC) =============


@app.skill(tags=["templates", "greetings"])
def get_greeting_template(language: str = "english") -> dict:
    """
    Returns a greeting template based on language.
    This is deterministic - no AI needed.
    """
    templates = {
        "english": "Hello, {name}! Welcome to Agentfield.",
        "spanish": "¡Hola, {name}! Bienvenido a Agentfield.",
        "french": "Bonjour, {name}! Bienvenue à Agentfield.",
        "german": "Hallo, {name}! Willkommen bei Agentfield.",
        "japanese": "こんにちは、{name}さん！Agentfieldへようこそ。",
    }

    template = templates.get(language.lower(), templates["english"])

    return {
        "template": template,
        "language": language,
        "available_languages": list(templates.keys()),
    }


# ============= REASONERS (AI-POWERED) =============


@app.reasoner(tags=["test"])
async def personalize_greeting(
    name: str, template: str, context: str = ""
) -> PersonalizedGreeting:
    """
    Uses AI to personalize the greeting based on context.
    This demonstrates a simple AI-powered reasoner.
    """

    system_prompt = """You are a friendly greeting expert.
    Your job is to personalize greetings based on the context provided.
    Be warm, welcoming, and adjust your tone appropriately."""

    user_prompt = f"""
    Template: {template}
    Name: {name}
    Context: {context if context else "No additional context provided"}

    Personalize this greeting. Fill in the name and adjust the message based on the context.
    Choose an appropriate tone (formal, casual, or enthusiastic).
    """

    return await app.ai(
        system=system_prompt,
        user=user_prompt,
        schema=PersonalizedGreeting,
        temperature=0.8,  # Higher for more creative greetings
    )


# ============= ORCHESTRATOR (MAIN ENTRY POINT) =============


@app.reasoner()
async def generate_greeting(
    name: str, language: str = "english", context: str = ""
) -> dict:
    """
    Main orchestrator that generates a personalized greeting.

    Call graph:
    generate_greeting (entry point)
    ├─→ get_greeting_template (skill - deterministic)
    └─→ personalize_greeting (reasoner - AI-powered)

    Args:
        name: Person's name to greet
        language: Language for the greeting (english, spanish, french, german, japanese)
        context: Optional context about the person (e.g., "new user", "returning customer")

    Returns:
        Complete greeting with metadata
    """

    # Step 1: Get greeting template (deterministic skill)
    template_data = get_greeting_template(language)

    # Step 2: Personalize greeting with AI (reasoner)
    personalized = await personalize_greeting(
        name=name, template=template_data["template"], context=context
    )

    # Step 3: Return comprehensive result
    return {
        "name": name,
        "language": language,
        "template": template_data["template"],
        "personalized_greeting": personalized.greeting,
        "tone": personalized.tone,
        "personalization_note": personalized.personalization_note,
        "available_languages": template_data["available_languages"],
    }


# ============= SIMPLE EXAMPLES (ADDITIONAL REASONERS) =============


@app.reasoner()
async def simple_hello(name: str) -> dict:
    """
    Simplest possible reasoner - just says hello.
    No schema, returns string directly.
    """
    response = await app.ai(
        system="You are a friendly assistant.",
        user=f"Say hello to {name} in a creative way.",
        temperature=0.9,
    )

    return {"message": str(response), "name": name}


@app.skill(tags=["examples", "simple"])
def get_timestamp() -> dict:
    """
    Simplest possible skill - returns current timestamp.
    Demonstrates deterministic operation.
    """
    from datetime import datetime

    return {"timestamp": datetime.now().isoformat(), "message": "Current server time"}


# ============= START SERVER =============

if __name__ == "__main__":
    print("🚀 Starting Hello World Agent...")
    print("📍 Node ID: hello-world")
    print("🌐 Control Plane: http://localhost:8080")
    print("\n📚 Available Reasoners:")
    print("  - generate_greeting: Main orchestrator (skill + AI)")
    print("  - personalize_greeting: AI-powered personalization")
    print("  - simple_hello: Simplest AI example")
    print("\n🔧 Available Skills:")
    print("  - get_greeting_template: Get language templates")
    print("  - get_timestamp: Get current timestamp")
    print("\n✨ Example usage:")
    print("  curl -X POST http://localhost:8001/reasoners/generate_greeting \\")
    print('    -H "Content-Type: application/json" \\')
    print('    -d \'{"name": "Alice", "language": "english", "context": "new user"}\'')
    print("\n" + "=" * 60 + "\n")

    app.serve(auto_port=True)
