
import sqlite3
from typing import Annotated
from typing_extensions import TypedDict, NotRequired
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.store.memory import InMemoryStore
from db_tools import get_profile

namespace = ("Sofia", "Profile")

# Single source of truth for routing/filler words that all agents should filter out
ROUTING_WORDS = {"analyst", "web", "both", "banking", "investment"}


class State(TypedDict):
    messages: Annotated[list, add_messages]
    parallel_mode: NotRequired[bool]
    analyst_messages: NotRequired[Annotated[list, add_messages]]
    web_messages: NotRequired[Annotated[list, add_messages]]
    banking_messages: NotRequired[Annotated[list, add_messages]]
    investment_messages: NotRequired[Annotated[list, add_messages]]

    analyst_turn_start: NotRequired[int]
    web_turn_start: NotRequired[int]
    banking_turn_start: NotRequired[int]
    investment_turn_start: NotRequired[int]

    pending_action: NotRequired[dict]
    confirmed: NotRequired[bool]


_conn = sqlite3.connect("luca_checkpoints.db", check_same_thread=False)
short_term_memory_checkpointer = SqliteSaver(_conn)

long_term_memory_store = InMemoryStore()
long_term_memory_store.put(namespace, key="info", value=get_profile())
