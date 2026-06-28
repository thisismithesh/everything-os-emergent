import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { Avatar } from "@/components/ui-bits";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// Parse @mentions: returns list of user_ids referenced by `@FirstName` matches.
function parseMentions(body, users) {
  if (!body || !users?.length) return [];
  const out = new Set();
  const lower = body.toLowerCase();
  for (const u of users) {
    const first = (u.name || "").split(" ")[0]?.toLowerCase();
    if (!first) continue;
    const re = new RegExp(`@${first}\\b`, "i");
    if (re.test(lower)) out.add(u.id);
  }
  return Array.from(out);
}

function renderBody(body, users) {
  if (!body) return null;
  const parts = body.split(/(@[A-Za-z]+)/g);
  return parts.map((p, i) => {
    if (p.startsWith("@")) {
      const name = p.slice(1).toLowerCase();
      const u = users.find((x) => (x.name || "").split(" ")[0].toLowerCase() === name);
      if (u) return <span key={i} className="text-[var(--accent)] font-semibold">{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

export default function Comments({ entityType, entityId, users = [] }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggest, setSuggest] = useState([]);
  const taRef = useRef(null);

  const load = () => api.get(`/comments?entity_type=${entityType}&entity_id=${entityId}`)
    .then((r) => setItems(r.data)).catch(() => setItems([]));
  useEffect(() => { if (entityId) load(); /* eslint-disable-next-line */ }, [entityId, entityType]);

  const onChange = (e) => {
    const v = e.target.value;
    setBody(v);
    // detect open @mention
    const caret = e.target.selectionStart;
    const upto = v.slice(0, caret);
    const m = upto.match(/@([A-Za-z]*)$/);
    if (m) {
      const q = m[1].toLowerCase();
      setSuggest(users.filter((u) => (u.name || "").toLowerCase().includes(q)).slice(0, 5));
      setShowSuggest(true);
    } else {
      setShowSuggest(false);
    }
  };

  const insertMention = (u) => {
    const v = body;
    const caret = taRef.current?.selectionStart ?? v.length;
    const upto = v.slice(0, caret);
    const after = v.slice(caret);
    const replaced = upto.replace(/@([A-Za-z]*)$/, `@${(u.name || "").split(" ")[0]} `);
    const newBody = replaced + after;
    setBody(newBody);
    setShowSuggest(false);
    // Set cursor position after the mention and space
    const newCursorPos = replaced.length;
    setTimeout(() => {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const mentions = parseMentions(body, users);
      await api.post("/comments", { entity_type: entityType, entity_id: entityId, body: body.trim(), mentions });
      setBody("");
      load();
    } catch { /* noop */ } finally { setBusy(false); }
  };

  const del = async (id) => { await api.delete(`/comments/${id}`).catch(() => {}); load(); };

  return (
    <div className="space-y-3" data-testid={`comments-${entityType}-${entityId}`}>
      <div className="space-y-3">
        {items.length === 0 && (
          <div className="text-xs text-[var(--text-tertiary)]">No comments yet. Start the conversation.</div>
        )}
        {items.map((c) => {
          const author = users.find((u) => u.id === c.user_id) || { name: c.user_name, avatar: c.user_avatar };
          const mine = user && c.user_id === user.id;
          return (
            <div key={c.id} className="flex gap-3" data-testid={`comment-${c.id}`}>
              <Avatar user={author} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{author.name}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{timeAgo(c.created_at)}</span>
                  {mine && (
                    <button onClick={() => del(c.id)} className="ml-auto text-[var(--text-tertiary)] hover:text-red-600" data-testid={`comment-delete-${c.id}`} aria-label="Delete comment"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <div className="text-sm text-[var(--text-primary)] mt-0.5 whitespace-pre-wrap leading-relaxed">{renderBody(c.body, users)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="relative">
        <textarea
          ref={taRef}
          value={body}
          onChange={onChange}
          rows={3}
          placeholder="Add a comment… Use @ to mention."
          data-testid="comment-input"
          className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--brand)] resize-none"
        />
        {showSuggest && suggest.length > 0 && (
          <div className="absolute z-10 left-0 bottom-full mb-1 bg-white border border-[var(--border-default)] rounded-md shadow-lg w-64 max-h-48 overflow-y-auto">
            {suggest.map((u) => (
              <button key={u.id} type="button" onClick={() => insertMention(u)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-surface-hover)]" data-testid={`mention-suggest-${u.id}`}>
                <Avatar user={u} size={20} />
                <span>{u.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-2">
          <button type="submit" disabled={busy || !body.trim()} data-testid="comment-submit-btn"
            className="px-3 py-1.5 text-sm bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50">
            {busy ? "Posting…" : "Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}