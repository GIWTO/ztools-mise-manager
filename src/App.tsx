import { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "./components/Dashboard";
import ToolManager from "./components/ToolManager";
import Market from "./components/Market";
import Projects from "./components/Projects";
import type { InstalledTool, OutdatedItem, SystemInfo } from "./types";

type TabKey = "dashboard" | "tools" | "market" | "projects";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "仪表盘", icon: "📊" },
  { key: "tools", label: "工具管理", icon: "🛠️" },
  { key: "market", label: "工具市场", icon: "🧩" },
  { key: "projects", label: "项目配置", icon: "📁" },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [tools, setTools] = useState<InstalledTool[]>([]);
  const [outdated, setOutdated] = useState<OutdatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const refresh = useCallback(async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    try {
      const [info, ls] = await Promise.all([
        window.miseManager.getSystemInfo(),
        window.miseManager.getInstalledTools(),
      ]);
      setSysInfo(info);
      if (ls.ok) setTools(ls.tools);
      const od = await window.miseManager.getOutdated();
      if (od.ok) setOutdated(od.list);
    } catch (e) {
      console.error("refresh failed", e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(true), 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const openTool = (tool: string) => {
    setSelectedTool(tool);
    setTab("tools");
  };

  const outdatedMap = new Map(outdated.map((o) => [o.tool, o]));

  return (
    <div className="app">
      <header className="header">
        <img src="./logo.png" alt="logo" className="logo" />
        <div className="app-title">
          Mise 控制台
          <span className="sub">开发工具版本管理</span>
        </div>
        <div className="status-bar">
          {sysInfo?.missing ? (
            <span className="status-chip">
              <span className="dot err" /> mise 未检测到
            </span>
          ) : (
            <>
              <span className="status-chip" title="mise 版本">
                <span className="dot" /> v{sysInfo?.version || "…"}
              </span>
              <span className="status-chip" title="已装工具数量">
                🧰 {tools.length} 个工具
              </span>
              <span className="status-chip" title="可升级工具">
                <span className={`dot ${outdated.length ? "warn" : ""}`} /> 升级 {outdated.length}
              </span>
              <span className="status-chip" title="配置文件路径">
                📄 {sysInfo?.configPath || "…"}
              </span>
            </>
          )}
          <button className="btn sm" onClick={() => refresh()} title="刷新">
            <span className={loading ? "spin" : ""}>🔄</span> 刷新
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span> {t.label}
            {t.key === "dashboard" && outdated.length > 0 && (
              <span className="badge warn">{outdated.length}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="content fade-in">
        {sysInfo?.missing ? (
          <div className="missing-banner">
            <strong>未检测到 mise。</strong> 请先安装 mise：
            <code> winget install jdx.mise </code> 或访问{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.miseManager.openExternal("https://mise.jdx.dev");
              }}
            >
              https://mise.jdx.dev
            </a>
          </div>
        ) : null}

        {tab === "dashboard" && (
          <Dashboard tools={tools} outdatedMap={outdatedMap} loading={loading} onOpenTool={openTool} />
        )}
        {tab === "tools" && (
          <ToolManager tools={tools} selectedTool={selectedTool} onSelectTool={setSelectedTool} onChanged={refresh} />
        )}
        {tab === "market" && <Market onChanged={refresh} />}
        {tab === "projects" && <Projects onChanged={refresh} />}
      </main>
    </div>
  );
}
