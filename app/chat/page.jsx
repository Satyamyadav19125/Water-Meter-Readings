'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date(); const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// Resize an image to max 800px / JPEG 0.75 so it fits the media API limit.
function resizeImage(file, maxDim = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMOJIS = ['😀','😂','👍','🙏','✅','❌','💧','🌾','🔥','🎉','❤️','😅','🤔','👏','🚩','📸','🏃','☔','☀️','💪'];

export default function ChatPage() {
  const [user, setUser] = useState(undefined);
  const [channels, setChannels] = useState([]);
  const [active, setActive] = useState('group');
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showPlus, setShowPlus] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      // Parallel: auth + assignments at the same time (faster open).
      const [a, asg] = await Promise.all([
        fetch('/api/auth/check').then((r) => r.json()).catch(() => ({})),
        fetch('/api/assignments').then((r) => r.json()).catch(() => ({})),
      ]);
      const u = a && a.user ? a.user : null;
      setUser(u);
      if (!u) return;
      const list = [{ id: 'group', label: 'Everyone', icon: '👥' }];
      if (u.role === 'admin') {
        const people = Array.isArray(asg?.assignments) ? asg.assignments : [];
        for (const p of people) {
          if (p.person) list.push({ id: `dm:${p.person}`, label: p.person, icon: '👤' });
        }
      } else {
        list.push({ id: `dm:${u.name}`, label: 'Admins (private)', icon: '🛡️' });
      }
      setChannels(list);
    })();
  }, []);

  // Scroll ONLY the message container — never the page itself.
  // (scrollIntoView was scrolling the whole document, which is why tapping
  // a channel chip made the page jump down.)
  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  const load = useCallback(async (channel) => {
    try {
      const res = await fetch(`/api/chat?channel=${encodeURIComponent(channel)}`);
      const d = await parseJsonSafe(res);
      if (!res.ok) { setError(d.error || 'Could not load chat'); return; }
      setError('');
      setMe(d.me || '');
      setMessages(Array.isArray(d.messages) ? d.messages : []);
    } catch { setError('Could not load chat'); }
  }, []);

  useEffect(() => {
    if (!user) return;
    load(active);
    const t = setInterval(() => load(active), 4000);
    return () => clearInterval(t);
  }, [user, active, load]);

  useEffect(() => { scrollToBottom(); }, [messages.length, active]);

  async function send({ imageUrl = '', forcedText = null } = {}) {
    const clean = (forcedText !== null ? forcedText : text).trim();
    if ((!clean && !imageUrl) || sending) return;
    setSending(true);
    if (forcedText === null) setText('');
    setShowPlus(false); setShowEmoji(false);
    const optimistic = { id: `tmp-${Date.now()}`, senderId: me, senderName: 'You', senderRole: user.role, text: clean, imageUrl, ts: new Date().toISOString(), _pending: true };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: active, text: clean, imageUrl }),
      });
      const d = await parseJsonSafe(res);
      if (!res.ok) { setError(d.error || 'Could not send'); }
      await load(active);
    } catch { setError('Could not send'); }
    finally { setSending(false); }
  }

  async function sendPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const dataUrl = await resizeImage(file);
      const res = await fetch('/api/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Photo upload failed');
      await send({ imageUrl: d.url, forcedText: text });
      setText('');
    } catch (e2) { setError(e2.message); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  function sendLocation() {
    setError('');
    if (!navigator.geolocation) { setError('Location is not available on this device/browser.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        send({ forcedText: `📍 My location: https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}` });
      },
      () => setError('Could not get your location. Allow location access and try again.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // Turn URLs in a message into tappable links (used for 📍 location).
  function renderText(t) {
    const parts = String(t).split(/(https?:\/\/[^\s]+)/g);
    return parts.map((p, i) =>
      /^https?:\/\//.test(p)
        ? <a key={i} href={p} target="_blank" rel="noreferrer" className="underline break-all">{p}</a>
        : <span key={i}>{p}</span>
    );
  }

  if (user === undefined) return <div className="h-64 bg-white rounded-xl shadow-sm animate-pulse" />;
  if (!user) return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
      <a href="/login" className="underline font-medium">Log in</a> to use chat.
    </div>
  );

  const activeLabel = channels.find((c) => c.id === active)?.label || 'Chat';
  const activeIcon = channels.find((c) => c.id === active)?.icon || '💬';

  const groups = [];
  let lastDay = null;
  for (const m of messages) {
    const dl = dayLabel(m.ts);
    if (dl !== lastDay) { groups.push({ day: dl, items: [] }); lastDay = dl; }
    groups[groups.length - 1].items.push(m);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {channels.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition flex items-center gap-1.5 ${
              active === c.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
            }`}>
            <span>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm text-amber-900">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100dvh - 200px)', minHeight: 380 }}>
        <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-brand-700 to-field-700 text-white flex items-center gap-2 shrink-0">
          <span className="text-lg">{activeIcon}</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{activeLabel}</div>
            <div className="text-[10px] text-white/70">{active === 'group' ? 'Everyone can read this' : 'You + all admins'}</div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2" style={{ background: '#eef2f6' }}>
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-slate-400 text-sm">
              No messages yet. Say hello 👋
            </div>
          ) : groups.map((g, gi) => (
            <div key={gi} className="space-y-2">
              <div className="flex justify-center">
                <span className="text-[11px] bg-white/80 text-slate-500 px-2 py-0.5 rounded-full shadow-sm">{g.day}</span>
              </div>
              {g.items.map((m) => {
                const mine = m.senderId === me || m._pending;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${mine ? 'bg-field-600 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm'}`}>
                      {!mine && (
                        <div className={`text-[11px] font-semibold mb-0.5 ${m.senderRole === 'admin' ? 'text-brand-700' : 'text-field-700'}`}>
                          {m.senderName}{m.senderRole === 'admin' ? ' · admin' : ''}
                        </div>
                      )}
                      {m.imageUrl && (
                        <button onClick={() => setLightbox(m.imageUrl)} className="block mb-1">
                          <img src={m.imageUrl} alt="" className="rounded-lg max-h-56 w-auto cursor-zoom-in" loading="lazy" />
                        </button>
                      )}
                      {m.text && <div className="text-sm whitespace-pre-wrap break-words">{renderText(m.text)}</div>}
                      <div className={`text-[10px] mt-0.5 text-right ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                        {m._pending ? 'sending…' : timeLabel(m.ts)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Emoji quick row */}
        {showEmoji && (
          <div className="border-t border-slate-100 px-2 py-1.5 flex gap-1 overflow-x-auto bg-white shrink-0">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setText((t) => t + e)} className="text-xl px-1.5 py-0.5 hover:bg-slate-100 rounded">{e}</button>
            ))}
          </div>
        )}

        {/* Plus / attach menu */}
        {showPlus && (
          <div className="border-t border-slate-100 px-3 py-2 flex gap-2 bg-white shrink-0">
            <button onClick={() => fileRef.current?.click()} className="attach-btn">📷<span>Photo</span></button>
            <button onClick={sendLocation} className="attach-btn">📍<span>Location</span></button>
          </div>
        )}

        <div className="border-t border-slate-100 p-2 flex items-end gap-1.5 bg-white shrink-0">
          <button onClick={() => { setShowPlus(!showPlus); setShowEmoji(false); }} title="Attach"
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xl transition ${showPlus ? 'bg-brand-100 text-brand-700 rotate-45' : 'text-slate-500 hover:bg-slate-100'}`}>+</button>
          <button onClick={() => { setShowEmoji(!showEmoji); setShowPlus(false); }} title="Emoji"
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg ${showEmoji ? 'bg-brand-100' : 'hover:bg-slate-100'}`}>😀</button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type a message…"
            className="flex-1 resize-none px-3 py-2 text-sm border border-slate-300 rounded-2xl max-h-32 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button onClick={() => send()} disabled={sending || !text.trim()}
            className="shrink-0 w-10 h-10 rounded-full bg-field-600 text-white flex items-center justify-center hover:bg-field-700 disabled:bg-slate-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={sendPhoto} className="hidden" />
        </div>
      </div>

      {/* Image lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[1300] bg-black/85 flex flex-col" onClick={() => setLightbox(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium">← Back</button>
            <a href={lightbox} target="_blank" rel="noreferrer" className="text-xs text-white/80 underline">Open original ↗</a>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.attach-btn) {
          display: flex; align-items: center; gap: 0.375rem;
          font-size: 0.8rem; padding: 0.5rem 0.875rem; border-radius: 9999px;
          border: 1px solid #cbd5e1; background: white;
        }
        :global(.attach-btn:hover) { background: #f8fafc; }
      `}</style>
    </div>
  );
}
