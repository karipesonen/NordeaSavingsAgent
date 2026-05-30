import json
import os

from langchain.tools import tool

# ── Catalog loader ─────────────────────────────────────────────────────────────
# Resolve the education-resources.json that lives in the frontend data folder.
_HERE = os.path.dirname(os.path.abspath(__file__))
_CATALOG_PATH = os.path.normpath(
    os.path.join(_HERE, "..", "..", "front-nora-mobile", "public", "data", "education-resources.json")
)


def _load_catalog() -> list[dict]:
    try:
        with open(_CATALOG_PATH, encoding="utf-8") as f:
            return json.load(f)["resources"]
    except Exception:
        return []


_CATALOG: list[dict] = _load_catalog()


# ── Tools ──────────────────────────────────────────────────────────────────────

@tool
def retrieve_learning_resources(query: str) -> str:
    """
    Search the curated education catalog for resources related to a topic or query.
    Returns the top-3 matching resources (title, url, summary, domain, format, estimated minutes).
    Always call this first before answering any learning question.
    """
    q = query.lower()
    scored: list[tuple[int, dict]] = []

    for r in _CATALOG:
        score = 0
        for kw in r.get("triggerKeywords", []):
            if kw.lower() in q or q in kw.lower():
                score += 2
        if q in r.get("title", "").lower():
            score += 3
        if q in r.get("summary", "").lower():
            score += 1
        if q in r.get("domain", "").lower():
            score += 1
        if q in r.get("topic", "").lower():
            score += 1
        if score > 0:
            scored.append((score, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = [r for _, r in scored[:3]]

    if not top:
        return json.dumps({"results": [], "note": "No close catalog match — use your knowledge and suggest a web search."})

    return json.dumps(
        {
            "results": [
                {
                    "id": r["id"],
                    "title": r["title"],
                    "format": r["format"],
                    "domain": r["domain"],
                    "topic": r["topic"],
                    "url": r["url"],
                    "summary": r["summary"],
                    "estimatedMinutes": r.get("estimatedMinutes"),
                }
                for r in top
            ]
        },
        indent=2,
    )


@tool
def list_learning_domains() -> str:
    """
    Return all distinct learning domains available in the catalog.
    Use this when the user asks what topics they can learn about, or to
    pick the right domain before calling retrieve_learning_resources.
    """
    domains: dict[str, list[str]] = {}
    for r in _CATALOG:
        domain = r.get("domain", "Other")
        domains.setdefault(domain, []).append(r["topic"])
    return json.dumps(domains, indent=2)


@tool
def fetch_article_content(url: str) -> str:
    """
    Fetch the full text of an article or video page using Firecrawl.
    Use this for a deep-dive explanation or to generate a quiz grounded in real content.
    Only call for URLs that appear in the catalog (do not invent URLs).
    Returns up to 4 000 characters of markdown.
    """
    from firecrawl import FirecrawlApp

    api_key = os.environ.get("FIRECRAWL_API_KEY", "")
    if not api_key:
        return "[fetch_article_content] FIRECRAWL_API_KEY not set — skipping full-text fetch."
    try:
        app = FirecrawlApp(api_key=api_key)
        result = app.scrape_url(url, formats=["markdown"])
        text: str = result.markdown or ""
        return text[:4000] if len(text) > 4000 else text
    except Exception as e:
        return f"[fetch_article_content error for {url}]: {e}"


LEARNING_TOOLS = [retrieve_learning_resources, list_learning_domains, fetch_article_content]
