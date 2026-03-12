from __future__ import annotations

import uuid

import httpx

# Базовый URL внешнего LLM сервиса. При необходимости можно изменить через конфигурацию.
LLM_BASE_URL = "http://localhost:7860"


async def send_to_llm(prompt: str, max_tokens: int = 2048) -> str:
    """Отправляет prompt во внешний LLM-сервис и возвращает сгенерированный текст.

    Важно: для локального адреса отключаем прокси через transport,
    чтобы запросы к localhost не шли через системный proxy.
    """

    payload = {
        "prompt": prompt,
        "max_tokens": max_tokens,
        "request_id": str(uuid.uuid4()),
    }

    transport = httpx.AsyncHTTPTransport(proxy=None)

    try:
        async with httpx.AsyncClient(timeout=120.0, transport=transport) as client:
            response = await client.post(f"{LLM_BASE_URL}/generate", json=payload)
            response.raise_for_status()
            data = response.json()
            return str(data.get("text", ""))
    except httpx.RequestError:
        return "LLM сервер недоступен. Проверьте подключение."
