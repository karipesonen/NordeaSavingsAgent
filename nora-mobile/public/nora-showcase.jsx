// nora-showcase.jsx — Showcase playback mode.
// Plays pre-generated conversations from showcase-transcript.json,
// cycling between profiles in a continuous loop. No API calls.

const {
  NIcon, PhoneFrame, NoraAvatar, ChatBubble, TypingBubble,
  ChipRow, Composer, InChatCard, PrimaryButton,
  MoneyDisplay, euroN, NORA_BLUE,
  Turn, Card, AGENT_LABELS,
} = window;

// ── Timing constants (ms) ─────────────────────────────────────────────────
const T = {
  TYPING_BASE:       1200,
  TYPING_PER_CHAR:   12,
  TYPING_CAP:        4000,
  PAUSE_AFTER_USER:  800,
  PAUSE_AFTER_NORA:  2500,
  CHIP_HIGHLIGHT:    1000,
  CHIP_CLICK:        500,
  CARD_SETTLE:       1500,
  TRANSITION_FADE:   400,
  TRANSITION_HOLD:   4000,
  END_PAUSE:         8000,
  FIRST_REPLY_DELAY: 1500,
  PROFILE_INTRO:     4500,
  RESUME_DELAY:      400,
  SCROLL_THRESHOLD:  50,
};

function typingDuration(text) {
  const base = T.TYPING_BASE + (text || '').length * T.TYPING_PER_CHAR;
  return Math.min(base, T.TYPING_CAP);
}

// ── Playback states ───────────────────────────────────────────────────────
const PS = {
  LOADING:        'loading',
  PROFILE_INTRO:  'profile_intro',
  FIRST_REPLY:    'first_reply',
  WAITING:        'waiting',
  CHIP_HIGHLIGHT: 'chip_highlight',
  USER_MESSAGE:   'user_message',
  TYPING:         'typing',
  NORA_MESSAGE:   'nora_message',
  CONV_END:       'conv_end',
  TRANSITION:     'transition',
};

// ── ScreenShowcase ────────────────────────────────────────────────────────
function ScreenShowcase({ tweaks }) {
  // Transcript data
  const [transcript, setTranscript] = React.useState(null);
  const [convIndex, setConvIndex]   = React.useState(0);
  const [turnIndex, setTurnIndex]   = React.useState(0);
  const [playState, setPlayState]   = React.useState(PS.LOADING);

  // Rendered conversation state (mirrors ScreenChat)
  const [messages, setMessages]             = React.useState([]);
  const [suggestedReplies, setSuggestedReplies] = React.useState([]);
  const [typing, setTyping]                 = React.useState(false);
  const [highlightedChip, setHighlightedChip] = React.useState(null);
  const [confirmed, setConfirmed]           = React.useState(null);
  const [memory, setMemory]                 = React.useState([]);

  // Tab collections
  const [goals, setGoals]                       = React.useState([]);
  const [lessons, setLessons]                   = React.useState([]);
  const [expenseReviews, setExpenseReviews]     = React.useState([]);
  const [suggestedResourceIds, setSuggestedResourceIds] = React.useState([]);
  const [generatedResources, setGeneratedResources]     = React.useState([]);

  // Transition overlay
  const [transitioning, setTransitioning] = React.useState(false);
  const [transitionProfile, setTransitionProfile] = React.useState(null);

  // Drawer + tab
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab]   = React.useState('chat');

  // Focused resource id — when user taps a resource_link chip, open its detail in Learn
  const [focusedResourceId, setFocusedResourceId] = React.useState(null);

  // Pause playback when user scrolls up
  const [paused, setPaused] = React.useState(false);

  const scrollRef    = React.useRef(null);
  const timerRef     = React.useRef(null);
  const processedRef = React.useRef(null);  // tracks which state+turn was already handled
  const wasPausedRef = React.useRef(false); // true on the first tick after unpausing

  // ── Load transcript ─────────────────────────────────────────────────
  React.useEffect(() => {
    fetch('/data/showcase-transcript.json')
      .then(r => r.json())
      .then(data => {
        setTranscript(data);
        setPlayState(PS.PROFILE_INTRO);
      })
      .catch(err => console.error('Failed to load showcase transcript:', err));
  }, []);

  // ── Scroll-to-pause detection ───────────────────────────────────────
  // Re-run when transcript loads (scrollRef div only exists after load)
  // and when activeTab changes (scroll div unmounts/remounts on tab switch)
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < T.SCROLL_THRESHOLD;
      setPaused(prev => {
        if (atBottom && prev) { wasPausedRef.current = true; return false; }  // resume
        if (!atBottom && !prev) return true;  // pause
        return prev;
      });
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [transcript, activeTab]);

  // ── Unpause when returning to chat tab ──────────────────────────────
  // The scroll div re-mounts at the bottom, so resume playback
  React.useEffect(() => {
    if (activeTab === 'chat') {
      wasPausedRef.current = true;
      setPaused(false);
    }
  }, [activeTab]);

  // ── Auto-scroll (only when not paused) ──────────────────────────────
  React.useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, paused]);

  // ── Reset state between conversations ───────────────────────────────
  function resetConversationState() {
    setMessages([]);
    setSuggestedReplies([]);
    setTyping(false);
    setHighlightedChip(null);
    setConfirmed(null);
    setMemory([]);
    setGoals([]);
    setLessons([]);
    setExpenseReviews([]);
    setSuggestedResourceIds([]);
    setGeneratedResources([]);
  }

  // ── Append cards to tab collections (same logic as ScreenChat) ──────
  function appendToCollections(cards) {
    const now = Date.now();
    for (const card of cards) {
      const entry = {
        id: `${card.type}-${now}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        data: card.data,
      };
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
          if (r.generated) {
            setGeneratedResources(g => g.some(x => x.id === r.id) ? g : [...g, r]);
          }
        }
      }
    }
  }

  // ── Helper: current conversation & turn ─────────────────────────────
  const conv = transcript?.conversations?.[convIndex];
  const turn = conv?.turns?.[turnIndex];
  const profile = conv?.profile || { firstName: '...' };

  // ── Main playback state machine ─────────────────────────────────────
  React.useEffect(() => {
    if (!transcript || !conv) return;

    clearTimeout(timerRef.current);

    // When paused (user scrolled up), freeze playback
    if (paused) return;

    // If we just resumed from pause, use a short delay instead of the
    // full timer so the next beat feels snappy after the user scrolled down.
    const resuming = wasPausedRef.current;
    if (resuming) wasPausedRef.current = false;
    const d = (normal) => resuming ? T.RESUME_DELAY : normal;

    // Track which state+turn combo was already processed to avoid
    // re-running side effects (e.g. appending messages) on re-renders
    const stateKey = `${playState}:${turnIndex}:${convIndex}`;
    const isNew = processedRef.current !== stateKey;
    if (isNew) processedRef.current = stateKey;

    switch (playState) {
      case PS.PROFILE_INTRO: {
        if (isNew) {
          resetConversationState();
          setTransitioning(true);
          setTransitionProfile(conv.profile);
        }
        timerRef.current = setTimeout(() => {
          setTransitioning(false);
          setPlayState(PS.FIRST_REPLY);
        }, T.PROFILE_INTRO);
        break;
      }

      case PS.FIRST_REPLY: {
        if (isNew) setTyping(true);
        timerRef.current = setTimeout(() => {
          setTyping(false);
          setMessages([{
            from: 'nora',
            text: conv.firstReply.text,
            cards: [],
            invokedAgents: [],
          }]);
          setSuggestedReplies(conv.firstReply.suggestedReplies || []);
          setTurnIndex(0);
          setPlayState(PS.WAITING);
        }, typingDuration(conv.firstReply.text));
        break;
      }

      case PS.WAITING: {
        if (!turn) {
          // No more turns — conversation done
          timerRef.current = setTimeout(() => {
            setPlayState(PS.CONV_END);
          }, d(T.PAUSE_AFTER_NORA));
          break;
        }

        if (turn.from === 'user') {
          if (turn.pickedChip) {
            timerRef.current = setTimeout(() => {
              setPlayState(PS.CHIP_HIGHLIGHT);
            }, d(T.PAUSE_AFTER_NORA));
          } else {
            timerRef.current = setTimeout(() => {
              setPlayState(PS.USER_MESSAGE);
            }, d(T.PAUSE_AFTER_NORA));
          }
        } else {
          // nora turn
          timerRef.current = setTimeout(() => {
            setPlayState(PS.TYPING);
          }, d(T.PAUSE_AFTER_USER));
        }
        break;
      }

      case PS.CHIP_HIGHLIGHT: {
        if (isNew) setHighlightedChip(turn.pickedChip);
        timerRef.current = setTimeout(() => {
          setHighlightedChip(null);
          setPlayState(PS.USER_MESSAGE);
        }, d(T.CHIP_HIGHLIGHT));
        break;
      }

      case PS.USER_MESSAGE: {
        if (isNew) {
          setSuggestedReplies([]);
          setMessages(m => [...m, { from: 'user', text: turn.text }]);

          // Handle confirm action
          if (turn.isConfirm) {
            const approvalMsg = [...messages].reverse().find(
              m => m.cards?.some(c => c.type === 'action_approval')
            );
            const approvalCard = approvalMsg?.cards?.find(c => c.type === 'action_approval');
            if (approvalCard) setConfirmed(approvalCard.data);
          }
        }

        timerRef.current = setTimeout(() => {
          setTurnIndex(i => i + 1);
          setPlayState(PS.WAITING);
        }, d(T.CHIP_CLICK));
        break;
      }

      case PS.TYPING: {
        if (isNew) setTyping(true);
        const hasCards = turn.cards?.length > 0;
        const duration = typingDuration(turn.text) + (hasCards ? T.CARD_SETTLE : 0);
        timerRef.current = setTimeout(() => {
          setPlayState(PS.NORA_MESSAGE);
        }, duration);
        break;
      }

      case PS.NORA_MESSAGE: {
        const cards = (turn.cards || []).map(card => {
          if (card.type === 'goal_plan') {
            return { ...card, firstTime: card.firstTime !== false };
          }
          return card;
        });

        if (isNew) {
          setTyping(false);
          setMessages(m => [...m, {
            from: 'nora',
            text: turn.text,
            cards,
            invokedAgents: tweaks.showAgentTags ? (turn.invokedAgents || []) : [],
          }]);
          setSuggestedReplies(turn.suggestedReplies || []);

          if (turn.memoryUpdates?.length) {
            setMemory(prev => [...prev, ...turn.memoryUpdates].slice(-12));
          }

          appendToCollections(cards);
        }

        const delay = d(T.PAUSE_AFTER_NORA) + (cards.length ? T.CARD_SETTLE : 0);
        timerRef.current = setTimeout(() => {
          setTurnIndex(i => i + 1);
          setPlayState(PS.WAITING);
        }, delay);
        break;
      }

      case PS.CONV_END: {
        timerRef.current = setTimeout(() => {
          setPlayState(PS.TRANSITION);
        }, d(T.END_PAUSE));
        break;
      }

      case PS.TRANSITION: {
        const nextIndex = (convIndex + 1) % transcript.conversations.length;
        setConvIndex(nextIndex);
        setTurnIndex(0);
        setPlayState(PS.PROFILE_INTRO);
        break;
      }
    }

    return () => clearTimeout(timerRef.current);
  }, [playState, turnIndex, convIndex, transcript, paused]);

  // ── Render ──────────────────────────────────────────────────────────
  if (!transcript) {
    return (
      <PhoneFrame>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fg-3)', fontSize: 14,
        }}>
          Loading showcase...
        </div>
      </PhoneFrame>
    );
  }

  // Tab views
  if (activeTab !== 'chat') {
    const TabComp = {
      goals:    window.GoalsTab,
      learn:    window.LearnTab,
      spending: window.SpendingTab,
      memory:   window.MemoryTab,
    }[activeTab];

    if (TabComp) {
      const tabProps = {
        onMenu: () => setDrawerOpen(true),
        onAskNora: () => setActiveTab('chat'),
      };
      let tabContent = null;
      if (activeTab === 'goals')    tabContent = <TabComp {...tabProps} goals={goals} />;
      if (activeTab === 'learn')    tabContent = <TabComp {...tabProps} lessons={lessons} suggestedResourceIds={suggestedResourceIds} generatedResources={generatedResources} focusedResourceId={focusedResourceId} onClearFocus={() => setFocusedResourceId(null)} />;
      if (activeTab === 'spending') tabContent = <TabComp {...tabProps} reviews={expenseReviews} />;
      if (activeTab === 'memory')   tabContent = <TabComp {...tabProps} memory={memory} />;

      return (
        <PhoneFrame>
          {tabContent}
          {(() => {
            const DrawerComp = window.Drawer;
            return DrawerComp ? <DrawerComp
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              activeTab={activeTab}
              onPick={(tab) => { setActiveTab(tab); setDrawerOpen(false); }}
              profile={profile}
              counts={{ goals: goals.length, lessons: lessons.length, spending: expenseReviews.length, memory: memory.length }}
            /> : null;
          })()}
        </PhoneFrame>
      );
    }
  }

  return (
    <PhoneFrame>
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
          <div style={{ fontSize: 11, color: paused ? '#b3261e' : 'var(--fg-3)', fontWeight: 500 }}>
            {paused ? 'paused — scroll down to resume' : typing ? 'thinking...' : `Talking with ${profile.firstName}`}
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: NORA_BLUE,
          background: 'var(--blue-50)', padding: '4px 8px', borderRadius: 6,
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          Showcase
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="scroll-y" style={{
        flex: 1, padding: '16px 14px 12px',
        display: 'flex', flexDirection: 'column', gap: 12,
        background: 'var(--bg-page)',
        position: 'relative',
      }}>
        {messages.map((m, i) => (
          <Turn key={`${convIndex}-${i}`} turn={m} density={tweaks.density} vibe={tweaks.vibe}
                onConfirmAction={() => {}} confirmed={confirmed}
                onOpenTab={(tab) => { setActiveTab(tab); setDrawerOpen(false); }}
                onOpenResource={(rid) => { setFocusedResourceId(rid); setActiveTab('learn'); setDrawerOpen(false); }} />
        ))}
        {typing && <TypingBubble />}
        {!typing && suggestedReplies.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <ShowcaseChipRow chips={suggestedReplies} highlighted={highlightedChip} />
          </div>
        )}
      </div>

      {/* Disabled composer */}
      <div style={{
        padding: '8px 12px 12px',
        borderTop: '1px solid var(--border-1)',
        background: '#fff',
        display: 'flex', alignItems: 'center', gap: 8,
        opacity: 0.5,
      }}>
        <div style={{
          flex: 1, padding: '10px 14px', borderRadius: 20,
          background: 'var(--bg-page)', border: '1px solid var(--border-1)',
          fontSize: 14, color: 'var(--fg-3)',
        }}>
          Showcase mode
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: 'var(--bg-page)', border: '1px solid var(--border-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NIcon name="send" size={16} color="var(--fg-3)" />
        </div>
      </div>

      {/* Profile transition overlay */}
      {transitioning && transitionProfile && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: `linear-gradient(155deg, #00007a 0%, ${NORA_BLUE} 55%, #1a1ab0 100%)`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          animation: 'showcase-fade-in 400ms ease-out',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <NIcon name="user" size={28} color="#fff" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {transitionProfile.firstName}
          </div>
          <div style={{ fontSize: 14, opacity: 0.8, marginTop: 8, fontWeight: 500 }}>
            {transitionProfile.tagline}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 24, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Nordea Savings Demo
          </div>
        </div>
      )}

      {/* Drawer */}
      {(() => {
        const DrawerComp = window.Drawer;
        return DrawerComp ? <DrawerComp
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeTab={activeTab}
          onPick={(tab) => { setActiveTab(tab); setDrawerOpen(false); }}
          profile={profile}
          counts={{ goals: goals.length, lessons: lessons.length, spending: expenseReviews.length, memory: memory.length }}
        /> : null;
      })()}
    </PhoneFrame>
  );
}

// ── Chip row with highlight support ───────────────────────────────────────
function ShowcaseChipRow({ chips, highlighted }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {chips.map((chip, i) => {
        const isHighlighted = highlighted && chip === highlighted;
        return (
          <span key={i} style={{
            padding: '8px 14px', borderRadius: 999,
            fontSize: 13, fontWeight: 500,
            background: isHighlighted ? NORA_BLUE : 'var(--bg-page)',
            color: isHighlighted ? '#fff' : 'var(--fg-1)',
            border: isHighlighted ? `1.5px solid ${NORA_BLUE}` : '1px solid var(--border-1)',
            transition: 'all 300ms ease',
            transform: isHighlighted ? 'scale(1.05)' : 'scale(1)',
            boxShadow: isHighlighted ? `0 2px 8px rgba(0,0,160,0.25)` : 'none',
            cursor: 'default',
          }}>
            {chip}
          </span>
        );
      })}
    </div>
  );
}

Object.assign(window, { ScreenShowcase });
