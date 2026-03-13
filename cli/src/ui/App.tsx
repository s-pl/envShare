/**
 * esai ui — Terminal UI
 * Screens: Projects → Project (Secrets | Push | Config | Members)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { api, ApiError } from '../api.js';
import {
  readPushConfig, writePushConfig, isAutoShared, isIgnored,
  PushConfig, readProjectLink,
} from '../config.js';
import { parseDotenv } from '../commands/push.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project  { id: string; name: string; slug: string; role: string; }
interface Secret   { id: string; key: string; value: string; isShared: boolean; hasPersonalValue: boolean; }
interface Member   { id: string; role: string; user: { email: string; name: string }; }
interface PushEntry { key: string; value: string; isShared: boolean; }
interface PushResult { created: string[]; updated: string[]; sharedUpdated: string[]; }

type Tab = 'secrets' | 'push' | 'config' | 'members';
type TopScreen = 'projects' | 'project';

// ─── Reusable primitives ──────────────────────────────────────────────────────

function Header({ crumbs }: { crumbs: string[] }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text bold color="blue">envShare</Text>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <Text color="gray">›</Text>
            <Text color={i === crumbs.length - 1 ? 'white' : 'gray'} bold={i === crumbs.length - 1}>{c}</Text>
          </React.Fragment>
        ))}
      </Box>
      <Text color="gray">{'─'.repeat(64)}</Text>
    </Box>
  );
}

function Footer({ hints }: { hints: string[] }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">{'─'.repeat(64)}</Text>
      <Box gap={2} flexWrap="wrap">
        {hints.map((h, i) => <Text key={i} color="gray">{h}</Text>)}
      </Box>
    </Box>
  );
}

function Loading({ msg }: { msg: string }) {
  return (
    <Box paddingLeft={2} paddingTop={1} gap={1}>
      <Text color="blue"><Spinner type="dots" /></Text>
      <Text color="gray">{msg}</Text>
    </Box>
  );
}

function Err({ msg, onBack }: { msg: string; onBack: () => void }) {
  useInput(() => onBack());
  return (
    <Box flexDirection="column" paddingLeft={2} paddingTop={1}>
      <Text color="red">✖  {msg}</Text>
      <Text color="gray">{'\n'}Press any key to go back.</Text>
    </Box>
  );
}

/** Simple inline text editor */
function TextInput({
  label, value, onChange, onSubmit, onCancel, placeholder = '',
}: {
  label: string; value: string; onChange: (v: string) => void;
  onSubmit: () => void; onCancel: () => void; placeholder?: string;
}) {
  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.return) { onSubmit(); return; }
    if (key.backspace || key.delete) { onChange(value.slice(0, -1)); return; }
    if (input && !key.ctrl && !key.meta) onChange(value + input);
  });
  return (
    <Box gap={1}>
      <Text color="yellow">{label}</Text>
      <Text color="cyan">{value || <Text color="gray">{placeholder}</Text>}</Text>
      <Text color="yellow">█</Text>
    </Box>
  );
}

function roleBadge(role: string) {
  const c: Record<string, string> = { ADMIN: 'magenta', DEVELOPER: 'cyan', VIEWER: 'gray' };
  return <Text color={c[role] ?? 'white'}>[{role}]</Text>;
}

function typeBadge(s: Secret) {
  if (s.isShared)            return <Text color="blue"> @shared </Text>;
  if (!s.hasPersonalValue)   return <Text color="yellow"> ⚠pending</Text>;
  return                            <Text color="gray">  personal</Text>;
}

function tabs(active: Tab) {
  const all: Tab[] = ['secrets', 'push', 'config', 'members'];
  return (
    <Box gap={1} marginBottom={1}>
      {all.map(t => (
        <Text key={t} bold={t === active}
          color={t === active ? 'blue' : 'gray'}
          backgroundColor={t === active ? undefined : undefined}>
          {t === active ? `[${t}]` : ` ${t} `}
        </Text>
      ))}
      <Text color="gray">  [Tab] switch</Text>
    </Box>
  );
}

// ─── Secrets tab ──────────────────────────────────────────────────────────────

function SecretsTab({ project }: { project: Project }) {
  const [secrets, setSecrets]   = useState<Secret[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [cursor, setCursor]     = useState(0);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [filter, setFilter]     = useState('');
  const [filterMode, setFM]     = useState(false);
  const [editing, setEditing]   = useState<{ id: string; val: string; mode: 'personal' | 'shared' } | null>(null);
  const [status, setStatus]     = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ secrets: Secret[] }>(`/sync/${project.id}/pull`)
      .then(({ secrets }) => { setSecrets(secrets); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const visible = secrets.filter(s =>
    !filter || s.key.toLowerCase().includes(filter.toLowerCase())
  );
  const clamp = (n: number) => Math.max(0, Math.min(n, visible.length - 1));

  useInput((input, key) => {
    if (loading || error) return;

    // Filter mode
    if (filterMode) {
      if (key.escape) { setFM(false); setFilter(''); return; }
      if (key.return) { setFM(false); return; }
      if (key.backspace || key.delete) { setFilter(f => f.slice(0, -1)); return; }
      if (input && !key.ctrl) { setFilter(f => f + input); return; }
      return;
    }

    // Edit mode
    if (editing) return; // handled by TextInput

    if (key.upArrow)   { setCursor(c => clamp(c - 1)); return; }
    if (key.downArrow) { setCursor(c => clamp(c + 1)); return; }

    const s = visible[cursor];
    if (!s) return;

    if (input === '/') { setFM(true); setFilter(''); return; }
    if (input === 'r') {
      setRevealed(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });
    }
    if (input === 's') { setEditing({ id: s.id, val: '', mode: 'personal' }); }
    if (input === 'S') { setEditing({ id: s.id, val: s.value, mode: 'shared' }); }
    if (input === 'd') { deleteSecret(s); }
    if (input === 'R') { load(); }
  });

  async function submitEdit() {
    if (!editing) return;
    const endpoint = editing.mode === 'shared'
      ? `/secrets/${editing.id}/shared`
      : `/secrets/${editing.id}/value`;
    try {
      await api.patch(endpoint, { value: editing.val });
      setStatus(`✔ ${editing.mode === 'shared' ? 'Shared' : 'Personal'} value saved`);
      setEditing(null);
      load();
    } catch (e: any) {
      setStatus(`✖ ${e.message}`);
      setEditing(null);
    }
  }

  async function deleteSecret(s: Secret) {
    try {
      await api.delete(`/secrets/${s.id}`);
      setStatus(`✔ Deleted ${s.key}`);
      load();
    } catch (e: any) {
      setStatus(`✖ ${e.message}`);
    }
  }

  if (loading) return <Loading msg="Loading secrets..." />;
  if (error)   return <Box paddingLeft={2}><Text color="red">✖ {error}</Text></Box>;

  const pending = secrets.filter(s => !s.isShared && !s.hasPersonalValue);

  return (
    <Box flexDirection="column">
      {/* Status bar */}
      {status && <Box paddingLeft={2} marginBottom={1}><Text color={status.startsWith('✔') ? 'green' : 'red'}>{status}</Text></Box>}

      {/* Pending warning */}
      {pending.length > 0 && (
        <Box paddingLeft={2} marginBottom={1}>
          <Text color="yellow">⚠  {pending.length} key(s) need your personal value — press [s] to set</Text>
        </Box>
      )}

      {/* Filter bar */}
      {filterMode && (
        <Box paddingLeft={2} marginBottom={1} gap={1}>
          <Text color="yellow">Filter:</Text>
          <Text color="cyan">{filter}</Text>
          <Text color="yellow">█</Text>
          <Text color="gray">  [Esc] clear  [Enter] confirm</Text>
        </Box>
      )}
      {filter && !filterMode && (
        <Box paddingLeft={2} marginBottom={1}>
          <Text color="gray">Filter: </Text><Text color="cyan">{filter}</Text>
          <Text color="gray">  ({visible.length}/{secrets.length})  [/] change  [Esc clears]</Text>
        </Box>
      )}

      {/* Secrets list */}
      {visible.length === 0 ? (
        <Box paddingLeft={2}><Text color="gray">{secrets.length ? 'No matches.' : 'No secrets. Push a .env first.'}</Text></Box>
      ) : (
        <Box flexDirection="column">
          {/* Header row */}
          <Box paddingLeft={2}>
            <Text color="gray">{'  ' + 'KEY'.padEnd(28) + 'TYPE'.padEnd(11) + 'VALUE'}</Text>
          </Box>
          {visible.map((s, i) => {
            const active  = i === cursor;
            const isRev   = revealed.has(s.id);
            const isPend  = !s.isShared && !s.hasPersonalValue;
            const display = isPend ? '(not set)' : isRev ? (s.value || '(empty)') : '••••••••••••';

            return (
              <Box key={s.id} paddingLeft={2} flexDirection="column">
                <Box>
                  <Text color={active ? 'blue' : 'white'}>{active ? '▶ ' : '  '}</Text>
                  <Text bold={active} color={isPend ? 'yellow' : 'white'}>{s.key.padEnd(28)}</Text>
                  {typeBadge(s)}
                  <Text color={isRev ? 'green' : 'gray'}>  {display.slice(0, 32)}</Text>
                </Box>
                {/* Inline editor appears below the active row */}
                {active && editing?.id === s.id && (
                  <Box paddingLeft={4} marginTop={0}>
                    <TextInput
                      label={editing.mode === 'shared' ? '🌐 Shared value:' : '👤 Personal value:'}
                      value={editing.val}
                      onChange={v => setEditing(e => e ? { ...e, val: v } : null)}
                      onSubmit={submitEdit}
                      onCancel={() => setEditing(null)}
                      placeholder="type value, Enter to save, Esc to cancel"
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Footer hints={[
        '[↑↓] navigate', '[r] reveal', '[s] set personal', '[S] set shared',
        '[d] delete', '[/] filter', '[R] refresh',
      ]} />
    </Box>
  );
}

// ─── Push tab ─────────────────────────────────────────────────────────────────

function PushTab({ project }: { project: Project }) {
  const [pushCfg]              = useState(() => readPushConfig());
  const [files, setFiles]      = useState<string[]>([]);
  const [fileCursor, setFC]    = useState(0);
  const [entries, setEntries]  = useState<PushEntry[] | null>(null);
  const [entryCursor, setEC]   = useState(0);
  const [pushing, setPushing]  = useState(false);
  const [result, setResult]    = useState<PushResult | null>(null);
  const [status, setStatus]    = useState('');

  useEffect(() => {
    // Find .env* files in cwd
    const cwd = process.cwd();
    const found = readdirSync(cwd)
      .filter(f => /^\.env/.test(f) && !f.endsWith('.example'))
      .sort();
    setFiles(found.length ? found : ['.env']);
  }, []);

  const selectFile = useCallback((fname: string) => {
    const path = join(process.cwd(), fname);
    if (!existsSync(path)) { setStatus(`✖ ${fname} not found`); return; }
    const raw = parseDotenv(readFileSync(path, 'utf-8'));
    const filtered = raw.filter(e => !isIgnored(e.key, pushCfg));
    const enriched = filtered.map(e => ({
      ...e,
      isShared: e.isShared || isAutoShared(e.key, pushCfg),
    }));
    setEntries(enriched);
    setEC(0);
    setResult(null);
    setStatus('');
  }, [pushCfg]);

  useInput((input, key) => {
    if (pushing) return;

    if (result) {
      if (input === 'r' || key.return) { setResult(null); setEntries(null); }
      return;
    }

    if (entries === null) {
      // File selection
      if (key.upArrow)   { setFC(c => Math.max(0, c - 1)); return; }
      if (key.downArrow) { setFC(c => Math.min(files.length - 1, c + 1)); return; }
      if (key.return)    { selectFile(files[fileCursor]); return; }
      return;
    }

    // Entry preview
    if (key.upArrow)   { setEC(c => Math.max(0, c - 1)); return; }
    if (key.downArrow) { setEC(c => Math.min(entries.length - 1, c + 1)); return; }
    if (input === 't') {
      setEntries(prev => prev!.map((e, i) => i === entryCursor ? { ...e, isShared: !e.isShared } : e));
      return;
    }
    if (input === 'p' || input === 'P') { doPush(); return; }
    if (key.escape) { setEntries(null); return; }
  });

  async function doPush() {
    if (!entries) return;
    setPushing(true);
    try {
      const { result } = await api.post<{ result: PushResult }>(
        `/sync/${project.id}/push`,
        { secrets: entries },
      );
      setResult(result);
    } catch (e: any) {
      setStatus(`✖ ${e.message}`);
    } finally {
      setPushing(false);
    }
  }

  if (pushing) return <Loading msg="Pushing secrets..." />;

  // Result screen
  if (result) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color="green" bold>✔ Push complete</Text>
        {result.created.length > 0     && <Text>{'  '}<Text color="green">New keys  ({result.created.length}):</Text> {result.created.join(', ')}</Text>}
        {result.updated.length > 0     && <Text>{'  '}<Text color="blue">Updated   ({result.updated.length}):</Text> {result.updated.join(', ')}</Text>}
        {result.sharedUpdated.length>0 && <Text>{'  '}<Text color="cyan">Shared    ({result.sharedUpdated.length}):</Text> {result.sharedUpdated.join(', ')}</Text>}
        <Footer hints={['[Enter/r] push another file']} />
      </Box>
    );
  }

  // File selection
  if (entries === null) {
    return (
      <Box flexDirection="column">
        {status && <Box paddingLeft={2}><Text color="red">{status}</Text></Box>}
        <Box paddingLeft={2} marginBottom={1}><Text color="gray">Select a .env file to push:</Text></Box>
        {files.map((f, i) => (
          <Box key={f} paddingLeft={2}>
            <Text color={i === fileCursor ? 'blue' : 'white'}>{i === fileCursor ? '▶ ' : '  '}</Text>
            <Text bold={i === fileCursor}>{f}</Text>
            {f === pushCfg.defaultFile && <Text color="gray">  (default)</Text>}
          </Box>
        ))}
        <Footer hints={['[↑↓] navigate', '[Enter] select']} />
      </Box>
    );
  }

  // Entry preview with shared toggle
  const sharedCount   = entries.filter(e => e.isShared).length;
  const personalCount = entries.length - sharedCount;

  return (
    <Box flexDirection="column">
      <Box paddingLeft={2} marginBottom={1}>
        <Text color="gray">{entries.length} variables  </Text>
        <Text color="blue">🌐 {sharedCount} shared  </Text>
        <Text color="gray">👤 {personalCount} personal</Text>
      </Box>

      {/* Column header */}
      <Box paddingLeft={2}>
        <Text color="gray">{'  ' + 'KEY'.padEnd(30) + 'VALUE (masked)'.padEnd(22) + 'TYPE'}</Text>
      </Box>

      {entries.map((e, i) => {
        const active = i === entryCursor;
        return (
          <Box key={e.key} paddingLeft={2}>
            <Text color={active ? 'blue' : 'white'}>{active ? '▶ ' : '  '}</Text>
            <Text bold={active}>{e.key.padEnd(30)}</Text>
            <Text color="gray">{'•'.repeat(Math.min(e.value.length, 20)).padEnd(22)}</Text>
            {e.isShared
              ? <Text color="blue"> @shared</Text>
              : <Text color="gray"> personal</Text>}
          </Box>
        );
      })}

      <Footer hints={['[↑↓] navigate', '[t] toggle shared/personal', '[p] push', '[Esc] back']} />
    </Box>
  );
}

// ─── Config tab ───────────────────────────────────────────────────────────────

type ConfigSection = 'defaultFile' | 'sharedKeys' | 'sharedPatterns' | 'ignoredKeys';

function ConfigTab() {
  const [cfg, setCfg]         = useState<PushConfig>(readPushConfig);
  const [section, setSection] = useState<ConfigSection>('defaultFile');
  const [listCursor, setLC]   = useState(0);
  const [adding, setAdding]   = useState<ConfigSection | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [saved, setSaved]     = useState(false);

  const sections: ConfigSection[] = ['defaultFile', 'sharedKeys', 'sharedPatterns', 'ignoredKeys'];
  const sectionIdx = sections.indexOf(section);

  useInput((input, key) => {
    if (adding) return; // handled by TextInput

    if (key.upArrow)   { setSection(sections[Math.max(0, sectionIdx - 1)]); return; }
    if (key.downArrow) { setSection(sections[Math.min(sections.length - 1, sectionIdx + 1)]); return; }

    if (input === 'a') { setAdding(section); setInputVal(''); return; }
    if (input === 'd') {
      const list = cfg[section];
      if (Array.isArray(list) && list.length > 0) {
        const next = [...list];
        next.splice(listCursor, 1);
        setCfg(c => ({ ...c, [section]: next }));
        setLC(lc => Math.min(lc, next.length - 1));
      }
    }
    if (input === 's') {
      writePushConfig(cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  });

  function submitAdd() {
    if (!adding || !inputVal.trim()) { setAdding(null); return; }
    const val = inputVal.trim();
    if (adding === 'defaultFile') {
      setCfg(c => ({ ...c, defaultFile: val }));
    } else {
      const list = cfg[adding] as string[];
      if (!list.includes(val)) setCfg(c => ({ ...c, [adding]: [...list, val] }));
    }
    setAdding(null);
    setInputVal('');
  }

  const sectionLabel: Record<ConfigSection, string> = {
    defaultFile:    'Default .env file',
    sharedKeys:     'Shared keys (exact)',
    sharedPatterns: 'Shared patterns (glob)',
    ignoredKeys:    'Ignored keys/patterns',
  };

  const sectionHelp: Record<ConfigSection, string> = {
    defaultFile:    'File used by esai push when no file is specified',
    sharedKeys:     'These keys are always shared — e.g. DATABASE_URL',
    sharedPatterns: 'Glob patterns: *_URL, DB_*, *HOST* — auto-shared on push',
    ignoredKeys:    'Never pushed — e.g. LOCAL_*, DEBUG',
  };

  return (
    <Box flexDirection="column">
      <Box paddingLeft={2} marginBottom={1}>
        <Text color="gray">Push configuration for this directory. Saved to </Text>
        <Text color="cyan">.esai.config.json</Text>
      </Box>

      {saved && <Box paddingLeft={2} marginBottom={1}><Text color="green">✔ Saved to .esai.config.json</Text></Box>}

      {sections.map(sec => {
        const active = sec === section;
        const value  = cfg[sec];
        return (
          <Box key={sec} flexDirection="column" paddingLeft={2} marginBottom={1}>
            <Box gap={1}>
              <Text color={active ? 'blue' : 'gray'}>{active ? '▶' : ' '}</Text>
              <Text bold={active} color={active ? 'white' : 'gray'}>{sectionLabel[sec]}</Text>
            </Box>

            {active && (
              <Box flexDirection="column" paddingLeft={4}>
                <Text color="gray">{sectionHelp[sec]}</Text>
                {typeof value === 'string' ? (
                  <Box gap={1}>
                    <Text color="cyan">{value}</Text>
                    {adding === sec && (
                      <TextInput label="New value:" value={inputVal} onChange={setInputVal}
                        onSubmit={submitAdd} onCancel={() => setAdding(null)} />
                    )}
                  </Box>
                ) : (
                  <Box flexDirection="column">
                    {(value as string[]).length === 0 && <Text color="gray">(none)</Text>}
                    {(value as string[]).map((v, i) => (
                      <Box key={v}>
                        <Text color={i === listCursor ? 'cyan' : 'white'}>{i === listCursor ? '▶ ' : '  '}</Text>
                        <Text>{v}</Text>
                      </Box>
                    ))}
                    {adding === sec && (
                      <TextInput label="Add:" value={inputVal} onChange={setInputVal}
                        onSubmit={submitAdd} onCancel={() => setAdding(null)}
                        placeholder={sec === 'sharedPatterns' ? '*_URL' : 'KEY_NAME'} />
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        );
      })}

      <Footer hints={['[↑↓] section', '[a] add', '[d] delete item', '[s] save']} />
    </Box>
  );
}

// ─── Members tab ──────────────────────────────────────────────────────────────

function MembersTab({ project }: { project: Project }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get<{ members: Member[] }>(`/projects/${project.id}/members`)
      .then(({ members }) => { setMembers(members); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [project.id]);

  if (loading) return <Loading msg="Loading members..." />;
  if (error)   return <Box paddingLeft={2}><Text color="red">✖ {error}</Text></Box>;

  return (
    <Box flexDirection="column">
      {members.map(m => (
        <Box key={m.id} paddingLeft={2} gap={2}>
          <Text>{m.user.name.padEnd(20)}</Text>
          <Text color="gray">{m.user.email.padEnd(35)}</Text>
          {roleBadge(m.role)}
        </Box>
      ))}
      <Box paddingLeft={2} marginTop={1}>
        <Text color="gray">To invite: </Text>
        <Text color="cyan">esai project invite email@example.com</Text>
      </Box>
      <Footer hints={['[B/Esc] back']} />
    </Box>
  );
}

// ─── Project screen ───────────────────────────────────────────────────────────

function ProjectScreen({ project, onBack }: { project: Project; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('secrets');
  const tabOrder: Tab[] = ['secrets', 'push', 'config', 'members'];

  useInput((_input, key) => {
    if (key.tab) {
      setTab(t => tabOrder[(tabOrder.indexOf(t) + 1) % tabOrder.length]);
    }
    if (key.escape) onBack();
  });

  return (
    <Box flexDirection="column">
      <Header crumbs={['Projects', project.name, tab]} />
      {tabs(tab)}
      {tab === 'secrets' && <SecretsTab project={project} />}
      {tab === 'push'    && <PushTab project={project} />}
      {tab === 'config'  && <ConfigTab />}
      {tab === 'members' && <MembersTab project={project} />}
      {tab !== 'secrets' && tab !== 'push' && (
        <Box />
      )}
    </Box>
  );
}

// ─── Projects screen ──────────────────────────────────────────────────────────

function ProjectsScreen({
  projects, cursor, onSelect, onQuit,
}: {
  projects: Project[]; cursor: number;
  onSelect: (p: Project) => void; onQuit: () => void;
}) {
  useInput((input, key) => {
    if (input === 'q' || key.escape) { onQuit(); return; }
    if (key.return && projects[cursor]) onSelect(projects[cursor]);
  });

  return (
    <Box flexDirection="column">
      <Header crumbs={['Projects']} />
      {projects.length === 0 ? (
        <Box paddingLeft={2}>
          <Text color="yellow">No projects found. Run </Text>
          <Text color="cyan">esai project create</Text>
          <Text color="yellow"> first.</Text>
        </Box>
      ) : (
        projects.map((p, i) => (
          <Box key={p.id} paddingLeft={2} gap={2}>
            <Text color={i === cursor ? 'blue' : 'white'}>{i === cursor ? '▶ ' : '  '}</Text>
            <Text bold={i === cursor}>{p.name.padEnd(32)}</Text>
            {roleBadge(p.role)}
          </Box>
        ))
      )}
      <Footer hints={['[↑↓] navigate', '[Enter] open', '[q] quit']} />
    </Box>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export function App() {
  const { exit } = useApp();
  const [screen, setScreen]   = useState<TopScreen>('projects');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [cursor, setCursor]   = useState(0);
  const [selected, setSelected] = useState<Project | null>(null);

  const loadProjects = useCallback(() => {
    setLoading(true);
    setError('');
    api.get<{ projects: Project[] }>('/projects')
      .then(({ projects }) => { setProjects(projects); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Global arrow nav on projects screen
  useInput((_input, key) => {
    if (screen !== 'projects' || loading || error) return;
    if (key.upArrow)   setCursor(c => Math.max(0, c - 1));
    if (key.downArrow) setCursor(c => Math.min(projects.length - 1, c + 1));
  });

  if (loading) return <Loading msg="Connecting to envShare..." />;
  if (error)   return <Err msg={error} onBack={loadProjects} />;

  if (screen === 'project' && selected) {
    return <ProjectScreen project={selected} onBack={() => { setScreen('projects'); loadProjects(); }} />;
  }

  return (
    <ProjectsScreen
      projects={projects}
      cursor={cursor}
      onSelect={p => { setSelected(p); setScreen('project'); }}
      onQuit={exit}
    />
  );
}
