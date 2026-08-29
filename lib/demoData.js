// ---------------------------------------------------------------------------
// Guests see the REAL project data (read-only, capped) everywhere EXCEPT chat:
// the group chat is faked here so a guest never sees the team's real private
// conversation.
// ---------------------------------------------------------------------------

const DEMO_SURVEYORS = ['Aman', 'Bikram', 'Chandni'];

// Fake group-chat so guests never see the real team's messages.
export function getDemoChat() {
  const now = Date.now();
  const mk = (i, name, role, text, minsAgo) => ({
    id: `demo-msg-${i}`, channel: 'group', from: `demo-${name}`, name, role,
    text, kind: 'text', reactions: {}, ts: new Date(now - minsAgo * 60000).toISOString(),
  });
  return [
    mk(1, 'Project Admin', 'admin', 'Good morning team — please upload today’s readings when you can.', 620),
    mk(2, DEMO_SURVEYORS[0], 'user', 'Morning! First village done ✅', 585),
    mk(3, DEMO_SURVEYORS[1], 'user', 'Meters read, uploading now.', 560),
    mk(4, DEMO_SURVEYORS[2], 'user', 'One meter reading looks a bit off, I’ll re-check tomorrow.', 505),
    mk(5, 'Project Admin', 'admin', 'Great work everyone 👏', 470),
    mk(6, DEMO_SURVEYORS[0], 'user', 'One reading photo was blurry, re-took it 📸', 110),
  ];
}
