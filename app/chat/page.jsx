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

export default function ChatPage() {
  const [user, setUser] = useState(undefined);
  const [channels, setChannels] = useState([]);
  const [active, setActive] = useState('group');
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      const a = await fetch('/api/auth/check').then((r) => r.json()).catch(() => ({}));
      const u = a && a.user ? a.user : null;
      setUser(u);
      if (!u) return;
      const list = [{ id: 'group', label: 'Everyone (group)', icon: '👥' }];
      if (u.role === 'admin') {
        const data = await fetch('/api/assignments').then((r) => r.json()).catch(() => ({}));
        const people = Array.isArray(data?.assignments) ? data.assignments : [];
        for (const p of people) {
          if (p.person) list.push({ id: `dm:${p.person}`, label: p.person, icon: '👤' });
        }
      } else {
        list.push({ id: `dm:${u.name}`, label: 'Admins (private)', icon: '🛡️' });
      }
      setChannels(list);
    })();
  }, []);

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

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, active]);

  async function send() {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setText('');
    const optimistic = { id: `tmp-${Date.now()}`, senderId: me, senderName: 'You', senderRole: user.role, text: clean, ts: new Date().toISOString(), _pending: true };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: active, text: clean }),
      });
      const d = await parseJsonSafe(res);
      if (!res.ok) { setError(d.error || 'Could not send'); }
      await load(active);
    } catch { setError('Could not send'); }
    finally { setSending(false); }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
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
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">💬 Chat</h2>
        <p className="text-sm text-slate-500">Message the team. The group includes everyone; private chats are just you and the admins.</p>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ height: '70vh', minHeight: 420 }}>
        <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-brand-700 to-field-700 text-white flex items-center gap-2">
          <span className="text-lg">{activeIcon}</span>
          <div className="font-semibold text-sm">{activeLabel}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2" style={{ background: '#eef2f6' }}>
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
                      <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                      <div className={`text-[10px] mt-0.5 text-right ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                        {m._pending ? 'sending…' : timeLabel(m.ts)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-100 p-2 flex items-end gap-2 bg-white">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
            className="flex-1 resize-none px-3 py-2 text-sm border border-slate-300 rounded-2xl max-h-32 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button onClick={send} disabled={sending || !text.trim()}
            className="shrink-0 w-10 h-10 rounded-full bg-field-600 text-white flex items-center justify-center hover:bg-field-700 disabled:bg-slate-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">Messages refresh every few seconds. Private chats are visible to you and all admins.</p>
    </div>
  );
}
