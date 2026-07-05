'use client'

/**
 * 自习模式主页（v2）— 3 状态机
 * - idle: 配置页（时长 / 难度 / 摄像头开关 + 16:9 实时预览）
 * - running: 横排布局（摄像头 + 倒计时）· 摄像头可中途开关
 * - report: 报告页（巡查时间线带 hover tooltip）
 *
 * 数据通路：
 * - 开始 / 巡查 / 结束 → evaluationApi.recordAction() → learning_records
 * - scheduled_analysis_service 每 4 小时自动分析 → 更新专注力维度
 *
 * 摄像头生命周期：
 * - MediaStream 由页面持有，idle 与 running 共享同一流
 * - 阶段切换时只更换 video 元素，不重建 stream
 */
import {
  useState, useRef, useCallback, useEffect,
  forwardRef, type MutableRefObject, type Ref,
} from 'react'
import { useRouter } from 'next/navigation'
import { useCameraPatrol, type StudyLabel, type StudyDifficulty } from '@/hooks/useCameraPatrol'
import { CameraToggle } from '@/components/CameraToggle'
import { evaluationApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

type Phase = 'idle' | 'running' | 'report'

const LABEL_ZH: Record<StudyLabel, string> = {
  focus: '专注',
  distracted: '低头',
  absent: '离席',
}

// 摄像头浮层需要 hex 颜色（不能用 CSS 变量）
const LABEL_HEX: Record<StudyLabel, string> = {
  focus: '#3d7a5a',
  distracted: '#c47a3a',
  absent: '#9a9490',
}

const INTERVAL_SEC: Record<StudyDifficulty, number> = {
  easy: 120,
  normal: 60,
  strict: 30,
}

// 虚拟摄像头关键词（启发式过滤）
const VIRTUAL_CAMERA_PATTERNS = [
  /iriun/i,
  /obs[ \-_]?virtual/i,
  /droidcam/i,
  /epoccam/i,
  /ndi[ \-_]?video/i,
  /manycam/i,
  /xsplit/i,
  /snap[ \-_]?camera/i,
  /virtual\s*webcam/i,
  /eposvox/i,
]

async function pickPhysicalVideoConstraint(): Promise<MediaTrackConstraints> {
  const base: MediaTrackConstraints = {
    width: { ideal: 640 },
    height: { ideal: 480 },
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { ...base, facingMode: 'user' }
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras = devices.filter(d => d.kind === 'videoinput')
    // 过滤掉虚拟摄像头
    const physical = cameras.find(d => {
      const label = d.label || ''
      return !VIRTUAL_CAMERA_PATTERNS.some(re => re.test(label))
    })
    if (physical?.deviceId) {
      return { ...base, deviceId: { exact: physical.deviceId } }
    }
  } catch {
    // 枚举失败时回退到 facingMode
  }
  return { ...base, facingMode: 'user' }
}

interface PatrolRecord {
  label: StudyLabel
  confidence: number
  elapsed: number
}

interface ReportData {
  durationMinutes: number
  patrolCount: number
  focusCount: number
  distractedCount: number
  absentCount: number
  focusSeconds: number
  longestFocusSeconds: number
  longestDistractedSeconds: number
  patrolHistory: PatrolRecord[]
  completed: boolean
  cameraEnabled: boolean
}

export default function StudyPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [duration, setDuration] = useState(25)
  const [difficulty, setDifficulty] = useState<StudyDifficulty>('normal')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [lastLabel, setLastLabel] = useState<StudyLabel>('focus')
  const [lastConfidence, setLastConfidence] = useState(0)
  const [patrolCount, setPatrolCount] = useState(0)
  const [focusCount, setFocusCount] = useState(0)
  const [distractedCount, setDistractedCount] = useState(0)
  const [patrolHistory, setPatrolHistory] = useState<PatrolRecord[]>([])
  const [report, setReport] = useState<ReportData | null>(null)

  const cameraEnabled = stream !== null

  const startedAtRef = useRef<number>(0)
  const focusSecondsRef = useRef<number>(0)
  const lastLabelRef = useRef<StudyLabel>('focus')
  const currentFocusStreakRef = useRef<number>(0)
  const longestFocusStreakRef = useRef<number>(0)
  const currentDistractedStreakRef = useRef<number>(0)
  const longestDistractedStreakRef = useRef<number>(0)
  const patrolHistoryRef = useRef<PatrolRecord[]>([])
  const focusCountRef = useRef(0)
  const distractedCountRef = useRef(0)
  const runningVideoRef = useRef<HTMLVideoElement>(null)

  // ★ 静默巡查回调：写 learning_records
  const onPatrol = useCallback((label: StudyLabel, confidence: number, elapsed: number) => {
    setLastLabel(label)
    setLastConfidence(confidence)
    setPatrolCount(c => c + 1)
    const record: PatrolRecord = { label, confidence, elapsed }
    patrolHistoryRef.current = [...patrolHistoryRef.current, record]
    setPatrolHistory(patrolHistoryRef.current)

    const intervalSec = INTERVAL_SEC[difficulty]
    if (label === 'focus') {
      focusSecondsRef.current += intervalSec
      focusCountRef.current += 1
      setFocusCount(focusCountRef.current)
      currentFocusStreakRef.current += intervalSec
      if (currentFocusStreakRef.current > longestFocusStreakRef.current) {
        longestFocusStreakRef.current = currentFocusStreakRef.current
      }
    } else if (label === 'distracted') {
      distractedCountRef.current += 1
      setDistractedCount(distractedCountRef.current)
      currentFocusStreakRef.current = 0
      currentDistractedStreakRef.current += intervalSec
      if (currentDistractedStreakRef.current > longestDistractedStreakRef.current) {
        longestDistractedStreakRef.current = currentDistractedStreakRef.current
      }
    } else {
      currentFocusStreakRef.current = 0
      currentDistractedStreakRef.current = 0
    }
    lastLabelRef.current = label

    const studentId = getStudentId()
    if (!studentId) return
    evaluationApi.recordAction({
      student_id: studentId,
      action: 'study_patrol',
      knowledge_point: 'study_focus',
      detail: { label, confidence, elapsed_seconds: elapsed },
    }).catch(() => { /* 静默 */ })
  }, [difficulty])

  useCameraPatrol({
    videoRef: runningVideoRef,
    enabled: phase === 'running' && cameraEnabled,
    difficulty,
    onPatrol,
  })

  // 页面卸载时彻底停止 stream
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [stream])

  // 摄像头开关（idle + running 共用）
  async function enableCamera(): Promise<boolean> {
    if (stream) return true
    if (typeof window === 'undefined' || !navigator.mediaDevices) return false
    try {
      // 优先物理摄像头：排除 Iriun / OBS Virtual / DroidCam 等虚拟摄像头
      const videoConstraint = await pickPhysicalVideoConstraint()
      const s = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false,
      })
      setStream(s)
      return true
    } catch (e) {
      console.warn('[zixi] getUserMedia 失败，回退到默认约束', e)
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setStream(s)
        return true
      } catch {
        if (typeof window !== 'undefined') {
          window.alert('摄像头权限被拒绝。你仍可以无监控模式自习。')
        }
        return false
      }
    }
  }

  function disableCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
  }

  function toggleCamera() {
    if (cameraEnabled) disableCamera()
    else void enableCamera()
  }

  // 开始会话
  async function startSession() {
    const studentId = getStudentId()
    if (!studentId) {
      if (typeof window !== 'undefined') router.push('/login')
      return
    }
    try {
      await evaluationApi.recordAction({
        student_id: studentId,
        action: 'study_session_start',
        
        knowledge_point: 'study_focus',
        detail: { camera_enabled: cameraEnabled, difficulty },
      })
    } catch { /* 静默 */ }
    startedAtRef.current = Date.now()
    focusSecondsRef.current = 0
    focusCountRef.current = 0
    distractedCountRef.current = 0
    currentFocusStreakRef.current = 0
    longestFocusStreakRef.current = 0
    currentDistractedStreakRef.current = 0
    longestDistractedStreakRef.current = 0
    lastLabelRef.current = 'focus'
    patrolHistoryRef.current = []
    setPatrolCount(0)
    setFocusCount(0)
    setDistractedCount(0)
    setPatrolHistory([])
    setLastLabel('focus')
    setLastConfidence(0)
    setRemaining(duration * 60)
    setReport(null)
    setPhase('running')
  }

  // 倒计时
  useEffect(() => {
    if (phase !== 'running') return
    const timer = window.setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          window.clearInterval(timer)
          finishSession(true)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 结束会话
  async function finishSession(completed: boolean) {
    const studentId = getStudentId()
    if (!studentId) {
      setPhase('report')
      return
    }
    const intervalSec = INTERVAL_SEC[difficulty]
    const focusedCount = focusCountRef.current
    const distractedCnt = distractedCountRef.current
    const absentCount = patrolHistoryRef.current.filter(p => p.label === 'absent').length

    // 专注时长：focus 段累计 + 末尾 focus 状态延续到结束的估算
    let focusSeconds = focusSecondsRef.current
    const lastRec = patrolHistoryRef.current.at(-1)
    const elapsedTotal = Math.floor((Date.now() - startedAtRef.current) / 1000)
    if (lastRec?.label === 'focus') {
      focusSeconds += Math.max(0, elapsedTotal - lastRec.elapsed)
    }

    try {
      await evaluationApi.recordAction({
        student_id: studentId,
        action: 'study_session_end',
        
        knowledge_point: 'study_focus',
        duration_seconds: focusSeconds,
        detail: {
          focused_seconds: focusSeconds,
          distracted_seconds: distractedCnt * intervalSec,
          absent_seconds: absentCount * intervalSec,
          patrol_count: patrolHistoryRef.current.length,
          focused_count: focusedCount,
          distracted_count: distractedCnt,
          absent_count: absentCount,
          longest_focus_streak_seconds: longestFocusStreakRef.current,
          longest_distracted_streak_seconds: longestDistractedStreakRef.current,
          completed,
          duration_minutes: duration,
          camera_enabled: cameraEnabled,
        },
      })
    } catch (e) {
      console.warn('[study] finishSession 写记录失败', e)
    }

    setReport({
      durationMinutes: duration,
      patrolCount: patrolHistoryRef.current.length,
      focusCount: focusedCount,
      distractedCount: distractedCnt,
      absentCount,
      focusSeconds,
      longestFocusSeconds: longestFocusStreakRef.current,
      longestDistractedSeconds: longestDistractedStreakRef.current,
      patrolHistory: [...patrolHistoryRef.current],
      completed,
      cameraEnabled,
    })
    setPhase('report')
  }

  // ===== UI: IDLE =====
  if (phase === 'idle') {
    return (
      <div className="study-page">
        <div className="ws-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5" />
            <path d="M9 2h6" />
          </svg>
        </div>
        <h1>自习模式</h1>
        <p className="hint">
          开启一个番茄钟，安静学习。可选开启摄像头监控——画面完全在浏览器本地处理，不传任何服务器。
        </p>

        <div className="study-config">
          <div className="study-row">
            <div>
              <div className="label">自习时长</div>
              <div className="desc">5 – 180 分钟，推荐 25 分钟</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="number"
                min={5}
                max={180}
                value={duration}
                style={{ width: 72 }}
                onChange={e => setDuration(Math.max(5, Math.min(180, Number(e.target.value) || 25)))}
              />
              <span className="unit">分钟</span>
            </div>
          </div>
          <div className="study-row">
            <div>
              <div className="label">巡查频率</div>
              <div className="desc">摄像头开启时的姿态检测间隔</div>
            </div>
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as StudyDifficulty)}
            >
              <option value="easy">宽松（每 2 分钟）</option>
              <option value="normal">标准（每 1 分钟）</option>
              <option value="strict">严格（每 30 秒）</option>
            </select>
          </div>
        </div>

        <div className="study-camera">
          <CameraToggle
            enabled={cameraEnabled}
            onChange={async (v) => {
              if (v) await enableCamera()
              else disableCamera()
            }}
            onRequestPermission={enableCamera}
          />

          {cameraEnabled && stream && (
            <div className="idle-camera-preview">
              <StreamVideo stream={stream} />
              <div className="preview-overlay">
                <div className="preview-badge">
                  <div className="rec" />
                  摄像头已就绪
                </div>
              </div>
              <div className="preview-foot">
                <span>实时预览</span>
                <div className="preview-privacy">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  仅本地处理
                </div>
              </div>
            </div>
          )}

          <div className="study-privacy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>
              摄像头画面<strong>完全在浏览器本地处理</strong>（TF.js + MoveNet），
              不上传任何图像到服务器。写入学习记录的仅为「专注 / 低头 / 离席」标签和数字时长。
            </span>
          </div>
        </div>

        <button className="study-start" onClick={startSession}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5" />
          </svg>
          开始自习
        </button>
      </div>
    )
  }

  // ===== UI: RUNNING =====
  if (phase === 'running') {
    const min = Math.floor(remaining / 60)
    const sec = remaining % 60
    const progressDeg = ((duration * 60 - remaining) / (duration * 60)) * 360

    return (
      <div className="study-running">
        <div className="running-bg" />

        <div className="running-layout">
          {/* 左：摄像头 ON / OFF */}
          {cameraEnabled && stream ? (
            <div className="running-camera">
              <StreamVideo ref={runningVideoRef} stream={stream} />
              <div className="cam-top-bar">
                <div className="cam-live-badge">
                  <div className="live-dot" />
                  LIVE
                </div>
                <button
                  className="cam-close-btn"
                  onClick={toggleCamera}
                  title="关闭摄像头"
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="cam-status-bar">
                <div className="cam-status-row">
                  <div
                    className="cam-status-indicator"
                    style={{ background: LABEL_HEX[lastLabel] }}
                  />
                  <div className="cam-status-text">{LABEL_ZH[lastLabel]}</div>
                </div>
                <div className="cam-status-meta">
                  已巡查 {patrolCount} 次 · 置信度 {lastConfidence > 0 ? `${Math.round(lastConfidence * 100)}%` : '--'}
                </div>
              </div>
            </div>
          ) : (
            <div className="running-camera-off">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <span>摄像头未开启</span>
              <button className="cam-on-btn" onClick={toggleCamera} type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                开启摄像头
              </button>
            </div>
          )}

          {/* 右：倒计时 + 元信息 */}
          <div className="running-timer-side">
            <div className="timer-ring">
              <div className="ring-progress" style={{ transform: `rotate(${progressDeg}deg)` }} />
              <div className="timer-digits">
                <span>{String(min).padStart(2, '0')}</span>
                <span className="colon">:</span>
                <span>{String(sec).padStart(2, '0')}</span>
              </div>
            </div>
            <div className="timer-sub">
              {cameraEnabled ? '静默监控中 · 结束后查看报告' : '摄像头已关闭 · 仅计时模式'}
            </div>
            <div className="timer-meta">
              <div className="meta-item">
                <div className="meta-val">{patrolCount}</div>
                <div className="meta-label">巡查</div>
              </div>
              <div className="meta-item">
                <div className="meta-val">{focusCount}</div>
                <div className="meta-label">专注</div>
              </div>
              <div className="meta-item">
                <div className="meta-val">{distractedCount}</div>
                <div className="meta-label">低头</div>
              </div>
            </div>
            <button className="exit-btn" onClick={() => finishSession(false)} type="button">
              提前结束
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===== UI: REPORT =====
  if (phase === 'report' && report) {
    const focusRate = report.patrolCount > 0
      ? Math.round((report.focusCount / report.patrolCount) * 100)
      : 0

    return (
      <div className="study-report">
        <h1>本次自习报告</h1>
        <p className="report-hint">
          所有统计数据已自动写入学习记录，专注力画像将在下次分析时更新。
        </p>

        <div className="study-stats">
          <div className="study-stat">
            <div className="stat-num">{report.durationMinutes}</div>
            <div className="stat-label">时长（分钟）</div>
          </div>
          <div className="study-stat">
            <div className="stat-num">{report.patrolCount}</div>
            <div className="stat-label">巡查次数</div>
          </div>
          <div className="study-stat">
            <div className="stat-num">{report.cameraEnabled ? `${focusRate}%` : '--'}</div>
            <div className="stat-label">专注率</div>
          </div>
        </div>

        <div className="report-card">
          <div className="report-row">
            <span className="r-label">完成状态</span>
            <span className={`r-value ${report.completed ? 'good' : 'warn'}`}>
              {report.completed ? '完成' : '提前结束'}
            </span>
          </div>
          <div className="report-row">
            <span className="r-label">专注时长</span>
            <span className="r-value">{formatSeconds(report.focusSeconds)}</span>
          </div>
          <div className="report-row">
            <span className="r-label">低头次数</span>
            <span className="r-value">{report.distractedCount}</span>
          </div>
          <div className="report-row">
            <span className="r-label">离席次数</span>
            <span className="r-value">{report.absentCount}</span>
          </div>
          <div className="report-row">
            <span className="r-label">最长连续专注</span>
            <span className="r-value good">{formatSeconds(report.longestFocusSeconds)}</span>
          </div>
          <div className="report-row">
            <span className="r-label">最长连续走神</span>
            <span className="r-value warn">{formatSeconds(report.longestDistractedSeconds)}</span>
          </div>
        </div>

        {report.cameraEnabled && report.patrolHistory.length > 0 && (
          <div className="patrol-timeline">
            <h3>巡查时间线</h3>
            <div className="timeline-dots">
              {report.patrolHistory.map((p, i) => (
                <div
                  key={i}
                  className={`timeline-dot ${p.label}`}
                  data-tip={`#${i + 1} ${LABEL_ZH[p.label]} ${Math.round(p.confidence * 100)}%`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="timeline-legend">
              <div className="leg"><div className="leg-dot" style={{ background: 'var(--success)' }} />专注</div>
              <div className="leg"><div className="leg-dot" style={{ background: 'var(--warm)' }} />低头</div>
              <div className="leg"><div className="leg-dot" style={{ background: 'var(--ink-4)' }} />离席</div>
            </div>
          </div>
        )}

        <div className="report-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>
            你的自习数据已写入学习记录。系统每 4 小时自动分析一次，
            届时<strong>专注力画像</strong>将反映本次学习情况。
          </span>
        </div>

        <div className="report-actions">
          <button
            className="btn"
            onClick={() => {
              disableCamera()
              setReport(null)
              setPatrolHistory([])
              setPatrolCount(0)
              setFocusCount(0)
              setDistractedCount(0)
              setPhase('idle')
            }}
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            再来一次
          </button>
          <button className="btn btn-solid" onClick={() => router.push('/')} type="button">
            返回首页
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M5 12h14" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return null
}

/**
 * StreamVideo — 把 MediaStream 绑到 video 元素
 *
 * 设计要点：
 * - callback ref 必须稳定（useCallback），否则 React 在每次 re-render 时会
 *   先调旧 ref(null) 再调新 ref(el)，导致 srcObject 被反复重设、play() 反复重启，
 *   视频每秒闪烁黑屏。
 * - srcObject 设置放进 useEffect，只在 stream 真正变化时执行。
 */
const StreamVideo = forwardRef<HTMLVideoElement, { stream: MediaStream | null }>(
  function StreamVideo({ stream }, ref) {
    const videoRef = useRef<HTMLVideoElement | null>(null)

    // stream 变化时同步 srcObject 并 play
    useEffect(() => {
      const el = videoRef.current
      if (!el) return
      el.srcObject = stream
      if (stream) el.play().catch(() => {})
    }, [stream])

    // 稳定的 callback ref：合并本地 ref + 父 ref，只在 mount/unmount 执行
    const combinedRef = useCallback((el: HTMLVideoElement | null) => {
      videoRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as MutableRefObject<HTMLVideoElement | null>).current = el
    }, [ref])

    return <video ref={combinedRef} autoPlay playsInline muted />
  }
)

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}秒`
  return `${m}分${sec > 0 ? sec + '秒' : ''}`
}