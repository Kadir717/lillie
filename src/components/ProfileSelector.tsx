"use client";
import { useState, useRef, useEffect } from "react";

export interface CvProfileData {
  id: string;
  title: string;
  locale: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfileSelector({
  profiles,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  profiles: CvProfileData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (title: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = profiles.find((p) => p.id === selectedId);

  // Focus input when renaming or creating
  useEffect(() => {
    if ((creating || renaming) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating, renaming]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick() {
      setOpen(false);
      setCreating(false);
      setRenaming(null);
      setNewTitle("");
    }
    // Close after a short delay to let button clicks propagate
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
    };
  }, [open]);

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      await onCreate(title);
      setNewTitle("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      await onRename(id, title);
      setNewTitle("");
      setRenaming(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this profile? This cannot be undone.")) return;
    setBusy(true);
    try {
      await onDelete(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-coffee/60 text-sm text-cream/80 hover:text-cream transition-colors min-w-[200px] justify-between"
      >
        <span className="truncate">
          {selected ? selected.title : "Select profile..."}
        </span>
        <span className="text-xs opacity-50 shrink-0">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-50 bg-ink border border-coffee/60 rounded-lg overflow-hidden shadow-xl min-w-[240px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Existing profiles */}
          {profiles.length === 0 && !creating && (
            <p className="px-4 py-3 text-xs text-cream/40">
              No profiles yet. Create one below.
            </p>
          )}

          {profiles.map((p) =>
            renaming === p.id ? (
              <div key={p.id} className="flex items-center gap-1 px-2 py-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(p.id);
                    if (e.key === "Escape") {
                      setRenaming(null);
                      setNewTitle("");
                    }
                  }}
                  className="flex-1 bg-coffee/30 text-cream text-sm px-2 py-1 rounded border border-coffee outline-none"
                  placeholder="Profile name"
                />
                <button
                  onClick={() => handleRename(p.id)}
                  disabled={busy || !newTitle.trim()}
                  className="text-xs text-amber hover:text-amber-bright disabled:opacity-30 px-1"
                >
                  Save
                </button>
              </div>
            ) : (
              <div
                key={p.id}
                className={`flex items-center justify-between px-4 py-2 text-sm transition-colors cursor-pointer ${
                  p.id === selectedId
                    ? "bg-amber/20 text-cream font-semibold"
                    : "text-cream/70 hover:bg-coffee/30 hover:text-cream"
                }`}
              >
                <button
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className="flex-1 text-left truncate"
                >
                  {p.title}
                </button>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => {
                      setRenaming(p.id);
                      setNewTitle(p.title);
                    }}
                    className="text-xs text-cream/30 hover:text-cream/60 transition-colors px-1"
                    title="Rename"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={busy}
                    className="text-xs text-red-400/50 hover:text-red-400 transition-colors px-1 disabled:opacity-30"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          )}

          {/* Divider */}
          {profiles.length > 0 && !creating && (
            <div className="border-t border-coffee/30 mx-2" />
          )}

          {/* Create new */}
          {creating ? (
            <div className="flex items-center gap-1 px-2 py-2">
              <input
                ref={inputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewTitle("");
                  }
                }}
                className="flex-1 bg-coffee/30 text-cream text-sm px-2 py-1 rounded border border-coffee outline-none"
                placeholder="e.g. Software Engineer"
              />
              <button
                onClick={handleCreate}
                disabled={busy || !newTitle.trim()}
                className="text-xs text-amber hover:text-amber-bright disabled:opacity-30 px-1"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewTitle("");
                }}
                className="text-xs text-cream/40 hover:text-cream/70 px-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setCreating(true);
                setNewTitle("");
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-cream/50 hover:text-cream hover:bg-coffee/20 transition-colors"
            >
              <span className="text-amber text-base leading-none">+</span>
              New profile
            </button>
          )}
        </div>
      )}
    </div>
  );
}
