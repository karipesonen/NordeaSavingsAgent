// nora-tabs.jsx — Drawer + tab screens (Learn / Goals / Spending / Memory)
// and the compact preview cards that appear in chat.

const {
  NIcon, NoraAvatar, InChatCard, MoneyDisplay, PrimaryButton,
  euroN, NORA_BLUE,
} = window;

// ── Drawer ─────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, activeTab, onPick, counts, profile }) {
  const items = [
    { id: 'chat',     label: 'Chat',     icon: 'message-circle', sub: 'Talk to Nora' },
    { id: 'goals',    label: 'Goals',    icon: 'target',         sub: `${counts.goals} active` },
    { id: 'learn',    label: 'Learn',    icon: 'graduation-cap', sub: `${counts.lessons} lesson${counts.lessons === 1 ? '' : 's'}` },
    { id: 'spending', label: 'Spending', icon: 'receipt',        sub: `${counts.spending} review${counts.spending === 1 ? '' : 's'}` },
    { id: 'memory',   label: 'Memory',   icon: 'brain',          sub: `${counts.memory} note${counts.memory === 1 ? '' : 's'}` },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, zIndex: 20,
        background: open ? 'rgba(0,0,0,0.35)' : 'transparent',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'background 220ms cubic-bezier(.2,0,0,1)',
      }} />
      {/* Sliding panel */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: '78%', zIndex: 21,
        background: '#fff',
        borderTopRightRadius: 28, borderBottomRightRadius: 28,
        boxShadow: '8px 0 24px rgba(0,0,0,0.18)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 280ms cubic-bezier(.2,0,0,1)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 22px 16px',
          background: `linear-gradient(155deg, ${NORA_BLUE} 0%, #00007a 100%)`,
          color: '#fff',
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <NoraAvatar size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Nordea Savings
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{profile?.firstName || 'You'} · with Nora</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, border: 0, borderRadius: 999,
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}>
            <NIcon name="x" size={16} color="#fff" strokeWidth={2.5} />
          </button>
        </div>

        {/* Items */}
        <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {items.map(item => {
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => onPick(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', borderRadius: 12,
                border: 0,
                background: active ? 'var(--blue-50)' : 'transparent',
                cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background 120ms',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: active ? NORA_BLUE : 'var(--bg-page)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <NIcon name={item.icon} size={18}
                         color={active ? '#fff' : NORA_BLUE} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: active ? NORA_BLUE : 'var(--fg-1)' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 1 }}>
                    {item.sub}
                  </div>
                </div>
                {active && <NIcon name="chevron-right" size={16} color={NORA_BLUE} />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--border-1)',
          fontSize: 11, color: 'var(--fg-3)', fontWeight: 500,
          flexShrink: 0,
        }}>
          Concept · Nordea Savings · Nora
        </div>
      </div>
    </>
  );
}

// ── Generic tab header (back to chat) ──────────────────────────────────────
function TabHeader({ title, subtitle, onMenu }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 16px 12px 8px',
      borderBottom: '1px solid var(--border-1)',
      background: '#fff', flexShrink: 0,
    }}>
      <button onClick={onMenu} style={{
        width: 40, height: 40, border: 0, background: 'transparent',
        borderRadius: 999, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <NIcon name="menu" size={22} color="var(--fg-1)" />
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--fg-1)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500, marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Goals tab ──────────────────────────────────────────────────────────────
function GoalsTab({ goals, onMenu, onAskNora }) {
  return (
    <>
      <TabHeader title="Goals" subtitle={`${goals.length} active`} onMenu={onMenu} />
      <div className="scroll-y" style={{ flex: 1, padding: '16px 14px', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {goals.length === 0 ? (
          <EmptyState
            icon="target"
            title="No goals yet"
            body="Tell Nora what you're saving for and she'll draft a plan."
            cta="Open chat"
            onCta={onAskNora}
          />
        ) : goals.map((g, i) => (
          <FullGoalCard key={g.id || i} data={g.data} />
        ))}
      </div>
    </>
  );
}

// ── Learn tab ──────────────────────────────────────────────────────────────
// Library of curated resources + Nora's interactive lessons + "For you" section.
// LearnTab maintains its own detail-screen state for in-app resource reading.
function LearnTab({ lessons, suggestedResourceIds, generatedResources = [], focusedResourceId, onMenu, onAskNora, onClearFocus }) {
  const [curated, setCurated] = React.useState([]);
  const [filter, setFilter] = React.useState('all'); // all | article | video | podcast | drafted
  const [domainFilter, setDomainFilter] = React.useState(null);
  const [detail, setDetail] = React.useState(null); // resource object when reading

  // Fetch the curated catalog once
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/resources')
      .then(r => r.json())
      .then(j => { if (!cancelled) setCurated(j.resources || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Merged library = curated catalog + Nora's drafted explainers.
  // Generated resources sorted newest-first; curated keep their original order.
  const library = React.useMemo(() => {
    const gen = [...generatedResources].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return [...gen, ...curated];
  }, [curated, generatedResources]);

  // When Nora pushes a resource preview in chat and user taps "Open in Learn",
  // ScreenChat sets focusedResourceId — open that resource as a detail screen.
  React.useEffect(() => {
    if (!focusedResourceId || !library.length) return;
    const r = library.find(x => x.id === focusedResourceId);
    if (r) {
      setDetail(r);
      onClearFocus && onClearFocus();
    }
  }, [focusedResourceId, library]);

  if (detail) {
    return <ResourceDetail resource={detail} onBack={() => setDetail(null)} onMenu={onMenu} />;
  }

  // Format filter handles the new "drafted" pseudo-format
  const formatFiltered = filter === 'all'
    ? library
    : filter === 'drafted'
      ? library.filter(r => r.generated)
      : library.filter(r => r.format === filter);
  const domainFiltered = domainFilter
    ? formatFiltered.filter(r => r.domain === domainFilter)
    : formatFiltered;

  // "For you" = anything Nora pushed (curated suggestion ids + every generated one)
  const suggested = library.filter(r =>
    suggestedResourceIds.includes(r.id) || r.generated
  );
  const domains = Array.from(new Set(library.map(r => r.domain)));
  const draftedCount = generatedResources.length;

  return (
    <>
      <TabHeader
        title="Learn"
        subtitle={`${library.length} resources${draftedCount ? ` (${draftedCount} drafted)` : ''} · ${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`}
        onMenu={onMenu}
      />
      <div className="scroll-y" style={{ flex: 1, padding: '16px 14px 24px', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* For you — what Nora suggested */}
        {suggested.length > 0 && (
          <Section label="For you · suggested by Nora">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {suggested.map(r => (
                <ResourceCard key={r.id} resource={r} highlighted onOpen={() => setDetail(r)} />
              ))}
            </div>
          </Section>
        )}

        {/* Nora's own lessons */}
        {lessons.length > 0 && (
          <Section label="Nora's interactive lessons">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lessons.map((l, i) => <FullLessonCard key={l.id || i} data={l.data} />)}
            </div>
          </Section>
        )}

        {/* Library */}
        <Section label={`Library · ${library.length} resources`}>
          {/* Format chips (incl. Drafted pseudo-format) */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { id: 'all',     label: 'All' },
              { id: 'article', label: 'Articles' },
              { id: 'video',   label: 'Videos' },
              { id: 'podcast', label: 'Podcasts' },
              ...(draftedCount > 0 ? [{ id: 'drafted', label: `✨ Drafted (${draftedCount})` }] : []),
            ].map(c => (
              <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
                {c.label}
              </FilterChip>
            ))}
          </div>
          {/* Domain chips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <FilterChip active={!domainFilter} onClick={() => setDomainFilter(null)}>
              Any topic
            </FilterChip>
            {domains.map(d => (
              <FilterChip key={d} active={domainFilter === d} onClick={() => setDomainFilter(d)}>
                {d}
              </FilterChip>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {domainFiltered.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--fg-3)', padding: '24px 0', textAlign: 'center' }}>
                No resources match those filters.
              </div>
            ) : domainFiltered.map(r => (
              <ResourceCard key={r.id} resource={r} onOpen={() => setDetail(r)} />
            ))}
          </div>
        </Section>

        {/* Help text */}
        {library.length === 0 && lessons.length === 0 && (
          <EmptyState
            icon="graduation-cap"
            title="Loading library…"
            body="Nora's curated resources will appear here in a second."
          />
        )}
      </div>
    </>
  );
}

// ── Learn helpers ──────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? NORA_BLUE : '#fff',
      color: active ? '#fff' : 'var(--fg-1)',
      border: `1px solid ${active ? NORA_BLUE : 'var(--border-1)'}`,
      borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit',
      transition: 'background 120ms, color 120ms',
    }}>
      {children}
    </button>
  );
}

function ResourceCard({ resource, highlighted, onOpen }) {
  const formatMeta = {
    article:   { icon: 'file-text',   label: 'Article' },
    video:     { icon: 'play-circle', label: 'Video' },
    podcast:   { icon: 'headphones',  label: 'Podcast' },
    explainer: { icon: 'sparkles',    label: 'Explainer' },
  };
  const meta = formatMeta[resource.format] || formatMeta.article;
  const isGen = !!resource.generated;
  const time = resource.estimatedMinutes
    ? `${resource.estimatedMinutes} min ${resource.format === 'article' || isGen ? 'read' : 'watch'}`
    : (resource.format === 'article' ? 'Read' : 'Listen / watch');

  return (
    <button onClick={onOpen} style={{
      width: '100%',
      background: isGen
        ? 'linear-gradient(180deg, #faf6ff 0%, #ffffff 50%)'
        : (highlighted ? 'var(--blue-50)' : '#fff'),
      border: `1px solid ${isGen ? '#d8c8f4' : (highlighted ? 'var(--blue-100)' : 'var(--border-1)')}`,
      borderRadius: 14, padding: '14px 16px',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'border-color 120ms',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = isGen ? '#9b7cd8' : NORA_BLUE}
    onMouseLeave={e => e.currentTarget.style.borderColor = isGen ? '#d8c8f4' : (highlighted ? 'var(--blue-100)' : 'var(--border-1)')}>
      {/* Top row: format chip + time + drafted badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 999,
          background: isGen ? '#efe7fb' : 'var(--blue-50)',
          color: isGen ? '#7a3eb3' : NORA_BLUE,
          letterSpacing: '0.02em',
        }}>
          <NIcon name={meta.icon} size={11} color={isGen ? '#7a3eb3' : NORA_BLUE} strokeWidth={2} />
          {meta.label}
        </span>
        {isGen && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 999,
            background: '#7a3eb3', color: '#fff',
            fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            ✨ Drafted by Nora
          </span>
        )}
        <span>·</span>
        <span>{time}</span>
        <span>·</span>
        <span>{resource.domain}</span>
      </div>
      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1.35 }}>
        {resource.title}
      </div>
      {/* Why Nora */}
      {resource.whyNora && (
        <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          <span style={{ color: isGen ? '#7a3eb3' : NORA_BLUE, fontWeight: 600 }}>Why: </span>
          {resource.whyNora}
        </div>
      )}
    </button>
  );
}

// ── YouTube facade (thumbnail → iframe on click, fallback to YouTube link) ──
// Shows a static thumbnail always. On click: tries to load iframe. If the video
// has embedding disabled the iframe will show an error; we catch that with an
// error handler and fall back to opening the YouTube link in a new tab.
function YouTubeFacade({ ytId, url, title }) {
  const [active, setActive] = React.useState(false);
  const [embedFailed, setEmbedFailed] = React.useState(false);

  // hqdefault: 480×360, always public regardless of embed permission
  const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  const embedSrc = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`;
  const ytUrl = url || `https://www.youtube.com/watch?v=${ytId}`;

  if (active && !embedFailed) {
    return (
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, marginBottom: 16, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
        <iframe
          src={embedSrc}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onError={() => setEmbedFailed(true)}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
    );
  }

  // Thumbnail facade (also shown after embed failure)
  return (
    <div style={{ position: 'relative', marginBottom: 16, borderRadius: 12, overflow: 'hidden', background: '#000', cursor: 'pointer' }}
         onClick={() => embedFailed ? window.open(ytUrl, '_blank', 'noopener') : setActive(true)}>
      <img
        src={thumb}
        alt={title}
        style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover', opacity: embedFailed ? 0.7 : 1 }}
        onError={e => { e.currentTarget.style.minHeight = '180px'; e.currentTarget.style.background = '#111'; }}
      />
      {/* Play button overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8,
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 999,
          background: embedFailed ? '#fff' : 'rgba(255,255,255,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'transform 120ms',
        }}>
          <NIcon name={embedFailed ? 'external-link' : 'play'} size={22} color="#111" strokeWidth={2} />
        </div>
        {embedFailed && (
          <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, letterSpacing: '0.02em', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            Open on YouTube
          </div>
        )}
      </div>
    </div>
  );
}

// ── Resource detail screen (in-app reader) ─────────────────────────────────
// Two modes: curated catalog item (with URL/iframe) OR drafted-by-Nora explainer.
function ResourceDetail({ resource, onBack, onMenu }) {
  const isGen = !!resource.generated;
  const accent = isGen ? '#7a3eb3' : NORA_BLUE;

  // Build YouTube video id if curated video
  const ytId = (() => {
    if (isGen) return null;
    const m = (resource.url || '').match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([\w-]{11})/);
    return m ? m[1] : null;
  })();

  const formatMeta = {
    article:   { icon: 'file-text',   label: 'Article' },
    video:     { icon: 'play-circle', label: 'Video' },
    podcast:   { icon: 'headphones',  label: 'Podcast' },
    explainer: { icon: 'sparkles',    label: 'Explainer' },
  };
  const meta = formatMeta[resource.format] || formatMeta.article;
  const time = resource.estimatedMinutes ? `${resource.estimatedMinutes} min` : null;

  // Paragraphs split on double newline OR single newline (LLM output varies)
  const paragraphs = (resource.body || '')
    .split(/\n{2,}|\r\n\r\n/)
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <>
      {/* Detail header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px 12px 8px',
        borderBottom: '1px solid var(--border-1)',
        background: '#fff', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          width: 40, height: 40, border: 0, background: 'transparent',
          borderRadius: 999, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NIcon name="chevron-left" size={22} color="var(--fg-1)" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg-1)' }}>
            {isGen ? 'Drafted by Nora' : 'Resource'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 500 }}>
            {meta.label}{time ? ` · ${time}` : ''} · {resource.source}
          </div>
        </div>
        <button onClick={onMenu} style={{
          width: 40, height: 40, border: 0, background: 'transparent',
          borderRadius: 999, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NIcon name="menu" size={20} color="var(--fg-2)" />
        </button>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '16px 18px 24px', background: 'var(--bg-page)' }}>
        {/* Format chip + drafted badge row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 999,
            background: accent, color: '#fff',
          }}>
            <NIcon name={meta.icon} size={11} color="#fff" strokeWidth={2} />
            {meta.label}
          </span>
          {isGen && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 8px', borderRadius: 999,
              background: '#efe7fb', color: '#7a3eb3',
              fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              ✨ Drafted on demand
            </span>
          )}
          <span>{resource.domain}</span>
          {time && <><span>·</span><span>{time}</span></>}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1.25, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          {resource.title}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 16 }}>
          {isGen
            ? <>Drafted by <strong style={{ color: accent }}>Nora</strong> for you</>
            : <>From <strong style={{ color: 'var(--fg-2)' }}>{resource.source}</strong></>}
        </div>

        {/* Curated: YouTube facade (thumbnail → embed on click, fallback to link) */}
        {ytId && <YouTubeFacade ytId={ytId} url={resource.url} title={resource.title} />}

        {/* Summary */}
        {resource.summary && (
          <div style={{
            background: '#fff', border: '1px solid var(--border-1)', borderRadius: 12,
            padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Summary
            </div>
            <div style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.55 }}>
              {resource.summary}
            </div>
          </div>
        )}

        {/* Generated body — full mini-article */}
        {isGen && paragraphs.length > 0 && (
          <div style={{
            background: '#fff', border: '1px solid var(--border-1)', borderRadius: 12,
            padding: '16px 18px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Explainer
            </div>
            {paragraphs.map((p, i) => (
              <p key={i} style={{
                margin: i === 0 ? 0 : '10px 0 0', fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.6,
              }}>
                {p}
              </p>
            ))}
          </div>
        )}

        {/* Key takeaways */}
        {isGen && Array.isArray(resource.keyTakeaways) && resource.keyTakeaways.length > 0 && (
          <div style={{
            background: '#fff', border: '1px solid var(--border-1)', borderRadius: 12,
            padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Key takeaways
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resource.keyTakeaways.map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>
                  <NIcon name="check" size={14} color={accent} strokeWidth={2.5} style={{ marginTop: 3, flexShrink: 0 }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested reading */}
        {isGen && Array.isArray(resource.suggestedReading) && resource.suggestedReading.length > 0 && (
          <div style={{
            background: '#fff', border: '1px solid var(--border-1)', borderRadius: 12,
            padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Where to dig deeper
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resource.suggestedReading.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: '#efe7fb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 1,
                  }}>
                    <NIcon name="search" size={12} color={accent} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.4 }}>
                      {s.title}
                    </div>
                    {s.where && (
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2, lineHeight: 1.5 }}>
                        {s.where}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Why Nora */}
        {resource.whyNora && (
          <div style={{
            background: isGen ? '#faf6ff' : 'var(--blue-50)',
            border: `1px solid ${isGen ? '#d8c8f4' : 'var(--blue-100)'}`,
            borderRadius: 12, padding: '14px 16px', marginBottom: 14,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <NoraAvatar size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                {isGen ? 'Why Nora drafted this' : 'Why Nora picked this'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55 }}>
                {resource.whyNora}
              </div>
            </div>
          </div>
        )}

        {/* Usage warning (catalog only) */}
        {resource.usageWarning && (
          <div style={{
            background: 'var(--warning-bg)', border: '1px solid rgba(176,114,21,0.3)', borderRadius: 12,
            padding: '12px 14px', marginBottom: 14,
            display: 'flex', gap: 10, alignItems: 'flex-start',
            fontSize: 12, color: 'var(--warning)', lineHeight: 1.5,
          }}>
            <NIcon name="info" size={14} color="var(--warning)" strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{resource.usageWarning}</span>
          </div>
        )}

        {/* Curated only: "Open in browser" link */}
        {!isGen && resource.url && (
          <>
            <a href={resource.url} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', width: '100%', boxSizing: 'border-box',
              background: NORA_BLUE, color: '#fff',
              padding: '14px 18px', borderRadius: 10,
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit',
            }}>
              Open in browser
              <NIcon name="external-link" size={16} color="#fff" strokeWidth={2.5} />
            </a>
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--fg-3)', textAlign: 'center', wordBreak: 'break-all' }}>
              {resource.url.replace(/^https?:\/\//, '')}
            </div>
          </>
        )}

        {/* Generated only: footer disclaimer */}
        {isGen && (
          <div style={{
            marginTop: 6, padding: '10px 12px',
            background: 'transparent', border: '1px dashed var(--border-1)',
            borderRadius: 10, fontSize: 11, color: 'var(--fg-3)',
            lineHeight: 1.5, textAlign: 'center',
          }}>
            This explainer was drafted by Nora for your question — not a bank-approved document. Verify with the suggested sources before acting on it.
          </div>
        )}
      </div>
    </>
  );
}

// ── Spending tab ───────────────────────────────────────────────────────────
function SpendingTab({ reviews, onMenu, onAskNora }) {
  return (
    <>
      <TabHeader title="Spending" subtitle={`${reviews.length} review${reviews.length === 1 ? '' : 's'}`} onMenu={onMenu} />
      <div className="scroll-y" style={{ flex: 1, padding: '16px 14px', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {reviews.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No reviews yet"
            body="Ask Nora to check where your money goes — she'll show you where to redirect."
            cta="Ask Nora to review my spending"
            onCta={() => onAskNora('Can you review my spending?')}
          />
        ) : reviews.map((r, i) => (
          <FullExpenseCard key={r.id || i} data={r.data} createdAt={r.createdAt} />
        ))}
      </div>
    </>
  );
}

// ── Memory tab ─────────────────────────────────────────────────────────────
function MemoryTab({ memory, onMenu }) {
  return (
    <>
      <TabHeader title="What Nora remembers" subtitle={`${memory.length} note${memory.length === 1 ? '' : 's'}`} onMenu={onMenu} />
      <div className="scroll-y" style={{ flex: 1, padding: '16px 14px', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {memory.length === 0 ? (
          <EmptyState
            icon="brain"
            title="Nothing to remember yet"
            body="As you chat, Nora keeps short notes about your goals and preferences here."
          />
        ) : memory.map((note, i) => (
          <div key={i} style={{
            background: '#fff',
            border: '1px solid var(--border-1)',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              background: 'var(--blue-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              <NIcon name="sticky-note" size={13} color={NORA_BLUE} />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--fg-1)' }}>
              {note}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ icon, title, body, cta, onCta }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '48px 24px', minHeight: 320,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 999,
        background: 'var(--blue-50)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
      }}>
        <NIcon name={icon} size={28} color={NORA_BLUE} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.5, maxWidth: 280, marginBottom: cta ? 20 : 0 }}>
        {body}
      </div>
      {cta && (
        <button onClick={onCta} style={{
          background: NORA_BLUE, color: '#fff', border: 0, borderRadius: 8,
          padding: '10px 18px', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {cta}
          <NIcon name="arrow-right" size={14} color="#fff" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// ── Full cards (live in their respective tabs) ─────────────────────────────
function FullGoalCard({ data }) {
  const monthly = goalMonthlyAmount(data);
  return (
    <InChatCard eyebrow={`Goal · ${data.label || 'Your goal'}`} vibe="balanced">
      <div style={{ background: `linear-gradient(135deg, #00007a 0%, ${NORA_BLUE} 100%)`, color: '#fff', padding: '20px 20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NIcon name={data.icon || 'piggy-bank'} size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Target</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{data.label} · by {data.deadline}</div>
          </div>
        </div>
        <MoneyDisplay value={data.targetAmount || 0} size={44} color="#fff" />
        <div style={{ height: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 999, marginTop: 16, overflow: 'hidden' }}>
          <div style={{ width: '0%', height: '100%', background: '#fff' }} />
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.85, fontWeight: 500 }}>
          <span>€0 saved · 0%</span>
          <span>{data.monthsToGo || 0} months to go</span>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {[
          { label: 'Monthly habit',  value: `€${monthly} / month`,                        sub: 'automatic transfer',    icon: 'repeat' },
          { label: 'Optional round-ups', value: 'On when available',                       sub: 'small extras, not counted in the plan', icon: 'sparkles' },
          { label: 'Where it lives', value: data.mix || '—',                              sub: 'low-volatility mix',    icon: 'layers' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--border-1)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <NIcon name={row.icon} size={16} color={NORA_BLUE} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{row.label}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>{row.sub}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums lining-nums', textAlign: 'right', flexShrink: 0, maxWidth: '52%', lineHeight: 1.4 }}>{row.value}</div>
          </div>
        ))}
      </div>
    </InChatCard>
  );
}

function FullExpenseCard({ data, createdAt }) {
  const items = data.items || [];
  const weeklyRoom = Number(data.weeklyRoom || 0);
  const monthlyRoom = data.monthlyRoom ?? weeklyToMonthly(weeklyRoom);
  const bridge = data.investmentBridge;
  return (
    <InChatCard eyebrow={`Expense review · ${createdAt ? formatRelative(createdAt) : 'last 90 days'}`} vibe="balanced">
      <div style={{ padding: '16px 20px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>Room to redirect</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <MoneyDisplay value={monthlyRoom} size={36} color="var(--fg-1)" />
          <span style={{ fontSize: 13, color: 'var(--fg-3)', fontWeight: 500 }}>/ month</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 18 }}>
          from reviewable monthly categories
        </div>
        {bridge?.futureFundsAmount > 0 && (
          <div style={{
            padding: '10px 12px', borderRadius: 10, background: 'var(--blue-50)',
            border: '1px solid var(--blue-100)', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <NIcon name="split" size={14} color={NORA_BLUE} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: NORA_BLUE, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>Possible path</div>
              <div style={{ fontSize: 12, color: NORA_BLUE, lineHeight: 1.4, fontWeight: 500 }}>
                {euroN(bridge.savingsAmount)} goal · {euroN(bridge.futureFundsAmount)} future funds
              </div>
            </div>
          </div>
        )}
        {items.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <NIcon name={row.icon || 'credit-card'} size={16} color={NORA_BLUE} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{row.name}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>{row.sub}</div>
              {row.detail && (
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 3, fontWeight: 500 }}>{row.detail}</div>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums lining-nums' }}>−{euroN(row.monthlyAmount ?? weeklyToMonthly(row.weeklyAmount))}/mo</div>
          </div>
        ))}
      </div>
      {data.reviewHabit && (
        <div style={{ margin: '0 20px 12px', padding: '12px 14px', background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <NIcon name={data.reviewHabit.icon || 'calendar-check'} size={14} color={NORA_BLUE} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: NORA_BLUE, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>Monthly habit</div>
            <div style={{ fontSize: 12, color: NORA_BLUE, lineHeight: 1.45, fontWeight: 500 }}>{data.reviewHabit.action}</div>
          </div>
        </div>
      )}
      {window.TrustNote && <window.TrustNote text={data.trustNote} />}
    </InChatCard>
  );
}

function FullLessonCard({ data }) {
  const [risk, setRisk] = React.useState(2);
  const [selected, setSelected] = React.useState(null);
  const profiles = {
    1: { name: 'Steady',   growth: '+1.5% / yr', mix: '95% savings · 5% funds',  desc: 'You barely feel the ups and downs.',                      color: '#1f7a4d' },
    2: { name: 'Balanced', growth: '+4.2% / yr', mix: '70% savings · 30% funds', desc: 'A bit of growth, with some normal wobble along the way.', color: NORA_BLUE },
    3: { name: 'Growth',   growth: '+6.8% / yr', mix: '40% savings · 60% funds', desc: 'Bigger gains over years — but real dips in any given year.', color: '#7a3eb3' },
  };
  const p = profiles[risk];
  const opts = data.checkOptions || [];

  return (
    <InChatCard eyebrow={data.headline ? `Lesson · ${data.headline}` : 'Risk feel · live preview'} vibe="balanced">
      <div style={{ padding: '20px 20px 22px' }}>
        {data.body && (
          <div style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.55, marginBottom: 18 }}>{data.body}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: p.color, letterSpacing: '-0.01em' }}>{p.name}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: p.color, fontVariantNumeric: 'tabular-nums lining-nums' }}>{p.growth}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 18 }}>{p.desc}</div>

        <RiskChartSvg risk={risk} color={p.color} />

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
            <span>Steady</span><span>Balanced</span><span>Growth</span>
          </div>
          <input type="range" min={1} max={3} step={1} value={risk}
                 onChange={(e) => setRisk(Number(e.target.value))}
                 style={{ width: '100%', accentColor: NORA_BLUE, height: 6 }} />
        </div>

        <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--bg-page)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>The mix</div>
          <MixBarSvg risk={risk} />
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums lining-nums' }}>{p.mix}</div>
        </div>

        {data.checkQuestion && opts.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 10 }}>{data.checkQuestion}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {opts.map((opt, i) => {
                const isCorrect = i === data.correctIndex;
                const isSelected = selected === i;
                let bg = 'var(--bg-page)', border = 'var(--border-1)', color = 'var(--fg-1)';
                if (selected !== null) {
                  if (isCorrect) { bg = 'var(--success-bg)'; border = 'var(--success)'; color = 'var(--success)'; }
                  else if (isSelected) { bg = 'var(--danger-bg)'; border = 'var(--danger)'; color = 'var(--danger)'; }
                }
                return (
                  <button key={i} onClick={() => setSelected(i)} disabled={selected !== null} style={{
                    background: bg, border: `1px solid ${border}`, borderRadius: 8,
                    padding: '9px 12px', textAlign: 'left', fontSize: 13, fontWeight: 500,
                    color, cursor: selected !== null ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {data.progress && (
          <div style={{
            marginTop: 16, padding: '8px 12px',
            background: 'var(--blue-50)', border: '1px solid var(--blue-100)',
            borderRadius: 8, fontSize: 12, fontWeight: 500, color: NORA_BLUE,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <NIcon name="trending-up" size={14} color={NORA_BLUE} />
            <span>{data.progress.domain}: <strong>{data.progress.status}</strong></span>
          </div>
        )}
      </div>
      {window.TrustNote && <window.TrustNote text={data.trustNote} />}
    </InChatCard>
  );
}

function fmtQty(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatDisplayDate(value) {
  if (!value) return 'latest';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function PortfolioSummaryCard({ data }) {
  const positions = data.positions || [];
  const gainPositive = Number(data.unrealizedGain || 0) >= 0;
  return (
    <div style={{ width: 'calc(100% - 38px)', marginLeft: 38 }}>
      <InChatCard eyebrow={`Portfolio · ${formatDisplayDate(data.asOf)}`} vibe="balanced">
        <div style={{ padding: '16px 20px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
            {data.title || 'Portfolio summary'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 2 }}>Market value</div>
              <MoneyDisplay value={data.marketValue || 0} size={28} color="var(--fg-1)" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 2 }}>Unrealized gain</div>
              <div style={{ fontSize: 25, fontWeight: 750, color: gainPositive ? '#147a4a' : '#9b1c1c', lineHeight: 1.05 }}>
                {gainPositive ? '+' : ''}{euroN(data.unrealizedGain || 0)}
              </div>
            </div>
          </div>
          {data.linkedGoalName && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>
              Linked goal: <strong style={{ color: 'var(--fg-2)' }}>{data.linkedGoalName}</strong>
            </div>
          )}
          {positions.map((row, i) => (
            <div key={row.ticker || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border-1)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <NIcon name={row.assetType === 'etf' ? 'layers' : 'line-chart'} size={15} color={NORA_BLUE} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>{row.ticker}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fmtQty(row.quantity)} shares · {row.name}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: Number(row.unrealizedGain || 0) >= 0 ? '#147a4a' : '#9b1c1c' }}>
                  {Number(row.unrealizedGain || 0) >= 0 ? '+' : ''}{euroN(row.unrealizedGain || 0)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{Number(row.unrealizedGainPct || 0) >= 0 ? '+' : ''}{row.unrealizedGainPct}%</div>
              </div>
            </div>
          ))}
        </div>
      </InChatCard>
    </div>
  );
}

function MarketSnapshotCard({ data }) {
  const holding = data.userHolding;
  return (
    <div style={{ width: 'calc(100% - 38px)', marginLeft: 38 }}>
      <InChatCard eyebrow="Market snapshot" vibe="balanced">
        <div style={{ padding: '16px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 750, color: 'var(--fg-1)' }}>{data.name || data.ticker}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 600 }}>{data.ticker}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 25, fontWeight: 800, color: 'var(--fg-1)', lineHeight: 1.05 }}>
                {data.price ? `${data.price} ${data.currency || ''}` : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600 }}>current price</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: holding ? 14 : 0 }}>
            <Metric label="52-week low" value={data.week52Low ? `${data.week52Low}` : '—'} />
            <Metric label="52-week high" value={data.week52High ? `${data.week52High}` : '—'} />
            <Metric label="P/E ratio" value={data.peRatio || '—'} />
            <Metric label="Market cap" value={data.marketCap || '—'} />
          </div>
          {holding && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--blue-50)', border: '1px solid var(--blue-100)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: NORA_BLUE, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>Your holding</div>
                <div style={{ fontSize: 12, color: NORA_BLUE, fontWeight: 500 }}>{fmtQty(holding.quantity)} shares</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: NORA_BLUE, fontWeight: 750 }}>
                  {data.currency === 'EUR' ? euroN(holding.estimatedValue || 0) : `${holding.estimatedValue} ${data.currency || ''}`}
                </div>
                <div style={{ fontSize: 11, color: NORA_BLUE }}>{Number(holding.unrealizedGainPct || 0) >= 0 ? '+' : ''}{holding.unrealizedGainPct}% from buy price</div>
              </div>
            </div>
          )}
        </div>
      </InChatCard>
    </div>
  );
}

function EtfOverviewCard({ data }) {
  const examples = data.examples || [];
  return (
    <div style={{ width: 'calc(100% - 38px)', marginLeft: 38 }}>
      <InChatCard eyebrow="ETF research" vibe="balanced">
        <div style={{ padding: '16px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <NIcon name="layers" size={19} color={NORA_BLUE} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 750, color: 'var(--fg-1)', lineHeight: 1.2 }}>{data.title || 'ETF examples'}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, marginTop: 2 }}>Educational examples, not a buy list</div>
            </div>
          </div>

          {data.explanation && (
            <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--fg-2)', marginBottom: 12 }}>
              {data.explanation}
            </div>
          )}

          {examples.map((row, i) => (
            <div key={row.ticker || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border-1)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <NIcon name="line-chart" size={15} color={NORA_BLUE} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--fg-1)' }}>{row.ticker}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 650 }}>{row.region}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.35, marginTop: 1 }}>{row.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.35, marginTop: 3 }}>{row.style}. {row.note}</div>
              </div>
            </div>
          ))}

          {data.nextStep && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--blue-50)', border: '1px solid var(--blue-100)', fontSize: 12, lineHeight: 1.4, color: NORA_BLUE, fontWeight: 600 }}>
              {data.nextStep}
            </div>
          )}
        </div>
        {window.TrustNote && <window.TrustNote text={data.safetyNote} />}
      </InChatCard>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ padding: '9px 10px', borderRadius: 9, background: 'var(--bg-page)', border: '1px solid var(--border-1)' }}>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

// ── Compact preview cards (rendered IN CHAT) ───────────────────────────────
function LessonPreviewChip({ data, onOpen }) {
  return (
    <div style={{ width: 'calc(100% - 38px)', marginLeft: 38 }}>
      <button onClick={onOpen} className="card-in" style={{
        width: '100%',
        background: '#fff',
        border: '1px solid var(--border-1)',
        borderRadius: 14,
        padding: '14px 16px',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = NORA_BLUE; e.currentTarget.style.background = 'var(--blue-50)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.background = '#fff'; }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'var(--blue-50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NIcon name="graduation-cap" size={20} color={NORA_BLUE} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
            {data.progress ? `${data.progress.domain} · ${data.progress.status}` : 'Lesson · 30s'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.35 }}>
            {data.headline || 'How risk works'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: NORA_BLUE, flexShrink: 0 }}>
          Open in Learn
          <NIcon name="arrow-right" size={14} color={NORA_BLUE} strokeWidth={2.5} />
        </div>
      </button>
    </div>
  );
}

function ExpensePreviewChip({ data, onOpen }) {
  const monthlyRoom = data.monthlyRoom ?? weeklyToMonthly(data.weeklyRoom);
  return (
    <div style={{ width: 'calc(100% - 38px)', marginLeft: 38 }}>
      <button onClick={onOpen} className="card-in" style={{
        width: '100%',
        background: '#fff',
        border: '1px solid var(--border-1)',
        borderRadius: 14,
        padding: '14px 16px',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = NORA_BLUE; e.currentTarget.style.background = 'var(--blue-50)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.background = '#fff'; }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'var(--blue-50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NIcon name="receipt" size={20} color={NORA_BLUE} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
            Spending review
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.35 }}>
            €{monthlyRoom}/mo to redirect · {(data.items || []).length} categories
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: NORA_BLUE, flexShrink: 0 }}>
          Open in Spending
          <NIcon name="arrow-right" size={14} color={NORA_BLUE} strokeWidth={2.5} />
        </div>
      </button>
    </div>
  );
}

// Compact preview chip for resource_link cards (Nora suggested a catalog item).
function ResourceLinkChip({ data, onOpen }) {
  const r = data.resource || {};
  const formatMeta = {
    article: { icon: 'file-text',   label: 'Article' },
    video:   { icon: 'play-circle', label: 'Video' },
    podcast: { icon: 'headphones',  label: 'Podcast' },
  };
  const meta = formatMeta[r.format] || formatMeta.article;
  const time = r.estimatedMinutes ? `${r.estimatedMinutes} min` : '';

  return (
    <div style={{ width: 'calc(100% - 38px)', marginLeft: 38 }}>
      <button onClick={onOpen} className="card-in" style={{
        width: '100%',
        background: '#fff',
        border: '1px solid var(--border-1)',
        borderRadius: 14, padding: '14px 16px',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = NORA_BLUE; e.currentTarget.style.background = 'var(--blue-50)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.background = '#fff'; }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'var(--blue-50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NIcon name={meta.icon} size={20} color={NORA_BLUE} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
            {meta.label}{time ? ` · ${time}` : ''} · {r.source}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.35 }}>
            {r.title}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: NORA_BLUE, flexShrink: 0 }}>
          Open in Learn
          <NIcon name="arrow-right" size={14} color={NORA_BLUE} strokeWidth={2.5} />
        </div>
      </button>
    </div>
  );
}

function CompactGoalRef({ data, onOpen }) {
  return (
    <div style={{ width: 'calc(100% - 38px)', marginLeft: 38 }}>
      <button onClick={onOpen} style={{
        background: 'var(--blue-50)',
        border: `1px solid var(--blue-100)`,
        borderRadius: 999,
        padding: '6px 12px 6px 8px',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        color: NORA_BLUE, fontSize: 12, fontWeight: 600,
      }}>
        <NIcon name={data.icon || 'target'} size={14} color={NORA_BLUE} />
        {data.label} · €{data.targetAmount}
        <NIcon name="arrow-up-right" size={12} color={NORA_BLUE} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ── Local helpers ──────────────────────────────────────────────────────────
const WEEKS_PER_MONTH = 4.33;

function weeklyToMonthly(value) {
  return Math.round(Number(value || 0) * WEEKS_PER_MONTH);
}

function goalMonthlyAmount(data = {}) {
  if (Number.isFinite(Number(data.monthlyTransfer))) return Math.round(Number(data.monthlyTransfer));
  return weeklyToMonthly(data.weeklyTransfer);
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function RiskChartSvg({ risk, color }) {
  const paths = {
    1: 'M0,40 C40,38 80,36 120,34 C160,32 200,30 240,28 C260,27 280,26 300,25',
    2: 'M0,42 C25,30 50,46 75,32 C100,40 130,22 160,30 C190,18 220,32 250,16 C275,22 290,10 300,8',
    3: 'M0,46 C20,18 40,55 65,28 C90,55 115,8 145,38 C170,12 200,52 225,18 C250,40 275,2 300,18',
  };
  const path = paths[risk] || paths[2];
  return (
    <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`riskfill-tab-${risk}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L300,60 L0,60 Z`} fill={`url(#riskfill-tab-${risk})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function MixBarSvg({ risk }) {
  const splits = { 1: [95, 5], 2: [70, 30], 3: [40, 60] };
  const [savings, funds] = splits[risk];
  return (
    <div style={{ display: 'flex', width: '100%', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--blue-100)' }}>
      <div style={{ width: `${savings}%`, height: '100%', background: NORA_BLUE, transition: 'width 320ms cubic-bezier(.2,0,0,1)' }} />
      <div style={{ width: `${funds}%`, height: '100%', background: '#7a7afe', transition: 'width 320ms cubic-bezier(.2,0,0,1)' }} />
    </div>
  );
}

Object.assign(window, {
  Drawer, GoalsTab, LearnTab, SpendingTab, MemoryTab,
  FullGoalCard, FullExpenseCard, FullLessonCard,
  PortfolioSummaryCard, MarketSnapshotCard, EtfOverviewCard,
  LessonPreviewChip, ExpensePreviewChip, CompactGoalRef,
  ResourceLinkChip, ResourceCard, ResourceDetail,
});
