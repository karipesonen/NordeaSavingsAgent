import os
from dotenv import load_dotenv
from langchain.tools import tool
from firecrawl import FirecrawlApp

load_dotenv()

_API_KEY = os.environ.get("FIRECRAWL_API_KEY")


def _app() -> FirecrawlApp:
    if not _API_KEY:
        raise RuntimeError(
            "FIRECRAWL_API_KEY is not set. Add it to your .env file."
        )
    return FirecrawlApp(api_key=_API_KEY)


@tool
def scrape(url: str) -> str:
    """Scrape a URL and return clean markdown content."""
    try:
        result = _app().scrape_url(url, formats=["markdown"])
        return result.markdown
    except Exception as e:
        return f"[scrape error for {url}]: {e} — skip this URL and try another."


@tool
def search(query: str) -> str:
    """Search the web. Returns title, URL, and description for each result so
    you can decide which pages to scrape without blindly fetching all of them."""
    try:
        results = _app().search(query, limit=5, timeout=10).web
        lines = []
        for r in results:
            title = getattr(r, "title", "") or ""
            desc = getattr(r, "description", "") or getattr(r, "snippet", "") or ""
            lines.append(f"Title: {title}\nURL: {r.url}\nDescription: {desc}")
        return "\n\n".join(lines) if lines else "[search returned no results]"
    except Exception as e:
        return f"[search error]: {e}"


WEB_TOOLS = [scrape, search]
