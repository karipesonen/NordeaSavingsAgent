from langgraph.graph import START, END, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import Command
from tools.database_tools import READING_TOOLS
from tools.web_search import WEB_TOOLS
from agents.main_agent import main_agent
from agents.personalanalyzer_agent import analyst_agent
from agents.web_searcher_agent import web_agent
from agents.aggregator_agent import aggregator_agent
from agents.bank_automation import (
    banking_agent, banking_confirm, banking_execute, banking_cancelled,
    BANKING_TOOLS,
)
from agents.investment_agent import investment_agent, INVESTMENT_TOOLS
from memory.short_term import State, short_term_memory_checkpointer, long_term_memory_store

ROUTING_WORDS = {"analyst", "web", "both", "banking", "investment"}


def _first_line(state: State) -> str:
    last = state["messages"][-1]
    raw = getattr(last, "content", "")
    text = raw if isinstance(raw, str) else ""
    return text.strip().splitlines()[0].strip().lower() if text.strip() else ""


def route_main(state: State):
    word = _first_line(state)
    if word == "both":
        destination = ["analyst", "web"]
    elif word == "analyst":
        destination = "analyst"
    elif word == "web":
        destination = "web"
    elif word == "banking":
        destination = "banking"
    elif word == "investment":
        destination = "investment"
    else:
        destination = END
    print(f"[router] main → {destination!r}  (first_line: {word!r})")
    return destination


def _last_has_tool_calls(msgs: list) -> bool:
    return bool(msgs and getattr(msgs[-1], "tool_calls", None))


def analyst_next(state: State):
    if _last_has_tool_calls(state.get("analyst_messages") or []):
        return "analyst_tools"
    return "aggregator" if state.get("parallel_mode") else END


def web_next(state: State):
    if _last_has_tool_calls(state.get("web_messages") or []):
        return "web_tools"
    return "aggregator" if state.get("parallel_mode") else END


def banking_next(state: State):
    msgs = state.get("banking_messages") or []
    if not msgs:
        return END
    last = msgs[-1]
    if not getattr(last, "tool_calls", None):
        return END
    # propose_action was called → go to confirmation
    for tc in last.tool_calls:
        if tc.get("name") == "propose_action":
            return "banking_confirm"
    # Regular read tool calls → run them
    return "banking_tools"


def investment_next(state: State):
    if _last_has_tool_calls(state.get("investment_messages") or []):
        return "investment_tools"
    return END


def after_confirm(state: State):
    return "banking_execute" if state.get("confirmed") else "banking_cancelled"


graph_builder = StateGraph(State)

# Existing nodes
graph_builder.add_node("main", main_agent)
graph_builder.add_node("analyst", analyst_agent)
graph_builder.add_node("analyst_tools", ToolNode(READING_TOOLS, messages_key="analyst_messages"))
graph_builder.add_node("web", web_agent)
graph_builder.add_node("web_tools", ToolNode(WEB_TOOLS, messages_key="web_messages"))
graph_builder.add_node("aggregator", aggregator_agent)

# Investment nodes
graph_builder.add_node("investment", investment_agent)
graph_builder.add_node("investment_tools", ToolNode(INVESTMENT_TOOLS, messages_key="investment_messages"))

# Banking nodes
graph_builder.add_node("banking", banking_agent)
graph_builder.add_node("banking_tools", ToolNode(BANKING_TOOLS, messages_key="banking_messages"))
graph_builder.add_node("banking_confirm", banking_confirm)
graph_builder.add_node("banking_execute", banking_execute)
graph_builder.add_node("banking_cancelled", banking_cancelled)

# Edges AAAAAAAAAA TOOOO MANNNNNNY
graph_builder.add_edge(START, "main")
graph_builder.add_conditional_edges("main", route_main)
graph_builder.add_conditional_edges("analyst", analyst_next)
graph_builder.add_edge("analyst_tools", "analyst")
graph_builder.add_conditional_edges("web", web_next)
graph_builder.add_edge("web_tools", "web")
graph_builder.add_edge("aggregator", END)
graph_builder.add_conditional_edges("investment", investment_next)
graph_builder.add_edge("investment_tools", "investment")
graph_builder.add_conditional_edges("banking", banking_next)
graph_builder.add_edge("banking_tools", "banking")
graph_builder.add_conditional_edges("banking_confirm", after_confirm)
graph_builder.add_edge("banking_execute", END)
graph_builder.add_edge("banking_cancelled", END)

graph = graph_builder.compile(
    checkpointer=short_term_memory_checkpointer,
    store=long_term_memory_store,
)

if __name__ == "__main__":

    config = {"configurable": {"thread_id": "1"}}

    while True:
        i = input("ASK: ")
        if i.lower() in ("quit", "exit"):
            break

        result = graph.invoke(
            {"messages": [{"role": "user", "content": i}]},
            config,
        )

        # Handle interrupt loop (banking confirmation)
        while True:
            snapshot = graph.get_state(config)
            if not snapshot.next:
                break
            interrupt_value = next(
                (intr.value
                 for task in snapshot.tasks
                 for intr in getattr(task, "interrupts", [])),
                None,
            )
            if interrupt_value is None:
                break
            print(f"\n{interrupt_value}")
            human_response = input("Your answer: ").strip()
            result = graph.invoke(Command(resume=human_response), config)

        # Print the last meaningful bot reply
        for msg in reversed(result["messages"]):
            content = getattr(msg, "content", "")
            text = content if isinstance(content, str) else ""
            if text.strip() and text.strip().lower() not in ROUTING_WORDS:
                print(f"Bot: {text}\n")
                break
