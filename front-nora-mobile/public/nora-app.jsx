// nora-app.jsx — Two-state shell. Welcome → open-ended Nora chat.

const {
  ScreenWelcome, ScreenChat,
  TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle,
  NIcon, NORA_BLUE,
} = window;

const VIBES = {
  subtle:   { label: 'Subtle',   accent: 'Quiet bank tones' },
  balanced: { label: 'Balanced', accent: 'Default neutral stage' },
  bold:     { label: 'Bold',     accent: 'Nordea blue everywhere' },
};

function App() {
  const [tweaks, setTweak] = useTweaks(window.__NORA_TWEAKS__ || {
    vibe: 'balanced',
    showAgentTags: true,
    density: 'comfortable',
    started: false,
  });

  const start = () => setTweak('started', true);
  const back  = () => setTweak('started', false);

  const stageBg = React.useMemo(() => {
    if (tweaks.vibe === 'subtle') {
      return { background: 'radial-gradient(1200px 800px at 50% 0%, #f6f7fb 0%, #e8eaf1 60%, #d8dbe6 100%)', captionColor: 'rgba(10,10,30,0.55)', dotShadow: '#00d27a' };
    }
    if (tweaks.vibe === 'bold') {
      return { background: `radial-gradient(1200px 800px at 50% 0%, #1a1ab0 0%, ${NORA_BLUE} 50%, #00005a 100%)`, captionColor: 'rgba(255,255,255,0.7)', dotShadow: '#7df0c0' };
    }
    return { background: 'radial-gradient(1200px 800px at 50% 0%, #2a2a3a 0%, #1a1a22 60%, #0d0d12 100%)', captionColor: 'rgba(255,255,255,0.55)', dotShadow: '#00d27a' };
  }, [tweaks.vibe]);

  return (
    <>
      <div className="stage" style={{ background: stageBg.background }}>
        <div className="stage-grain" />
        <div className="stage-inner">
          <div className="caption" style={{ color: stageBg.captionColor }}>
            <span className="dot" style={{ background: stageBg.dotShadow, boxShadow: `0 0 8px ${stageBg.dotShadow}` }} />
            Nordea Savings · Nora · live demo
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ opacity: 0.7 }}>{tweaks.started ? 'open conversation' : 'sign-in'}</span>
          </div>

          {tweaks.started
            ? <ScreenChat prev={back} tweaks={tweaks} />
            : <ScreenWelcome next={start} />}

          <div style={{
            fontSize: 11, color: tweaks.vibe === 'subtle' ? 'rgba(10,10,30,0.4)' : 'rgba(255,255,255,0.4)',
            fontWeight: 500, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <NIcon name="sliders-horizontal" size={12} color="currentColor" />
            Open Tweaks (bottom-right) to toggle agent tags, vibe, density
          </div>
        </div>
      </div>

      <NoraTweaks tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

function NoraTweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks · Nora demo">
      <TweakSection label="Visual vibe">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(VIBES).map(([key, v]) => (
            <button key={key} onClick={() => setTweak('vibe', key)} style={{
              textAlign: 'left',
              background: tweaks.vibe === key ? 'rgba(0,0,160,0.06)' : 'transparent',
              border: tweaks.vibe === key ? `1.5px solid ${NORA_BLUE}` : '1px solid var(--border-1)',
              borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: key === 'subtle' ? '#f0f1f5' : key === 'balanced' ? '#1a1a22' : '#00007a',
                border: '1px solid rgba(0,0,0,0.08)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg-1)' }}>{v.label}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{v.accent}</div>
              </div>
              {tweaks.vibe === key && <NIcon name="check" size={16} color={NORA_BLUE} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </TweakSection>

      <TweakSection label="Conversation">
        <TweakToggle
          label="Show agent tags"
          value={!!tweaks.showAgentTags}
          onChange={(v) => setTweak('showAgentTags', v)}
        />
        <TweakRadio
          label="Density"
          value={tweaks.density || 'comfortable'}
          onChange={(v) => setTweak('density', v)}
          options={[
            { value: 'compact',     label: 'Compact' },
            { value: 'comfortable', label: 'Comfy' },
          ]}
        />
      </TweakSection>

      <TweakSection label="Session">
        <button onClick={() => { setTweak('started', false); location.reload(); }} style={{
          background: 'transparent', border: '1px solid var(--border-1)',
          borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', color: 'var(--fg-1)',
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
        }}>
          <NIcon name="rotate-ccw" size={13} color="currentColor" />
          Reset conversation
        </button>
      </TweakSection>

      <TweakSection label="About">
        <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.55 }}>
          <strong>Nora</strong> is a conversational Nordea savings copilot. She orchestrates four sub-agents
          (<strong>Goal Planner</strong>, <strong>Expense Review</strong>, <strong>Education · Risk</strong>,
          <strong> Action · Approval</strong>) and decides per turn which to invoke. Cards render inline
          as she calls them. Backed by the Aalto LLM gateway.
        </div>
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
