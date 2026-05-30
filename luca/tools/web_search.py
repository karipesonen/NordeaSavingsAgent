import os
from dotenv import load_dotenv
from langchain.tools import tool
from firecrawl import FirecrawlApp
from firecrawl.v2.client import SearchData

load_dotenv()
app = FirecrawlApp(api_key=os.environ["FIRECRAWL_API_KEY"])

MAX_SCRAPE_CHARS = 6000
SEARCH_RESULT_LIMIT = 3

def _compact_text(text: str, max_chars: int = MAX_SCRAPE_CHARS) -> str:
    """Keep scraped pages useful without blowing model context or TPM limits."""
    if not text:
        return ""

    lines = []
    price_markers = ("€", "eur", "$", "price", "from", "starting", "per month", "toyota", "yaris", "flight", "hotel")
    for raw_line in str(text).splitlines():
        line = " ".join(raw_line.split())
        if not line:
            continue
        lower = line.lower()
        if any(marker in lower for marker in price_markers):
            lines.append(line)
        if sum(len(l) + 1 for l in lines) >= max_chars:
            break

    compact = "\n".join(lines) if lines else str(text)
    if len(compact) > max_chars:
        compact = compact[:max_chars] + "\n[truncated]"
    return compact

@tool
def scrape(url: str) -> str:
    """Scrape a URL and return compact price-relevant markdown content."""
    try:
        result = app.scrape_url(url, formats=["markdown"])
        return _compact_text(result.markdown)
    except Exception as e:
        return f"[scrape error for {url}]: {e} — skip this URL and try another."

@tool
def search(query: str) -> str:
    """Search the web and return a list of relevant URLs."""
    try:
        results: SearchData = app.search(query, limit=SEARCH_RESULT_LIMIT, timeout=10).web
        return "\n\n".join([r.url for r in results])
    except Exception as e:
        return f"[search error]: {e}"

WEB_TOOLS = [scrape,search]
