import os
from dotenv import load_dotenv
from langchain.tools import tool
from firecrawl import FirecrawlApp
from firecrawl.v2.client import SearchData

load_dotenv()
app = FirecrawlApp(api_key=os.environ["FIRECRAWL_API_KEY"])

@tool
def scrape(url: str) -> str:
    """Scrape a URL and return clean markdown content."""
    try:
        result = app.scrape_url(url, formats=["markdown"])
        return result.markdown
    except Exception as e:
        return f"[scrape error for {url}]: {e} — skip this URL and try another."

@tool
def search(query: str) -> str:
    """Search the web and return a list of relevant URLs."""
    try:
        results: SearchData = app.search(query, limit=5, timeout=10).web
        # print(results)
        return "\n\n".join([r.url for r in results])
    except Exception as e:
        return f"[search error]: {e}"

WEB_TOOLS = [scrape,search]