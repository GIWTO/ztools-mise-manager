import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RegistryTool, TaskProgress } from "../types";

interface Props {
  onChanged: (silent?: boolean) => void;
}

export default function Market({ onChanged }: Props) {
  const [registry, setRegistry] = useState<RegistryTool[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskProgress | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const logRef = useRef<(t: string) => void>(() => {});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.miseManager.getRegistry();
      if (res.ok) setRegistry(res.tools);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registry;
    return registry.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
        (t.backends || []).some((b) => b.toLowerCase().includes(q))
    );
  }, [registry, query]);

  logRef.current = (t) => {
    setTask((prev) => (prev ? { ...prev, logs: [...prev.logs.slice(-200), t] } : prev));
  };

  const runInstall = async (name: string) => {
    if (task?.running) return;
    setTask({ tool: name, version: "latest", percent: 0, logs: [], running: true });
    setBusyName(name);
    try {
      await window.miseManager.install(name, undefined, {
        onLog: logRef.current,
        onProgress: (p) => setTask((prev) => (prev ? { ...prev, percent: p } : prev)),
      });
      window.miseManager.notify("mise", `安装成功: ${name} (latest)`);
      onChanged();
      setTimeout(() => setTask(null), 800);
    } catch (e) {
      setTask((prev) => (prev ? { ...prev, running: false, error: String(e) } : prev));
      window.miseManager.notify("mise 安装失败", String(e).slice(0, 200));
    } finally {
      setBusyName(null);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="搜索工具市场… (如 node, python, ripgrep)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn" onClick={load} disabled={loading}>
          🔄 刷新
        </button>
        <span className="status-chip">{loading ? "加载中…" : `${filtered.length} / ${registry.length} 个工具`}</span>
      </div>

      {loading ? (
        <div className="loading-hint">🔄 正在加载工具市场…</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto", maxHeight: "calc(100vh - 240px)" }}>
          <table className="market-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>名称</th>
                <th>描述</th>
                <th style={{ width: 200 }}>后端</th>
                <th style={{ width: 90 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.name}>
                  <td className="mt-name">{t.name}</td>
                  <td className="mt-desc">{t.description || "—"}</td>
                  <td className="mt-backend">{t.backends[0] || "—"}</td>
                  <td>
                    <button className="btn sm primary" disabled={!!busyName} onClick={() => runInstall(t.name)}>
                      ⬇ 安装
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-hint">无匹配工具</div>}
        </div>
      )}

      {task && (
        <div className="progress-wrap fade-in">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${task.percent}%` }} />
          </div>
          <div className="progress-text">
            <span>{task.running ? "⏳ 正在安装" : task.error ? "❌ 失败" : "✅ 完成"}: {task.tool} (latest)</span>
            <span>{task.percent}%</span>
          </div>
          {task.logs.length > 0 && <div className="log-box">{task.logs.join("")}</div>}
          {task.error && <div className="error-banner" style={{ marginTop: 8 }}>{task.error}</div>}
        </div>
      )}
    </div>
  );
}
