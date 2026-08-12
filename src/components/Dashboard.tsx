import { useMemo, useState } from "react";
import type { InstalledTool, OutdatedItem } from "../types";

interface Props {
  tools: InstalledTool[];
  outdatedMap: Map<string, OutdatedItem>;
  loading: boolean;
  onOpenTool: (tool: string) => void;
}

const TOOL_ICONS: Record<string, string> = {
  node: "⬢",
  python: "🐍",
  java: "☕",
  ruby: "💎",
  go: "🐹",
  rust: "🦀",
  dotnet: ".NET",
  maven: "M",
  gradle: "G",
  pnpm: "pnpm",
  npm: "npm",
  bun: "🥟",
  deno: "🦕",
  yarn: "yarn",
  terraform: "T",
  kubernetes: "☸",
  docker: "🐳",
  php: "🐘",
  lua: "🌙",
  kotlin: "K",
  swift: "🕊",
  elixir: "💧",
  erlang: "E",
  zig: "⚡",
  crystal: "💎",
  ocaml: "🐫",
  haskell: "λ",
  clojure: "🍄",
  julia: "julia",
  "1password": "🔐",
};

function iconOf(name: string): string {
  return TOOL_ICONS[name] || name.slice(0, 2).toUpperCase();
}

export default function Dashboard({ tools, outdatedMap, loading, onOpenTool }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.activeVersion || "").toLowerCase().includes(q)
    );
  }, [tools, query]);

  return (
    <div>
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="搜索工具或版本… (如 node, 22)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="status-chip">
          {loading ? "加载中…" : `共 ${tools.length} 个工具 / ${tools.reduce((s, t) => s + t.installCount, 0)} 个版本`}
        </span>
      </div>

      {loading && tools.length === 0 ? (
        <div className="loading-hint">🔄 正在读取 mise 环境…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-hint">没有匹配的工具</div>
      ) : (
        <div className="grid">
          {filtered.map((tool) => {
            const od = outdatedMap.get(tool.name);
            return (
              <div key={tool.name} className="tool-card" onClick={() => onOpenTool(tool.name)}>
                <div className="tool-head">
                  <div className="tool-icon" style={{ fontSize: tool.name === "dotnet" ? 12 : 20 }}>
                    {iconOf(tool.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="tool-name">{tool.name}</div>
                    <div className="tool-ver">
                      {tool.activeVersion || "未激活"} · {tool.installCount} 版本
                    </div>
                  </div>
                </div>
                <div className="tool-meta">
                  {tool.activeVersion ? (
                    <span className="badge active">● 激活</span>
                  ) : (
                    <span className="badge">未激活</span>
                  )}
                  {od && (
                    <span className="badge outdated" title={`${od.current} → ${od.latest}`}>
                      ⬆ 可升级 {od.latest}
                    </span>
                  )}
                  {tool.versions.find((v) => v.requested && v.requested !== v.version) && (
                    <span className="badge" title="配置文件中的请求版本">
                      配置: {tool.versions.find((v) => v.requested)?.requested}
                    </span>
                  )}
                </div>
                <div className="tool-actions">
                  <button
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTool(tool.name);
                    }}
                  >
                    管理
                  </button>
                  {tool.activeVersion &&
                    (() => {
                      const active = tool.versions.find((v) => v.active);
                      return active?.installPath ? (
                        <button
                          className="btn sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.miseManager.openInstallDir(tool.name, active.version);
                          }}
                        >
                          📂 目录
                        </button>
                      ) : null;
                    })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
