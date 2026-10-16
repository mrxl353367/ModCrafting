import React, { useEffect, useState } from 'react'
import type { CoreEnvironmentStatus, CoreRuntimeState, FabricProject, GameRuntimeStatus, JobSnapshot, BridgeResult } from '../../modcrafting-core/src/contracts.ts'
import { action, request, state } from './client.ts'
import { IconFolder, IconWrench, IconGamepad, IconPlay, IconSquare as IconStop } from './Icon.tsx'
import { RecipeEditor } from './RecipeEditor.tsx'
import { ContentEditor } from './ContentEditor.tsx'
import { GuiEditor } from './GuiEditor.tsx'

const labels: Record<string, string> = { build: '构建', minecraft: 'Minecraft', game_test: '游戏测试', running: '运行中', completed: '已完成', failed: '失败', stopped: '停止已请求', present: '文件已存在', missing: '缺失', invalid: '布局异常' }
const sample = { version: 2, id: 'browser-health-check', featureType: 'player_interaction', subject: {}, setup: [], actions: [{ type: 'wait', ms: 250 }], assertions: [{ type: 'snapshot_value', source: 'player', pointer: '/health', equals: 20 }], cleanup: [] }
const empty: CoreRuntimeState = { contractVersion: 1, jobs: [], instances: [] }
function Badge({ value }: { value: string }) { return <span className={`badge badge-${value}`}>{labels[value] || value}</span> }
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Job({ job, onStop, onReport }: { job: JobSnapshot; onStop: () => void; onReport: () => void }) {
  const verdict = typeof job.result?.verdict === 'string' ? job.result.verdict : ''
  return <article className="job">
    <div className="row"><strong>{labels[job.kind] || job.kind}</strong><Badge value={job.status} />{verdict && <Badge value={verdict} />}<time>{new Date(job.startedAt).toLocaleTimeString()}</time>
      {job.status === 'running' && <button onClick={onStop}><IconStop size="sm" />停止任务</button>}
      {typeof job.result?.reportPath === 'string' && <button onClick={onReport}>查看报告</button>}
    </div>
    <code className="muted">{job.id}</code>
    {(job.error || job.code) && <p className="error">{job.code} {job.error}</p>}
    {job.status === 'stopped' && !job.result && !job.error && <p className="muted">等待进程退出及测试清理完成…</p>}
    {!!job.output.length && <details open={job.status === 'running'}><summary>任务日志 · 最近 {job.output.length} 行</summary><pre>{job.output.join('\n')}</pre></details>}
    {!!job.result && <details><summary>执行结果</summary><pre>{JSON.stringify(job.result, null, 2)}</pre></details>}
  </article>
}
export function App() {
  const [path, setPath] = useState(sessionStorage.getItem('modcrafting-view-project') || '')
  const [project, setProject] = useState<FabricProject>()
  const [importedProjects, setImportedProjects] = useState<FabricProject[]>([])
  const [environment, setEnvironment] = useState<CoreEnvironmentStatus>()
  const [runtime, setRuntime] = useState(empty)
  const [instanceId, setInstanceId] = useState('')
  const [game, setGame] = useState<GameRuntimeStatus>()
  const [gameDirectory, setGameDirectory] = useState('')
  const [task, setTask] = useState('build')
  const [spec, setSpec] = useState(JSON.stringify(sample, null, 2))
  const [snapshot, setSnapshot] = useState<BridgeResult>()
  const [image, setImage] = useState('')
  const [report, setReport] = useState<unknown>()
  const [error, setError] = useState('')
  const [connection, setConnection] = useState('连接中')
  const [pending, setPending] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() {
    const value = await state(); setRuntime(value); setConnection('Core 已连接')
    setInstanceId((current) => current || value.instances.at(-1)?.instanceId || '')
  }
  useEffect(() => {
    void request<{ projects: FabricProject[] }>('/api/projects').then((value) => setImportedProjects(value.projects)).catch((cause) => setError(`工程迁移记录不可用：${String(cause)}`))
    let active = true, busy = false
    const poll = async () => { if (busy) return; busy = true; try { if (active) await refresh() } catch { if (active) setConnection('Core 连接中断 · 检查服务是否仍在运行') } finally { busy = false } }
    void poll(); const timer = setInterval(poll, 1500)
    return () => { active = false; clearInterval(timer) }
  }, [])
  useEffect(() => {
    setGame(undefined); setSnapshot(undefined); setImage('')
    if (!instanceId) return
    let active = true, busy = false
    const poll = async () => { if (busy) return; busy = true; try { const value = await action<GameRuntimeStatus>({ operation: 'runtime', instanceId }); if (active) setGame(value) } catch { if (active) setGame(undefined) } finally { busy = false } }
    void poll(); const timer = setInterval(poll, 3000)
    return () => { active = false; clearInterval(timer) }
  }, [instanceId])
  async function run(name: string, work: () => Promise<void>) {
    setPending(name); setError(''); setNotice('')
    try { await work(); await refresh() } catch (cause) { setError(String(cause)) } finally { setPending('') }
  }
  async function open() {
    const value = await action<{ project: FabricProject }>({ operation: 'project', projectPath: path.trim() })
    setProject(value.project); sessionStorage.setItem('modcrafting-view-project', value.project.path)
    setEnvironment(await action({ operation: 'environment', projectPath: value.project.path }))
  }
  useEffect(() => { if (path.trim()) void run('恢复工程', open) }, [])
  const connected = connection === 'Core 已连接', disabled = Boolean(pending) || !connected
  const selected = runtime.instances.find((row) => row.instanceId === instanceId)
  const runningGame = selected && runtime.jobs.find((row) => row.id === selected.jobId)?.status === 'running'
  const worldName = snapshot?.data.worldName
  return <>
    <header><div className="brand"><span className="brand-mark">M</span><div><strong>ModCrafting</strong><span>Fabric 工作台</span></div></div><span className={connected ? 'connected' : 'error'} role="status">● {connection}</span></header>
    <main>
      <div className="intro"><div><p className="eyebrow">CREATE / FABRIC 1.21.4</p><h1>把想法变成游戏里的内容。</h1><p className="muted">与 Agent 一起设计 MC 界面、调整内容属性、编辑配方，保存工程，再进游戏验证。</p></div><a href="#jobs">构建与验收 ↓</a></div>
      {error && <div role="alert" className="message error">{error}<button onClick={() => setError('')}>收起</button></div>}
      {(pending || notice) && <div role="status" className="message">{pending ? `${pending}…` : notice}</div>}
      <section className="panel"><h2><IconFolder />工程与环境</h2>
        {!!importedProjects.length && <label>从 Desktop 保留的工程<select aria-label="从 Desktop 保留的工程" value="" onChange={(event) => { setPath(event.target.value); setProject(undefined); setEnvironment(undefined) }}><option value="">选择工程后点击打开，重新检查环境</option>{importedProjects.map((value) => <option key={value.path} value={value.path}>{value.valid ? '' : '需检查 · '}{value.path}</option>)}</select></label>}
        <form className="row project-form" onSubmit={(event) => { event.preventDefault(); void run('检查工程', open) }}>
          <label className="grow">Fabric 工程绝对路径<input value={path} onChange={(event) => setPath(event.target.value)} placeholder="输入已有 Fabric 工程路径" /></label>
          <button className="primary" disabled={disabled || !path.trim()}>打开工程</button>
        </form>
        {project && <div className="project-info"><strong>{project.modId || '未识别 mod ID'}</strong><Badge value={project.valid ? 'PASS' : 'FAIL'} /><span>{project.minecraftVersion}</span><code>{project.path}</code>{project.errors.map((value) => <p className="error" key={value}>{value}</p>)}</div>}
        <div className="row"><button disabled={disabled} onClick={() => void run('检查环境', async () => { setEnvironment(await action({ operation: 'environment', projectPath: project?.path })) })}>刷新环境</button>
          <button disabled={disabled} onClick={() => void run('准备资源', async () => { const prepared = await action<{ ok: boolean }>({ operation: 'prepare' }); setNotice(prepared.ok ? '资源准备完成；启动前仍需按下方步骤应用 Observer V2。' : '资源准备未完成'); setEnvironment(await action({ operation: 'environment', projectPath: project?.path })) })}>下载知识与基础模组</button></div>
        {environment && <details className="environment-details"><summary>运行环境与资源</summary>
          <div className="checks"><div><span>系统 JDK 21</span><Badge value={environment.java.ok ? 'PASS' : 'FAIL'} /><small>{environment.java.version || environment.java.error}</small></div><div><span>Gradle Wrapper</span><Badge value={environment.gradleWrapper ? 'PASS' : 'FAIL'} /></div><div><span>测试桥协议</span><Badge value={game?.bridgeReady ? 'PASS' : 'INCONCLUSIVE'} /><small>{game?.bridgeReady ? 'Observer V2 已响应' : '等待游戏内实际验证'}</small></div></div>
          {environment.remediation.map((value) => <p className="error" key={value}>{value}</p>)}
          <details><summary>资源布局与数据目录</summary><code>{environment.paths.dataRoot}</code>{environment.assets.map((value) => <div className="row asset" key={value.name}><strong>{value.name}</strong><Badge value={value.status} /><code>{value.path}</code></div>)}</details>
          <details className="compat"><summary>启动前应用 Observer V2（公开资源包仍为 V1）</summary><p>资源“文件已存在”不代表 V2 兼容。下载后，将完整产品包中的 observer/modcrafting-observer.jar 覆盖到下面的独立缓存路径；再次下载资源后需重做。只保留一份同 ID Observer。</p><code>{environment.paths.assetsRoot}/base-mods/modcrafting-observer.jar</code><p>JDK 21 与工程 Wrapper 需自行准备，资源下载不会安装工具链。</p></details>
        </details>}
      </section>
      {project?.valid && <><GuiEditor key={'gui:' + project.path} projectPath={project.path} modId={project.modId!} /><ContentEditor key={'content:' + project.path} projectPath={project.path} modId={project.modId!} /><RecipeEditor key={project.path} projectPath={project.path} modId={project.modId!} /></>}
      <div className="columns">
        <section className="panel"><h2><IconWrench />构建</h2><p className="muted">通过工程 Wrapper 执行，日志保留在 Core 任务中。</p><div className="row"><label className="grow">Gradle 任务<input value={task} onChange={(event) => setTask(event.target.value)} /></label><button className="primary" disabled={disabled || !project?.valid} onClick={() => void run('启动构建', async () => { await action({ operation: 'build', projectPath: project!.path, task }) })}><IconPlay size="sm" />构建</button></div></section>
        <section className="panel"><h2><IconGamepad />Minecraft</h2><label>隔离游戏目录（可选）<input value={gameDirectory} onChange={(event) => setGameDirectory(event.target.value)} placeholder="默认：工程/run/modcrafting-fabric" /></label><div className="row"><button className="primary" disabled={disabled || !project?.valid} onClick={() => void run('启动 Minecraft', async () => { const value = await action<{ instanceId: string }>({ operation: 'run', projectPath: project!.path, gameDirectory: gameDirectory.trim() || undefined }); setInstanceId(value.instanceId) })}><IconPlay size="sm" />启动游戏</button><button disabled={disabled || !runningGame} onClick={() => void run('停止 Minecraft', async () => { await action({ operation: 'stop', jobId: selected!.jobId }) })}><IconStop size="sm" />停止游戏</button></div></section>
      </div>
      <section className="panel"><div className="row"><h2>观察与可信测试</h2><label className="instance">游戏实例<select value={instanceId} onChange={(event) => setInstanceId(event.target.value)}><option value="">尚无实例</option>{runtime.instances.map((value) => <option value={value.instanceId} key={value.instanceId}>{value.instanceId}</option>)}</select></label></div>
        {selected && <p className="muted">{selected.projectPath} · {selected.gameDirectory}</p>}
        <p className="muted">在游戏内打开专用世界 ModCrafting Test World 后测试。区域限定 x/z −16～16、y 96～112；普通世界由 Core 拒绝。</p>
        <div className="row"><Badge value={game?.bridgeReady ? 'PASS' : 'INCONCLUSIVE'} /><span>{game?.bridgeReady ? 'V2 桥就绪' : 'V2 桥未就绪'}</span><button disabled={disabled || !game?.bridgeReady} onClick={() => void run('获取快照', async () => { setSnapshot(await action({ operation: 'snapshot', instanceId })) })}>刷新快照</button><button disabled={disabled || !game?.bridgeReady} onClick={() => void run('获取截图', async () => { const value = await action<{ image: string }>({ operation: 'screenshot', instanceId }); setImage(value.image) })}>截图</button></div>
        {snapshot && <details open><summary>结构化快照 · {String(worldName || '无世界')}</summary><pre>{JSON.stringify(snapshot.data, null, 2)}</pre></details>}
        {image && <figure><img src={image} alt="Minecraft 当前游戏画面" /><figcaption>截图仅作辅助展示，不能证明测试 PASS。</figcaption></figure>}
        <label className="spec">V2 测试场景 JSON<textarea value={spec} onChange={(event) => setSpec(event.target.value)} spellCheck={false} rows={10} /></label>
        <div className="row"><button className="primary" disabled={disabled || !game?.bridgeReady || worldName !== 'ModCrafting Test World'} onClick={() => void run('启动测试', async () => { await action({ operation: 'test', instanceId, spec: JSON.parse(spec) }) })}>运行场景</button><span className="muted">先刷新快照确认专用世界；Core 再次检查世界与场景。</span></div>
        {environment && <details><summary>可用断言与明确限制</summary><p>支持：{environment.capabilities.supportedAssertions.join('、')}</p><p>暂不支持：{environment.capabilities.unsupportedAssertions.join('、')}。能力不足和清理失败均为 INCONCLUSIVE。</p></details>}
      </section>
      <section className="panel" id="jobs"><div className="row"><h2>任务与报告</h2><span className="muted">{runtime.jobs.length} 个任务 · MCP / 浏览器共用</span></div>{runtime.jobs.length ? runtime.jobs.toReversed().map((job) => <Job key={job.id} job={job} onStop={() => void run('停止任务', async () => { await action({ operation: 'stop', jobId: job.id }) })} onReport={() => void run('读取报告', async () => { setReport(await request(`/api/report/${encodeURIComponent(job.id)}`)) })} />) : <p className="muted">打开工程后启动构建，或由 Agent 通过 MCP 发起任务。</p>}
        {report !== undefined && <div className="report"><div className="row"><h3>测试证据报告</h3><button onClick={() => download(report, 'modcrafting-game-test.json')}>下载 JSON</button><button onClick={() => setReport(undefined)}>收起报告</button></div><pre>{JSON.stringify(report, null, 2)}</pre></div>}
      </section>
    </main><footer>ModCrafting Core · 无需 Desktop · UI 关闭不会停止任务</footer>
  </>
}
