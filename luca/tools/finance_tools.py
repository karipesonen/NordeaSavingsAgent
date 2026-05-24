import yfinance as yf
from langchain.tools import tool

@tool
def get_stock_price(ticker: str) -> dict:
    """Get current stock price and basic info for a ticker symbol."""
    stock = yf.Ticker(ticker)
    info = stock.info
    return {
        "price": info.get("currentPrice"),
        "currency": info.get("currency"),
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
        "52w_high": info.get("fiftyTwoWeekHigh"),
        "52w_low": info.get("fiftyTwoWeekLow"),
    }

@tool
def get_price_history(ticker: str, period: str = "1mo") -> str:
    """Get historical price data. Period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max."""
    stock = yf.Ticker(ticker)
    hist = stock.history(period=period)
    return hist[["Open", "High", "Low", "Close", "Volume"]].to_string()

@tool
def get_financials(ticker: str) -> str:
    """Get income statement, balance sheet and cash flow for a ticker."""
    stock = yf.Ticker(ticker)
    return {
        "income_statement": stock.financials.to_string(),
        "balance_sheet": stock.balance_sheet.to_string(),
        "cash_flow": stock.cashflow.to_string(),
    }

@tool
def get_crypto_price(symbol: str) -> dict:
    """Get current price and market data for a cryptocurrency.
    Use the coin symbol only, e.g. 'BTC', 'ETH', 'SOL'.
    The tool appends '-USD' automatically."""
    ticker = f"{symbol.upper()}-USD"
    info = yf.Ticker(ticker).info
    return {
        "symbol": symbol.upper(),
        "ticker": ticker,
        "price_usd": info.get("regularMarketPrice") or info.get("currentPrice"),
        "previous_close": info.get("regularMarketPreviousClose"),
        "day_high": info.get("dayHigh"),
        "day_low": info.get("dayLow"),
        "market_cap_usd": info.get("marketCap"),
        "volume_24h": info.get("volume24Hr") or info.get("regularMarketVolume"),
        "circulating_supply": info.get("circulatingSupply"),
        "52w_high": info.get("fiftyTwoWeekHigh"),
        "52w_low": info.get("fiftyTwoWeekLow"),
    }

FINANCE_TOOLS = [get_stock_price, get_price_history, get_financials, get_crypto_price]
