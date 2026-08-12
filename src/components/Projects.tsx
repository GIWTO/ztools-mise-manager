import { useCallback, useEffect, useState } from "react";
import type { Project } from "../types";

interface Props {
  onChanged: (silent?: boolean) => void;
}

export default function Projects({ onChanged }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [configText, setConfigText] = useState("");
  const [configFile, setConfigFile] = useState<string | null>(null);
  const [configFiles, setConfigFiles] = useState<{ path: string; tools: string[] }[]>([]);
  const [globalConfig, setGlobalConfig] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newTool, setNewTool] = useState("");
  const [newVer, setNewVer] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setProjects(window.miseManager.projects.load());
  }, []);

  useEffect(() => {
    reload();
    window.miseManager.getConfigFiles().then((res) => {
      if (res.ok) setConfigFiles(res.files);
    });
    window.miseManager.getSystemInfo().then((info) => {
      setGlobalConfig(info.settingsText || "（无）");
    });
  }, [reload]);

  const loadConfig = useCallback(async (projPath: string) => {
    setSelected(projPath);
    setSaved(false);
    setError("");
    // 读取项目目录下候选配置文件
    const candidates = ["mise.toml", ".mise.toml", ".tool-versions"];
    for (const c of candidates) {
      const file = `${projPath.replace(/[\\/]+$/, "")}/${c}`;
      const res = window.miseManager.readConfigFile(file);
      if (res.ok) {
        setConfigFile(file);
        setConfigText(res.content || "");
        return;
      }
    }
    setConfigFile(`${projPath.replace(/[\\/]+$/, "")}/.mise.toml`);
    setConfigText("# 该目录还没有 mise 配置文件\n# 在此定义项目工具版本，例如:\n# [tools]\n# node = \"22\"\n");
  }, []);

  const addProject = async () => {
    const p = await window.miseManager.selectFolder();
    if (!p) return;
    const name = p.split(/[\\/]/).filter(Boolean).pop() || p;
    window.miseManager.projects.add({ path: p, name });
    reload();
  };

  const removeProject = (p: string) => {
    if (!window.confirm(`移除项目 ${p}？`)) return;
    window.miseManager.projects.remove(p);
    if (selected === p) {
      setSelected(null);
      setConfigFile(null);
    }
    reload();
  };

  const saveConfig = () => {
    if (!configFile) return;
    setError("");
    const res = window.miseManager.saveConfigFile(configFile, configText);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onChanged();
    } else {
      setError(`保存失败: ${res.error}`);
    }
  };

  const addToolToProject = async () => {
    if (!selected || !newTool.trim()) return;
    setBusy(true);
    setError("");
    try {
      const ver = newVer.trim() ? `@${newVer.trim()}` : "";
      await window.miseManager.setProject(newTool.trim(), ver ? ver.slice(1) : "latest", selected);
      window.miseManager.notify("mise", `已写入 ${selected} 的配置: ${newTool}${ver}`);
      setNewTool("");
      setNewVer("");
      await loadConfig(selected);
      onChanged();
    } catch (e) {
      setError(`写入失败: ${String(e).slice(0, 200)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split" style={{ height: "auto", minHeight: 0, flexDirection: "column" }}>
      {/* 全局配置 */}
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 15 }}>🌐 全局配置（mise settings）</h3>
          {configFiles.length > 0 && (
            <span className="status-chip" title="配置文件列表">
              {configFiles[0].path}
            </span>
          )}
        </div>
        <pre className="detail-pre" style={{ maxHeight: 140 }}>
          {globalConfig}
        </pre>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 16, alignItems: "flex-start" }}>
        {/* 项目列表 */}
        <div className="split-left" style={{ height: "auto", maxHeight: 480 }}>
          <div style={{ padding: 10 }}>
            <button className="btn primary" style={{ width: "100%" }} onClick={addProject}>
              ＋ 添加项目目录
            </button>
          </div>
          {projects.map((p) => (
            <div
              key={p.path}
              className={`tool-list-item ${selected === p.path ? "active" : ""}`}
              onClick={() => loadConfig(p.path)}
            >
              <div style={{ minWidth: 0 }}>
                <div className="tl-name">{p.name}</div>
                <div className="tl-ver" style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>
                  {p.path}
                </div>
              </div>
              <button
                className="btn sm danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProject(p.path);
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {projects.length === 0 && <div className="empty-hint">尚无收藏项目</div>}
        </div>

        {/* 项目配置编辑器 */}
        <div className="split-right" style={{ height: "auto", minHeight: 0, maxHeight: 560 }}>
          {!selected ? (
            <div className="empty-hint">← 选择或添加一个项目，管理其 .mise.toml 配置</div>
          ) : (
            <div className="fade-in">
              <div className="toolbar" style={{ marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontFamily: "Consolas, monospace" }}>{configFile}</h3>
                <div style={{ marginLeft: "auto" }}>
                  {saved && <span className="badge active" style={{ marginRight: 8 }}>✓ 已保存</span>}
                  <button className="btn sm primary" onClick={saveConfig}>💾 保存</button>
                </div>
              </div>

              {error && <div className="error-banner">{error}</div>}

              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <input
                  className="search-input"
                  style={{ maxWidth: 160, minWidth: 100 }}
                  placeholder="工具名 (node)"
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                />
                <input
                  className="search-input"
                  style={{ maxWidth: 140, minWidth: 100 }}
                  placeholder="版本 (22 或留空=latest)"
                  value={newVer}
                  onChange={(e) => setNewVer(e.target.value)}
                />
                <button className="btn" disabled={busy || !newTool.trim()} onClick={addToolToProject}>
                  ＋ 为项目添加工具
                </button>
              </div>

              <textarea
                className="config-textarea"
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
