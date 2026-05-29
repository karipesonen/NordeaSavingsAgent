// nora-screens.jsx — Two surfaces:
//   1) ScreenWelcome — brief sign-in entry
//   2) ScreenChat    — the entire agentic experience. One conversation,
//                       Nora orchestrates sub-agents and renders cards inline.

const {
  NIcon, PhoneFrame, NoraAvatar, AgentTag, ChatBubble, TypingBubble,
  ChipRow, Composer, MoneyDisplay, InChatCard, PrimaryButton,
  euroN, wait, NORA_BLUE,
} = window;

// Tab + preview components are looked up lazily from window at render time
// to avoid Babel-standalone script-execution-order surprises.
function w(name) {
  const C = window[name];
  if (!C) {
    return () => (
      <div style={{ padding: 20, color: '#b3261e', fontSize: 13, lineHeight: 1.5 }}>
        Component <code>{name}</code> not loaded. Check that <code>nora-tabs.jsx</code> is included before <code>nora-screens.jsx</code> in index.html.
      </div>
    );
  }
  return C;
}

// ── API helper ─────────────────────────────────────────────────────────────
async function callNora({ messages, memory, sessionState, demoMode, profileId }) {
  const res = await fetch('/api/nora/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, memory, sessionState, demoMode, profileId }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

async function callFirstReply({ demoMode, profileId, firstReplyMode }) {
  const res = await fetch('/api/nora/first-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ demoMode, profileId, firstReplyMode }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

function hardcodedFirstReply(profile) {
  const firstName = profile?.firstName || 'Emma';
  return `Hey ${firstName} — I'm Nora, your savings copilot. No forms, no jargon. What's on your mind today, or what are you trying to save toward?`;
}

function monthlyRoomFromExpenseReview(review) {
  const data = review?.data || {};
  if (Number.isFinite(Number(data.monthlyRoom))) return Number(data.monthlyRoom);
  return Math.round(Number(data.weeklyRoom || 0) * 4.33);
}

function startingChips(profile, demoMode) {
  if (demoMode === 'test_profile' && profile?.savingsGoal) {
    return [profile.savingsGoal, 'Show my spending', 'Explain investing simply', "I'm just exploring"];
  }
  return ['First apartment', 'A trip somewhere', 'Build an emergency fund', "I'm just exploring"];
}

// Friendly labels for the orchestrator's agent ids
const AGENT_LABELS = {
  goal_plan:       'Goal Planner',
  expense_review:  'Expense Review',
  risk_lesson:     'Education · Risk',
  action_approval: 'Action · Approval',
  trip_research:   'Trip Research',
};

// ────────────────────────────────────────────────────────────────
// SCREEN 1 — Welcome / Sign-in
// ────────────────────────────────────────────────────────────────
function ScreenWelcome({ next, profile }) {
  const firstName = profile?.firstName || 'Emma';
  return (
    <PhoneFrame statusDark>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: `linear-gradient(155deg, #00007a 0%, ${NORA_BLUE} 55%, #1a1ab0 100%)`,
        color: '#fff', padding: '60px 28px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)', filter: 'blur(20px)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,74,216,0.4) 0%, transparent 70%)', filter: 'blur(30px)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'auto', position: 'relative', zIndex: 1 }}>
          <img src="assets/nordea-logo-white.png" alt="Nordea" style={{ height: 22 }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.7, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Welcome back
          </div>
          <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{firstName}</div>
          <div style={{ fontSize: 16, opacity: 0.85, marginTop: 16, lineHeight: 1.5, maxWidth: 280 }}>
            Your savings copilot has a quick suggestion for you today.
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={next} style={{
            background: '#fff', color: NORA_BLUE, border: 0, borderRadius: 12,
            padding: '16px 20px', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}>
            <NIcon name="scan-face" size={20} color={NORA_BLUE} />
            Continue with Face ID
          </button>
          <button onClick={next} style={{
            background: 'transparent', color: '#fff',
            border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 12,
            padding: '14px 20px', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Use PIN instead
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, opacity: 0.65, marginTop: 6 }}>
            <NIcon name="shield-check" size={14} color="#fff" />
            <span>Protected by Nordea ID</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ────────────────────────────────────────────────────────────────
// SCREEN 2 — The whole agentic experience
// ────────────────────────────────────────────────────────────────
function ScreenChat({ prev, tweaks, profile }) {
  const demoMode = tweaks.demoMode || 'scripted_emma';
  const profileId = demoMode === 'test_profile' ? tweaks.profileId : null;
  const firstReplyMode = tweaks.firstReplyMode || 'hardcoded';
  const [messages, setMessages] = React.useState(() => (
    firstReplyMode === 'agent_generated'
      ? []
      : [{ from: 'nora', text: hardcodedFirstReply(profile) }]
  ));
  const [suggestedReplies, setSuggestedReplies] = React.useState(() => (
    firstReplyMode === 'agent_generated' ? [] : startingChips(profile, demoMode)
  ));
  const [memory, setMemory] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(null);
  const [invokedHistory, setInvokedHistory] = React.useState([]);

  // Tab / drawer state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('chat');

  // Collections — populated as Nora invokes sub-agents
  const [goals, setGoals]                 = React.useState([]);
  const [lessons, setLessons]             = React.useState([]);
  const [expenseReviews, setExpenseReviews] = React.useState([]);
  // Resource ids Nora has suggested via resource_link cards (for Learn "For you")
  const [suggestedResourceIds, setSuggestedResourceIds] = React.useState([]);
  // Generated resources Nora drafted on the spot (not in the curated catalog).
  // Stored as full objects since the server doesn't have a catalog entry for them.
  const [generatedResources, setGeneratedResources] = React.useState([]);
  // When user taps "Open in Learn" on a resource preview, store the id so
  // LearnTab can auto-open the detail screen for that resource.
  const [focusedResourceId, setFocusedResourceId] = React.useState(null);

  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (firstReplyMode !== 'agent_generated') return;
    let cancelled = false;
    setTyping(true);
    callFirstReply({ demoMode, profileId, firstReplyMode })
      .then(result => {
        if (cancelled) return;
        setMessages([{ from: 'nora', text: result.message || hardcodedFirstReply(profile) }]);
        setSuggestedReplies(result.suggestedReplies || startingChips(profile, demoMode));
      })
      .catch(err => {
        console.error(err);
        if (cancelled) return;
        setMessages([{ from: 'nora', text: hardcodedFirstReply(profile) }]);
        setSuggestedReplies(startingChips(profile, demoMode));
      })
      .finally(() => {
        if (!cancelled) setTyping(false);
      });
    return () => { cancelled = true; };
  }, [demoMode, profileId, firstReplyMode]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const send = async (userText) => {
    // userText may be: a string (chip click), an event (button click), or undefined (Enter)
    const text = (typeof userText === 'string' ? userText : input).trim();
    if (!text || typing) return;
    setInput('');
    setSuggestedReplies([]);

    const newMsgs = [...messages, { from: 'user', text }];
    setMessages(newMsgs);
    setTyping(true);

    try {
      // Build chat history. For Nora's turns, annotate which cards she rendered
      // so the orchestrator can see what's already been shown.
      const apiMessages = newMsgs.map(m => {
        if (m.from === 'nora' && m.cards?.length) {
          const tags = m.cards.map(c => `[rendered ${c.type} card]`).join(' ');
          return { role: 'assistant', content: `${m.text} ${tags}`.trim() };
        }
        return { role: m.from === 'nora' ? 'assistant' : 'user', content: m.text };
      });

      const sessionState = {
        confirmed: !!confirmed,
        invokedSoFar: Array.from(new Set(invokedHistory.flatMap(h => h.agents))),
        lastExpenseReview: expenseReviews.length
          ? { monthlyRoom: monthlyRoomFromExpenseReview(expenseReviews.at(-1)) }
          : null,
      };

      const result = await callNora({ messages: apiMessages, memory, sessionState, demoMode, profileId });

      // Stamp each incoming card with whether the goal is being seen for the first time.
      // Used by chat rendering to choose full card vs compact reference.
      const knownGoalLabels = new Set(goals.map(g => g.data.label));
      const stampedCards = (result.cards || []).map(card => {
        if (card.type === 'goal_plan') {
          const firstTime = !knownGoalLabels.has(card.data.label);
          return { ...card, firstTime };
        }
        return card;
      });

      setMessages(m => [...m, {
        from: 'nora',
        text: result.message,
        cards: stampedCards,
        invokedAgents: tweaks.showAgentTags ? (result.invokedAgents || []) : [],
      }]);
      setSuggestedReplies(result.suggestedReplies || []);
      if (result.memoryUpdates?.length) {
        setMemory(prev => [...prev, ...result.memoryUpdates].slice(-12));
      }
      if (result.invokedAgents?.length) {
        setInvokedHistory(h => [...h, { turn: h.length, agents: result.invokedAgents }]);
      }

      // Append cards to their tab collections
      const now = Date.now();
      for (const card of stampedCards) {
        const entry = { id: `${card.type}-${now}-${Math.random().toString(36).slice(2, 6)}`, createdAt: now, data: card.data };
        if (card.type === 'goal_plan' && card.firstTime) {
          setGoals(g => [...g, entry]);
        } else if (card.type === 'risk_lesson') {
          setLessons(l => [...l, entry]);
        } else if (card.type === 'expense_review') {
          setExpenseReviews(r => [...r, entry]);
        } else if (card.type === 'resource_link') {
          const r = card.data?.resource;
          if (r?.id) {
            setSuggestedResourceIds(ids => ids.includes(r.id) ? ids : [...ids, r.id]);
            // If this is a drafted-by-Nora explainer, keep the full record so
            // LearnTab can render it alongside curated entries.
            if (r.generated) {
              setGeneratedResources(g => g.some(x => x.id === r.id) ? g : [...g, r]);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(m => [...m, {
        from: 'nora',
        text: `Something went wrong reaching the model — ${err.message}. Check Aalto VPN + API key.`,
      }]);
    } finally {
      setTyping(false);
    }
  };

  const onConfirmAction = (cardData) => {
    setConfirmed(cardData);
    send('Confirm — start saving.');
  };

  // Open a tab from inside the chat (clicking a preview card)
  const openTab = (tab) => {
    setActiveTab(tab);
    setDrawerOpen(false);
  };

  // Open a specific resource in the Learn tab (taps from chat resource_link chip)
  const openResource = (resourceId) => {
    setFocusedResourceId(resourceId);
    setActiveTab('learn');
    setDrawerOpen(false);
  };

  // From a tab's empty state, send an opening prompt to Nora and return to chat
  const askNora = (text) => {
    setActiveTab('chat');
    if (typeof text === 'string') {
      setTimeout(() => send(text), 60);
    }
  };

  const counts = {
    goals: goals.length,
    lessons: lessons.length,
    spending: expenseReviews.length,
    memory: memory.length,
  };

  return (
    <PhoneFrame>
      {activeTab === 'chat' ? (
        <>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px 12px 8px',
            borderBottom: '1px solid var(--border-1)',
            background: '#fff', flexShrink: 0,
          }}>
            <button onClick={() => setDrawerOpen(true)} style={{
              width: 40, height: 40, border: 0, background: 'transparent',
              borderRadius: 999, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <NIcon name="menu" size={22} color="var(--fg-1)" />
            </button>
            <NoraAvatar size={32} pulsing={typing} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg-1)' }}>Nora</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 500 }}>
                {typing ? 'thinking…' : 'Nordea Savings copilot'}
              </div>
            </div>
            <button onClick={prev} title="Sign out" style={{
              width: 40, height: 40, border: 0, background: 'transparent',
              borderRadius: 999, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <NIcon name="log-out" size={18} color="var(--fg-2)" />
            </button>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="scroll-y" style={{
            flex: 1, padding: '16px 14px 12px',
            display: 'flex', flexDirection: 'column', gap: 12,
            background: 'var(--bg-page)',
          }}>
            {messages.map((m, i) => (
              <Turn key={i} turn={m} density={tweaks.density} vibe={tweaks.vibe}
                    onConfirmAction={onConfirmAction} confirmed={confirmed}
                    onOpenTab={openTab} onOpenResource={openResource} />
            ))}
            {typing && <TypingBubble />}
            {!typing && suggestedReplies.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <ChipRow chips={suggestedReplies} onPick={send} />
              </div>
            )}
          </div>

          {/* Composer */}
          <Composer
            value={input} onChange={setInput} onSend={send}
            disabled={typing}
            placeholder="Tell Nora anything…"
          />
        </>
      ) : (() => {
        const TabComp = {
          goals:    w('GoalsTab'),
          learn:    w('LearnTab'),
          spending: w('SpendingTab'),
          memory:   w('MemoryTab'),
        }[activeTab];
        if (!TabComp) return null;
        const tabProps = {
          onMenu: () => setDrawerOpen(true),
          onAskNora: askNora,
        };
        if (activeTab === 'goals')    return <TabComp {...tabProps} goals={goals} />;
        if (activeTab === 'learn')    return <TabComp {...tabProps}
                                                    lessons={lessons}
                                                    suggestedResourceIds={suggestedResourceIds}
                                                    generatedResources={generatedResources}
                                                    focusedResourceId={focusedResourceId}
                                                    onClearFocus={() => setFocusedResourceId(null)} />;
        if (activeTab === 'spending') return <TabComp {...tabProps} reviews={expenseReviews} />;
        if (activeTab === 'memory')   return <TabComp {...tabProps} memory={memory} />;
        return null;
      })()}

      {/* Drawer overlay */}
      {(() => {
        const DrawerComp = w('Drawer');
        return <DrawerComp
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeTab={activeTab}
          onPick={openTab}
          profile={profile}
          counts={counts}
        />;
      })()}
    </PhoneFrame>
  );
}

// ── Render a single turn (text bubble + any cards Nora returned) ───────────
function Turn({ turn, density, vibe, onConfirmAction, confirmed, onOpenTab, onOpenResource }) {
  const agentTags = (turn.invokedAgents || []).map(name => ({
    name: AGENT_LABELS[name] || name,
    state: 'done',
  }));

  return (
    <>
      {turn.text && (
        <ChatBubble from={turn.from} agentTags={agentTags} density={density}>
          {turn.text}
        </ChatBubble>
      )}
      {(turn.cards || []).map((card, i) => (
        <Card key={i} card={card} vibe={vibe}
              onConfirmAction={onConfirmAction} confirmed={confirmed}
              onOpenTab={onOpenTab} onOpenResource={onOpenResource} />
      ))}
    </>
  );
}

// ── Dispatch card.type → component (chat rendering) ────────────────────────
// goal_plan      — full card if first time, else compact ref (→ Goals tab)
// risk_lesson    — always compact preview (→ Learn tab)
// expense_review — always compact preview (→ Spending tab)
// action_approval — full card in chat (decision moment)
function Card({ card, vibe, onConfirmAction, confirmed, onOpenTab, onOpenResource }) {
  if (!card?.data) return null;
  switch (card.type) {
    case 'goal_plan': {
      if (card.firstTime) return <GoalPlanCard data={card.data} vibe={vibe} />;
      const Compact = w('CompactGoalRef');
      return <Compact data={card.data} onOpen={() => onOpenTab('goals')} />;
    }
    case 'expense_review': {
      const Preview = w('ExpensePreviewChip');
      return <Preview data={card.data} onOpen={() => onOpenTab('spending')} />;
    }
    case 'risk_lesson': {
      const Preview = w('LessonPreviewChip');
      return <Preview data={card.data} onOpen={() => onOpenTab('learn')} />;
    }
    case 'resource_link': {
      // Nora picked a curated catalog item — chip in chat, opens detail in Learn
      const Chip = w('ResourceLinkChip');
      const rid = card.data?.resource?.id;
      return <Chip data={card.data} onOpen={() => rid ? onOpenResource(rid) : onOpenTab('learn')} />;
    }
    case 'trip_research':
      return <TripResearchCard data={card.data} vibe={vibe} />;
    case 'action_approval':
      return <ActionApprovalCard data={card.data} vibe={vibe}
                                 onConfirm={onConfirmAction} confirmed={confirmed} />;
    default: return null;
  }
}

// ── Card: Goal Plan ────────────────────────────────────────────────────────
function GoalPlanCard({ data, vibe }) {
  const target  = data.targetAmount || 0;
  const months  = data.monthsToGo || 0;
  const weekly  = data.weeklyTransfer || 0;
  return (
    <InChatCard eyebrow={`Goal · ${data.label || 'Your goal'}`} vibe={vibe}>
      <div style={{ background: `linear-gradient(135deg, #00007a 0%, ${NORA_BLUE} 100%)`, color: '#fff', padding: '20px 20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NIcon name={data.icon || 'piggy-bank'} size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Target</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {data.label} · by {data.deadline}
            </div>
          </div>
        </div>
        <MoneyDisplay value={target} size={44} color="#fff" />
        <div style={{ height: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 999, marginTop: 16, overflow: 'hidden' }}>
          <div style={{ width: '0%', height: '100%', background: '#fff' }} />
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.85, fontWeight: 500 }}>
          <span>€0 saved · 0%</span>
          <span>{months} months to go</span>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {[
          { label: 'Auto-transfer',  value: `€${weekly} / week`,       sub: 'every Monday',          icon: 'repeat' },
          { label: 'Plus round-ups', value: '~€15 / week',             sub: 'spare change to this goal', icon: 'sparkles' },
          { label: 'Where it lives', value: data.mix || '—',           sub: 'low-volatility mix',    icon: 'layers' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--border-1)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <NIcon name={row.icon} size={16} color={NORA_BLUE} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{row.label}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>{row.sub}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums lining-nums' }}>{row.value}</div>
          </div>
        ))}
      </div>
    </InChatCard>
  );
}

// (ExpenseReview + RiskLesson full cards live in nora-tabs.jsx now — chat shows previews.)

// ── Card: Trip Research ───────────────────────────────────────────────────
function tripCategoryIcon(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('flight'))  return 'plane';
  if (c.includes('accommod') || c.includes('hotel') || c.includes('lodging')) return 'bed-double';
  if (c.includes('daily'))   return 'wallet';
  if (c.includes('food'))    return 'utensils';
  if (c.includes('transport') || c.includes('local')) return 'train';
  if (c.includes('activit') || c.includes('sightseeing')) return 'compass';
  return 'receipt';
}

function sourceHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function TripResearchCard({ data, vibe }) {
  if (!data) return null;

  if (data.error) {
    return (
      <InChatCard eyebrow="Trip research" vibe={vibe}>
        <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <NIcon name="alert-circle" size={16} color="var(--fg-3)" />
            <span style={{ fontWeight: 600, color: 'var(--fg-1)' }}>Could not complete research</span>
          </div>
          {data.error}
        </div>
      </InChatCard>
    );
  }

  const { destination = '', duration_days = 0, travelers = 1, total_eur = 0, breakdown = [], sources = [], summary = '' } = data;

  return (
    <InChatCard eyebrow={`Trip · ${destination}`} vibe={vibe}>
      {/* Header with total cost */}
      <div style={{
        background: `linear-gradient(135deg, #00007a 0%, ${NORA_BLUE} 100%)`,
        color: '#fff', padding: '20px 20px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NIcon name="plane" size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Estimated cost
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {destination} · {duration_days} days{travelers > 1 ? ` · ${travelers} people` : ''}
            </div>
          </div>
        </div>
        <MoneyDisplay value={total_eur} size={44} color="#fff" />
        {summary && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>{summary}</div>
        )}
      </div>

      {/* Cost breakdown */}
      {breakdown.length > 0 && (
        <div style={{ padding: '16px 20px' }}>
          {breakdown.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0',
              borderBottom: i < breakdown.length - 1 ? '1px solid var(--border-1)' : 'none',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <NIcon name={tripCategoryIcon(item.category)} size={16} color={NORA_BLUE} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{item.category}</div>
                {item.note && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>{item.note}</div>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums lining-nums' }}>
                {euroN(item.amount_eur)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Source chips */}
      {sources.length > 0 && (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {sources.slice(0, 4).map((s, i) => (
            <span key={i} style={{
              fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-page)',
              padding: '3px 8px', borderRadius: 6, fontWeight: 500,
            }}>
              {s.title || sourceHostname(s.url)}
            </span>
          ))}
        </div>
      )}
    </InChatCard>
  );
}

// ── Card: Action Approval ──────────────────────────────────────────────────
function ActionApprovalCard({ data, vibe, onConfirm, confirmed }) {
  const isThisConfirmed = confirmed && confirmed.targetSummary === data.targetSummary;

  if (isThisConfirmed) {
    return (
      <InChatCard eyebrow="Confirmed · all set" vibe={vibe}>
        <div style={{ padding: '20px', background: `linear-gradient(135deg, ${NORA_BLUE} 0%, #00007a 100%)`, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <NIcon name="check" size={22} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{data.goalLabel}</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{data.targetSummary}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
            First transfer goes out Monday. I'll check in on Sunday.
          </div>
        </div>
      </InChatCard>
    );
  }

  return (
    <InChatCard eyebrow="Action confirmation" vibe={vibe}>
      <div style={{ padding: '16px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border-1)', marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NIcon name={data.goalIcon || 'piggy-bank'} size={22} color={NORA_BLUE} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{data.goalLabel}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{data.targetSummary}</div>
          </div>
        </div>

        {(data.actions || []).map((row, i, arr) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <NIcon name={row.icon} size={15} color={NORA_BLUE} />
            </div>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--fg-2)', fontWeight: 500 }}>{row.label}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 600 }}>{row.value}</div>
          </div>
        ))}

        {data.reassurance && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 8, fontSize: 12, color: NORA_BLUE, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <NIcon name="shield-check" size={14} color={NORA_BLUE} strokeWidth={2} style={{ marginTop: 1 }} />
            <span>{data.reassurance}</span>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <PrimaryButton onClick={() => onConfirm(data)} leadingIcon="shield-check">
            Confirm and start saving
          </PrimaryButton>
        </div>
      </div>
    </InChatCard>
  );
}

Object.assign(window, { ScreenWelcome, ScreenChat, Turn, Card, AGENT_LABELS });
