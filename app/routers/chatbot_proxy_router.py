from fastapi import APIRouter, Request, Response
import httpx

# Simple reverse proxy for chatbot API endpoints
router = APIRouter()

# Backend chatbot API is expected to listen on localhost:8000 inside the container
BACKEND_BASE = "http://127.0.0.1:8000"

async def _proxy_to_backend(path: str, request: Request) -> Response:
    target_url = f"{BACKEND_BASE}/{path}"
    # Forward headers, excluding host to avoid host mismatch
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    # Read body if present
    body = await request.body()

    import json
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body or None,
            params=dict(request.query_params),
        )
        # Fallback: some endpoints may exist without /v1 prefix
        if resp.status_code == 404:
            alt_path = "/chat" if path.endswith("v1/chat") else path
            alt_url = f"{BACKEND_BASE}/{alt_path}"
            resp = await client.request(
                method=request.method,
                url=alt_url,
                headers=headers,
                content=body or None,
                params=dict(request.query_params),
            )
        # If backend still returns 404, provide a graceful in-app fallback response
        if resp.status_code == 404:
            fallback = {"reply": "Sorry, chat service is unavailable right now. (fallback)"}
            return Response(content=json.dumps(fallback).encode(), status_code=200, media_type="application/json")

    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))

@router.api_route("/api/chatbot/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def chatbot_proxy(path: str, request: Request) -> Response:
    return await _proxy_to_backend(path, request)

@router.api_route("/api/v1/chatbot/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def chatbot_proxy_v1(path: str, request: Request) -> Response:
    return await _proxy_to_backend(path, request)
