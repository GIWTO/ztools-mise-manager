import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InstalledTool, TaskProgress } from "../types";

interface Props {
  tools: InstalledTool[];
  selectedTool: string | null;
  onSelectTool: (t: string) => void;
  onChanged: (silent?: boolean) => void;
}

export default function ToolManager({ tools, selectedTool, onSelectTool, onChanged }: Props) {
  const [query, setQuery] = useState("");
  const [remoteVersions, setRemoteVersions] = useState<string[]>([]);
  const [remoteQuery, setRemoteQuery] = useState("");
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [toolInfo, setToolInfo] = useState("");
  const [task, setTask] = useState<TaskProgress | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 记录当前进行中的操作名
  const taskRef = useRef<{ tool: string; version: string } | null>(null);

  const tool = tools.find((t) => t.name === selectedTool) || null;

  const loadRemote = useCallback(async (name: string) => {
    if (!name) return;
    setLoadingRemote(true);
    setToolInfo("");
    try {
      const [res, info] = await Promise.all([
        window.miseManager.getRemoteVersions(name),
        window.miseManager.getToolInfo(name),
      ]);
      setRemoteVersions(res.ok ? res.versions : []);
      if (!res.ok) setRemoteQuery(""); // 保持查询
      setToolInfo(info.text);
    } finally {
      setLoadingRemote(false);
    }
  }, []);

  useEffect(() => {
    if (tool) {
      setRemoteVersions([]);
      setRemoteQuery("");
      loadRemote(tool.name);
    }
  }, [tool?.name, loadRemote]);

  const filteredRemote = useMemo(() => {
    const q = remoteQuery.trim().toLowerCase();
    if (!q) return remoteVersions;
    return remoteVersions.filter((v) => v.toLowerCase().includes(q));
  }, [remoteVersions, remoteQuery]);

  // 安装进度回调（通过 ref 避免闭包过期）
  const onProgressRef = useRef<(p: number) => void>(() => {});
  const onLogRef = useRef<(t: string) => void>(() => {});
  onProgressRef.current = (p) => {
    setTask((prev) => (prev ? { ...prev, percent: p } : prev));
  };
  onLogRef.current = (t) => {
    setTask((prev) => (prev ? { ...prev, logs: [...prev.logs.slice(-200), t] } : prev));
  };

  const runInstall = async (version: string, projectMode = false) => {
    if (!tool || task?.running) return;
    taskRef.current = { tool: tool.name, version };
    setTask({ tool: tool.name, version, percent: 0, logs: [], running: true });
    setBusy(`install:${version}`);
    try {
      if (projectMode) {
        const projPath = await window.miseManager.selectFolder();
        if (!projPath) {
          setTask(null);
          return;
        }
        await window.miseManager.setProject(tool.name, version, projPath);
        window.miseManager.notify("mise", `已写入 ${projPath} 的 .mise.toml: ${tool.name}@${version}`);
      } else {
        await window.miseManager.install(tool.name, version, {
          onProgress: onProgressRef.current,
          onLog: onLogRef.current,
        });
        window.miseManager.notify("mise", `安装成功: ${tool.name}@${version}`);
      }
      onChanged();
      setTimeout(() => setTask(null), 800);
    } catch (e) {
      setTask((prev) => (prev ? { ...prev, running: false, error: String(e) } : prev));
      window.miseManager.notify("mise 安装失败", String(e).slice(0, 200));
    } finally {
      setBusy(null);
    }
  };

  const runSetGlobal = async (version: string) => {
    if (!tool || busy) return;
    setBusy(`global:${version}`);
    try {
      await window.miseManager.setGlobal(tool.name, version);
      window.miseManager.notify("mise", `全局切换: ${tool.name}@${version}`);
      onChanged();
    } catch (e) {
      window.miseManager.notify("切换失败", String(e).slice(0, 200));
    } finally {
      setBusy(null);
    }
  };

  const runUninstall = async (version: string) => {
    if (!tool) return;
    if (!window.confirm(`确认卸载 ${tool.name}@${version}？`)) return;
    setBusy(`uninstall:${version}`);
    try {
      await window.miseManager.uninstall(tool.name, version);
      window.miseManager.notify("mise", `已卸载: ${tool.name}@${version}`);
      onChanged();
    } catch (e) {
      window.miseManager.notify("卸载失败", String(e).slice(0, 200));
    } finally {
      setBusy(null);
    }
  };

  const filteredTools = tools.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));

  const installedVersions = tool?.versions.slice().sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true })) || [];

  return (
    <div className="split">
      <div className="split-left">
        <div style={{ padding: 10 }}>
          <input
            className="search-input"
            style={{ width: "100%", maxWidth: "none" }}
            placeholder="过滤工具…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {filteredTools.map((t) => (
          <div
            key={t.name}
            className={`tool-list-item ${t.name === selectedTool ? "active" : ""}`}
            onClick={() => onSelectTool(t.name)}
          >
            <span className="tl-name">{t.name}</span>
            <span className="tl-ver">{t.activeVersion || "—"}</span>
          </div>
        ))}
        {filteredTools.length === 0 && <div className="empty-hint">无匹配工具</div>}
      </div>

      <div className="split-right">
        {!tool ? (
          <div className="empty-hint">← 从左侧选择一个工具</div>
        ) : (
          <div className="fade-in">
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <h2 style={{ fontSize: 18 }}>
                {tool.name}{" "}
                <span style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "Consolas, monospace" }}>
                  {tool.activeVersion || "未激活"}
                </span>
              </h2>
              <div style={{ marginLeft: "auto" }}>
                <button className="btn sm" onClick={() => loadRemote(tool.name)} disabled={loadingRemote}>
                  🔄 刷新
                </button>
              </div>
            </div>

            {toolInfo && (
              <>
                <div className="section-title">工具信息</div>
                <pre className="detail-pre">{toolInfo}</pre>
              </>
            )}

            <div className="section-title">已安装版本</div>
            {installedVersions.length === 0 && <div className="empty-hint" style={{ padding: 20 }}>暂无已安装版本</div>}
            {installedVersions.map((v) => (
              <div key={v.version} className={`version-row ${v.active ? "active-row" : ""}`}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="vr-ver">
                    {v.version}
                    {v.active && <span className="badge active" style={{ marginLeft: 8 }}>● 激活</span>}
                  </div>
                  <div className="vr-req">
                    {v.requested && v.requested !== v.version ? `配置请求: ${v.requested}` : ""}
                    {v.source ? ` · ${v.source}` : ""}
                  </div>
                </div>
                <div className="vr-actions">
                  {!v.active && (
                    <button className="btn sm primary" disabled={!!busy} onClick={() => runSetGlobal(v.version)}>
                      ⭐ 设为全局
                    </button>
                  )}
                  {v.installPath && (
                    <button
                      className="btn sm"
                      onClick={() => window.miseManager.openInstallDir(tool.name, v.version)}
                    >
                      📂
                    </button>
                  )}
                  <button className="btn sm danger" disabled={!!busy} onClick={() => runUninstall(v.version)}>
                    🗑
                  </button>
                </div>
              </div>
            ))}

            <div className="section-title">
              远程可装版本
              {!loadingRemote && remoteVersions.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-faint)" }}>
                  {remoteVersions.length} 个版本
                </span>
              )}
            </div>
            <input
              className="search-input"
              style={{ width: "100%", maxWidth: "none", marginBottom: 10 }}
              placeholder="过滤版本… 输入完整版本号精确安装，如 22.11.0"
              value={remoteQuery}
              onChange={(e) => setRemoteQuery(e.target.value)}
            />

            {loadingRemote ? (
              <div className="loading-hint">🔄 正在获取远程版本列表…</div>
            ) : remoteVersions.length === 0 ? (
              <div className="empty-hint" style={{ padding: 20 }}>
                无远程版本信息
              </div>
            ) : (
              <div className="remote-list">
                {filteredRemote.length > 40 ? (
                  <>
                    {filteredRemote.slice(-40).reverse().map((v) => (
                      <RemoteRow key={v} v={v} installed={installedVersions.some((i) => i.version === v)} busy={!!busy || !!task?.running} onInstall={() => runInstall(v)} />
                    ))}
                    <div style={{ padding: 10, textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>
                      仅显示最新 40 个版本，输入关键词可精确过滤
                    </div>
                  </>
                ) : (
                  filteredRemote
                    .slice()
                    .reverse()
                    .map((v) => (
                      <RemoteRow key={v} v={v} installed={installedVersions.some((i) => i.version === v)} busy={!!busy || !!task?.running} onInstall={() => runInstall(v)} />
                    ))
                )}
              </div>
            )}

            {task && (
              <div className="progress-wrap fade-in">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${task.percent}%` }} />
                </div>
                <div className="progress-text">
                  <span>
                    {task.running ? "⏳ 正在安装" : task.error ? "❌ 失败" : "✅ 完成"}: {task.tool}@{task.version}
                  </span>
                  <span>{task.percent}%</span>
                </div>
                {task.logs.length > 0 && <div className="log-box">{task.logs.join("")}</div>}
                {task.error && <div className="error-banner" style={{ marginTop: 8 }}>{task.error}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteRow({ v, installed, busy, onInstall }: { v: string; installed: boolean; busy: boolean; onInstall: () => void }) {
  return (
    <div className="remote-item">
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {v}
        {installed && <span className="badge" style={{ marginLeft: 8 }}>已装</span>}
      </span>
      <button className="btn sm primary" disabled={installed || busy} onClick={onInstall}>
        ⬇ 安装
      </button>
    </div>
  );
}
