try:
    from fastmcp import FastMCP
    mcp = FastMCP("Math")
except ImportError:
    # Fallback if fastmcp is not available
    class MockMCP:
        def tool(self):
            def decorator(func):
                return func
            return decorator
        def run(self, **kwargs):
            print("FastMCP not installed, cannot run as MCP server")
    mcp = MockMCP()

import os

@mcp.tool()
def add(a: float, b: float) -> float:
    """Add two numbers (supports int and float)"""
    return float(a) + float(b)

@mcp.tool()
def multiply(a: float, b: float) -> float:
    """Multiply two numbers (supports int and float)"""
    return float(a) * float(b)

@mcp.tool()
def subtract(a: float, b: float) -> float:
    """Subtract b from a (supports int and float)"""
    return float(a) - float(b)

@mcp.tool()
def divide(a: float, b: float) -> float:
    """Divide a by b (supports int and float). Returns error if b is zero."""
    if float(b) == 0:
        return float('inf')  # Return infinity for division by zero
    return float(a) / float(b)

if __name__ == "__main__":
    port = int(os.getenv("MATH_HTTP_PORT", "8000"))
    mcp.run(transport="streamable-http", port=port)
