// nora-components.jsx — shared primitives for the Nora demo
// Loaded as a Babel script. All components/helpers attached to window at the bottom.

const NORA_BLUE = '#0000a0';
const NORA_BLUE_HOVER = '#1a1ab0';

// Format euro amount, "en-IE"-style with a leading € sign
function euroN(n, { decimals = 0 } = {}) {
  if (n == null || isNaN(n)) return '';
  return '€' + Number(n).toLocaleString('en-IE', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
}

// Kept for backwards compat — NIcon no longer needs DOM mutation.
function useLucide() { /* no-op */ }

// Convert "chevron-left" → "ChevronLeft" for lucide.icons lookup
function toPascal(name) {
  return String(name).split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// Render a Lucide icon as a React-managed inline SVG.
// Reads the icon's child element list from window.lucide.icons[PascalName]
// (each entry is [tag, attrs]) and creates them as JSX children. We do NOT
// call lucide.createIcons() — that function replaces our <i> tags with <svg>
// at the DOM level, which breaks React's reconciliation when components
// mount/unmount (causes "removeChild: not a child" errors and blanks the tree).
function NIcon({ name, size = 20, color = 'currentColor', strokeWidth = 1.75, fill = false, style }) {
  const data = (window.lucide && window.lucide.icons && window.lucide.icons[toPascal(name)]) || null;
  const wrapStyle = {
    width: size, height: size,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    ...style,
  };
  if (!data) {
    return <span style={wrapStyle} aria-hidden="true" />;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? color : 'none'}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={wrapStyle}
      aria-hidden="true"
    >
      {data.map((child, i) => {
        const [tag, attrs] = child;
        return React.createElement(tag, { key: i, ...attrs });
      })}
    </svg>
  );
}

// ─── iPhone Frame ───────────────────────────────────────────────
// 390x844 device shell with dynamic island, status bar, home indicator.
function PhoneFrame({ children, statusDark = false, scale = 1 }) {
  return (
    <div style={{
      width: 390 * scale, height: 844 * scale, display: 'flex',
    }}>
      <div style={{
        width: 390, height: 844, borderRadius: 50, background: '#0b0b0f',
        padding: 11, boxSizing: 'border-box',
        boxShadow: '0 30px 80px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(0,0,0,.6)',
        position: 'relative',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 39, overflow: 'hidden',
          background: 'var(--bg-page)',
          position: 'relative',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Dynamic Island */}
          <div style={{
            position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
            width: 124, height: 34, background: '#000', borderRadius: 999, zIndex: 10,
          }} />
          {/* Status bar */}
          <div style={{
            padding: '14px 28px 4px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', fontSize: 15, fontWeight: 600,
            color: statusDark ? '#fff' : '#000',
            zIndex: 9, position: 'relative',
            flexShrink: 0,
          }}>
            <span>9:41</span>
            <span style={{ width: 60 }} />
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <NIcon name="signal" size={14} color={statusDark ? '#fff' : '#000'} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>5G</span>
              <span style={{
                display: 'inline-block', width: 24, height: 12, borderRadius: 3,
                border: `1.2px solid ${statusDark ? '#fff' : '#000'}`, position: 'relative',
              }}>
                <span style={{
                  position: 'absolute', inset: 1.5, background: statusDark ? '#fff' : '#000',
                  borderRadius: 1,
                }} />
              </span>
            </span>
          </div>
          {/* App content */}
          <div style={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
            position: 'relative',
          }}>
            {children}
          </div>
          {/* Home indicator */}
          <div style={{
            padding: '8px 0 6px', display: 'flex', justifyContent: 'center',
            background: 'transparent',
            position: 'relative', zIndex: 5,
          }}>
            <div style={{ width: 134, height: 5, borderRadius: 999, background: '#0a0a0f' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Nora avatar ────────────────────────────────────────────────
// A soft, pulsing dot — Nordea blue
function NoraAvatar({ size = 32, pulsing = false }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: 999,
      background: `radial-gradient(circle at 30% 30%, #4a4ad8 0%, ${NORA_BLUE} 60%, #00007a 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      boxShadow: '0 2px 8px rgba(0,0,160,0.3), inset 0 0 0 1px rgba(255,255,255,0.08)',
    }}>
      <div className={pulsing ? 'sparkle' : ''} style={{
        width: size * 0.34, height: size * 0.34, borderRadius: 999,
        background: '#fff', opacity: 0.95,
      }} />
    </div>
  );
}

// ─── Agent Tag ──────────────────────────────────────────────────
// Small chip showing which sub-agent is "thinking"
function AgentTag({ name, icon, state = 'thinking', visible = true }) {
  if (!visible) return null;
  const isDone = state === 'done';
  return (
    <div className="tag-in" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px 4px 6px', borderRadius: 999,
      background: isDone ? 'rgba(31,122,77,0.08)' : 'rgba(0,0,160,0.06)',
      border: `1px solid ${isDone ? 'rgba(31,122,77,0.24)' : 'rgba(0,0,160,0.2)'}`,
      color: isDone ? 'var(--success)' : NORA_BLUE,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
      fontFamily: 'Manrope, system-ui, sans-serif',
    }}>
      {isDone ? (
        <NIcon name="check" size={12} color="var(--success)" strokeWidth={2.5} />
      ) : (
        <span style={{
          width: 10, height: 10, borderRadius: 999,
          background: 'currentColor', opacity: 0.6,
        }} className="pulse-dot" />
      )}
      <span>{name}</span>
      {!isDone && <span style={{ opacity: 0.5 }}>thinking…</span>}
    </div>
  );
}

// ─── Chat Bubble ────────────────────────────────────────────────
function ChatBubble({ from, children, agentTags, density = 'comfortable' }) {
  const isNora = from === 'nora';
  const pad = density === 'compact' ? '10px 14px' : '12px 16px';
  const gap = density === 'compact' ? 6 : 10;

  return (
    <div className="bubble-in" style={{
      display: 'flex', flexDirection: isNora ? 'row' : 'row-reverse',
      gap: 10, alignItems: 'flex-end',
      width: '100%',
    }}>
      {isNora && <NoraAvatar size={28} />}
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap, alignItems: isNora ? 'flex-start' : 'flex-end',
        maxWidth: '78%',
      }}>
        {agentTags && agentTags.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 2,
          }}>
            {agentTags.map((t, i) => (
              <AgentTag key={t.name + i} {...t} />
            ))}
          </div>
        )}
        <div style={{
          background: isNora ? '#fff' : NORA_BLUE,
          color: isNora ? 'var(--fg-1)' : '#fff',
          padding: pad,
          borderRadius: 18,
          borderBottomLeftRadius: isNora ? 6 : 18,
          borderBottomRightRadius: isNora ? 18 : 6,
          fontSize: 15, lineHeight: 1.45, fontWeight: 500,
          border: isNora ? '1px solid var(--border-1)' : 'none',
          boxShadow: isNora ? '0 1px 2px rgba(10,10,25,.04)' : '0 4px 12px rgba(0,0,160,0.18)',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Typing indicator ──────────────────────────────────────────
function TypingBubble() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
      <NoraAvatar size={28} pulsing />
      <div style={{
        background: '#fff',
        padding: '14px 16px',
        borderRadius: 18,
        borderBottomLeftRadius: 6,
        border: '1px solid var(--border-1)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: 999,
            background: 'var(--fg-3)',
            animation: `shimmer 1.2s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Quick-reply chips ─────────────────────────────────────────
function ChipRow({ chips, onPick }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8,
      paddingLeft: 38, /* align under avatar gutter */
    }}>
      {chips.map(c => (
        <button key={c} onClick={() => onPick(c)} style={{
          background: '#fff',
          border: `1px solid ${NORA_BLUE}`,
          color: NORA_BLUE,
          padding: '8px 14px', borderRadius: 999,
          fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 120ms',
          fontFamily: 'inherit',
        }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--blue-50)'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
          {c}
        </button>
      ))}
    </div>
  );
}

// ─── Composer (text input + send) ──────────────────────────────
function Composer({ value, onChange, onSend, placeholder, disabled, dark = false }) {
  const ref = React.useRef(null);
  const MAX_TEXTAREA_HEIGHT = 112;

  const resizeTextarea = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, []);

  React.useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 8,
      padding: '10px 12px',
      borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'var(--border-1)'}`,
      background: dark ? 'rgba(0,0,0,0.3)' : '#fff',
      flexShrink: 0,
    }}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(resizeTextarea);
        }}
        onKeyDown={handleKey}
        placeholder={placeholder || 'Reply to Nora…'}
        disabled={disabled}
        style={{
          flex: 1, minWidth: 0, border: 0, outline: 'none',
          background: dark ? 'rgba(255,255,255,0.06)' : 'var(--bg-page)',
          minHeight: 44, maxHeight: MAX_TEXTAREA_HEIGHT,
          padding: '11px 16px', borderRadius: 22,
          fontSize: 15, lineHeight: 1.45, fontFamily: 'inherit',
          color: dark ? '#fff' : 'var(--fg-1)',
          resize: 'none',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      />
      <button onClick={onSend} disabled={!value.trim() || disabled} style={{
        width: 44, height: 44, borderRadius: 999,
        background: NORA_BLUE, color: '#fff', border: 0,
        cursor: value.trim() && !disabled ? 'pointer' : 'not-allowed',
        opacity: value.trim() && !disabled ? 1 : 0.38,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 120ms',
        flexShrink: 0,
      }}>
        <NIcon name="arrow-up" size={20} color="#fff" strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─── Pretty money display, with count-up on first appearance ────
function MoneyDisplay({ value, size = 32, color, weight = 700, decimals = 0 }) {
  const [displayed, setDisplayed] = React.useState(0);
  React.useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = 700;
    const from = 0;
    const to = value;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      // ease-out cubic
      const e = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round((from + (to - from) * e) * Math.pow(10, decimals)) / Math.pow(10, decimals));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span style={{
      fontSize: size, fontWeight: weight, color: color || 'var(--fg-1)',
      letterSpacing: '-0.02em', lineHeight: 1,
      fontFeatureSettings: '"tnum"',
      fontVariantNumeric: 'tabular-nums lining-nums',
    }}>
      {euroN(displayed, { decimals })}
    </span>
  );
}

// ─── Card (in-chat result) ─────────────────────────────────────
// Wraps an inline rich card that emerges from Nora's stream
function InChatCard({ children, eyebrow, vibe = 'balanced' }) {
  return (
    <div style={{ width: 'calc(100% - 38px)', marginLeft: 38, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {eyebrow && (
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--fg-3)',
        }}>{eyebrow}</div>
      )}
      <div className="card-in" style={{
        background: '#fff',
        border: `1px solid var(--border-1)`,
        borderRadius: 16,
        boxShadow: vibe === 'bold'
          ? '0 12px 30px rgba(0,0,160,0.08), 0 2px 4px rgba(10,10,25,0.04)'
          : '0 2px 6px rgba(10,10,25,0.05)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Primary Button ────────────────────────────────────────────
function PrimaryButton({ children, onClick, disabled, fullWidth = true, leadingIcon, kind = 'primary' }) {
  const base = {
    background: NORA_BLUE, color: '#fff',
    border: 0, borderRadius: 8,
    padding: '14px 20px',
    fontSize: 16, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'inherit',
    width: fullWidth ? '100%' : undefined,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 120ms, transform 120ms',
  };
  if (kind === 'ghost') {
    base.background = 'transparent';
    base.color = NORA_BLUE;
    base.border = `1.5px solid ${NORA_BLUE}`;
  }
  return (
    <button onClick={onClick} disabled={disabled} style={base}
      onMouseEnter={(e) => { if (!disabled && kind === 'primary') e.currentTarget.style.background = NORA_BLUE_HOVER; }}
      onMouseLeave={(e) => { if (!disabled && kind === 'primary') e.currentTarget.style.background = NORA_BLUE; }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.99)'; }}
      onMouseUp={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1)'; }}>
      {leadingIcon && <NIcon name={leadingIcon} size={18} color="currentColor" strokeWidth={2} />}
      {children}
    </button>
  );
}

// ─── Header in-app (back + title + right action) ───────────────
function AppHeader({ title, onBack, rightIcon, onRight, blue = false, subtitle }) {
  const fg = blue ? '#fff' : 'var(--fg-1)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 8px 8px',
      flexShrink: 0,
      background: blue ? NORA_BLUE : 'transparent',
    }}>
      <button onClick={onBack} style={{
        width: 40, height: 40, border: 0, background: 'transparent',
        borderRadius: 999, cursor: onBack ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: fg, opacity: onBack ? 1 : 0,
      }}>
        <NIcon name="chevron-left" size={24} color={fg} />
      </button>
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: fg }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, fontWeight: 500, color: fg, opacity: 0.7, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <button onClick={onRight} style={{
        width: 40, height: 40, border: 0, background: 'transparent',
        borderRadius: 999, cursor: rightIcon ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: fg, opacity: rightIcon ? 1 : 0,
      }}>
        {rightIcon && <NIcon name={rightIcon} size={22} color={fg} />}
      </button>
    </div>
  );
}

// Wait helper — used to simulate agent latency for the scripted parts
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Markdown renderer ─────────────────────────────────────────────────────────
function InlineText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  );
}

function MarkdownText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const out = [];
  let numbered = [];
  let bulleted = [];

  const flushNumbered = () => {
    if (!numbered.length) return;
    out.push(
      <ol key={out.length} style={{ paddingLeft: 18, margin: '6px 0 2px', listStyleType: 'decimal' }}>
        {numbered.map((item, i) => (
          <li key={i} style={{ marginBottom: 3, paddingLeft: 2 }}>
            <InlineText text={item.replace(/\s*\|\s*/g, ' · ')} />
          </li>
        ))}
      </ol>
    );
    numbered = [];
  };

  const flushBulleted = () => {
    if (!bulleted.length) return;
    out.push(
      <ul key={out.length} style={{ paddingLeft: 0, margin: '6px 0 2px', listStyle: 'none' }}>
        {bulleted.map((item, i) => (
          <li key={i} style={{ marginBottom: 3, display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--fg-3)', flexShrink: 0 }}>·</span>
            <span><InlineText text={item.replace(/\s*\|\s*/g, ' · ')} /></span>
          </li>
        ))}
      </ul>
    );
    bulleted = [];
  };

  lines.forEach(line => {
    const num = line.match(/^(\d+)\.\s+(.*)/);
    const bul = line.match(/^[-*]\s+(.*)/);
    if (num) {
      flushBulleted();
      numbered.push(num[2]);
    } else if (bul) {
      flushNumbered();
      bulleted.push(bul[1]);
    } else if (line.trim() === '') {
      flushNumbered(); flushBulleted();
      if (out.length) out.push(<div key={out.length} style={{ height: 5 }} />);
    } else {
      flushNumbered(); flushBulleted();
      out.push(<div key={out.length}><InlineText text={line} /></div>);
    }
  });

  flushNumbered();
  flushBulleted();
  return <div>{out}</div>;
}

// ── Daily Brief Card ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  green:  { color: '#16a34a', bg: 'rgba(22,163,74,.08)',  border: 'rgba(22,163,74,.3)',  icon: 'check-circle',   label: 'All good' },
  yellow: { color: '#ca8a04', bg: 'rgba(202,138,4,.08)',  border: 'rgba(202,138,4,.3)',  icon: 'alert-triangle', label: 'Watch out' },
  red:    { color: '#dc2626', bg: 'rgba(220,38,38,.08)',  border: 'rgba(220,38,38,.3)',  icon: 'alert-circle',   label: 'Attention' },
};

function DailyBriefCard({ data, onClose }) {
  const [open, setOpen] = React.useState(true);
  if (!data) return null;
  const cfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.yellow;
  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const briefLabel = data.just_refreshed ? 'Fresh brief' : 'Saved brief';
  const generatedLabel = fmtDate(data.generated_at || data.date);

  return (
    <div style={{
      borderRadius: 16, border: `1.5px solid ${cfg.border}`,
      background: '#fff', overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(10,10,25,.06)',
    }}>
      {/* Header */}
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', cursor: 'pointer', background: cfg.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NIcon name={cfg.icon} size={16} color={cfg.color} />
          <span style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.label}</span>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            · {briefLabel}{generatedLabel ? ` · ${generatedLabel}` : ''}
          </span>
          {data.is_stale && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--fg-3)',
              border: '1px solid var(--border-1)', borderRadius: 999,
              padding: '1px 6px', background: '#fff',
            }}>
              cached
            </span>
          )}
        </div>
        <NIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} color="var(--fg-3)" />
      </div>

      {open && (
        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1.4 }}>
            {data.headline}
          </div>

          {data.observations?.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.observations.map((obs, i) => (
                <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 13, color: 'var(--fg-2)' }}>
                  <span style={{ color: cfg.color, flexShrink: 0 }}>·</span>
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          )}

          {data.goals?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Goals</div>
              {data.goals.map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: i < data.goals.length - 1 ? '1px solid var(--border-1)' : 'none', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <NIcon name={g.reachable ? 'check' : 'x'} size={13} color={g.reachable ? '#16a34a' : '#dc2626'} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)', textAlign: 'right', flexShrink: 0 }}>{g.note}</span>
                </div>
              ))}
            </div>
          )}

          {data.suggestions?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Suggestions</div>
              {data.suggestions.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', borderBottom: i < data.suggestions.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
                  <NIcon name="lightbulb" size={13} color="#ca8a04" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {data.web_insights?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Market &amp; Deals</div>
              {data.web_insights.map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', borderBottom: i < data.web_insights.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
                  <NIcon name={w.type === 'news' ? 'trending-up' : 'tag'} size={13} color={w.type === 'news' ? '#7c3aed' : '#0891b2'} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: w.type === 'news' ? '#7c3aed' : '#0891b2', marginRight: 6 }}>{w.goal}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{w.summary}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.advice && (
            <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600, padding: '8px 10px', borderRadius: 8, background: cfg.bg }}>
              {data.advice}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Expose
Object.assign(window, {
  NORA_BLUE, NORA_BLUE_HOVER,
  euroN, wait, useLucide,
  NIcon, PhoneFrame, NoraAvatar, AgentTag,
  ChatBubble, TypingBubble, ChipRow, Composer,
  MoneyDisplay, InChatCard, PrimaryButton, AppHeader,
  MarkdownText, DailyBriefCard,
});
