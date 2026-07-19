'use client'

/**
 * 自习摄像头巡查 Hook（v2）
 * - 页面拥有 MediaStream（idle 与 running 共享）
 * - 本 hook 只负责：懒加载 TF.js + MoveNet + 定时推理
 * - 通过 onPatrol 回调返回 label
 *
 * 设计原则：
 * - 模型懒加载（首次启用时 ~3MB）
 * - 加载失败优雅降级（isModelReady=true 但无 detector → 报 absent）
 * - 卸载 / enabled 翻转时清理 detector + interval
 */
import { useEffect, useRef, useState, type RefObject } from 'react'

export type StudyLabel = 'focus' | 'distracted' | 'absent'
export type StudyDifficulty = 'easy' | 'normal' | 'strict'

const INTERVAL_MAP: Record<StudyDifficulty, number> = {
  easy: 120,
  normal: 60,
  strict: 30,
}

const HEAD_DOWN_RATIO = 0.5
const ABSENT_CONSECUTIVE = 3
const KEYPOINT_SCORE_MIN = 0.3
const SHOULDER_WIDTH_MIN = 10

interface Keypoint {
  name?: string
  x: number
  y: number
  score?: number
}

interface Pose {
  keypoints: Keypoint[]
}

interface MoveNetDetector {
  estimatePoses: (input: HTMLVideoElement) => Promise<Pose[]>
  dispose?: () => void
}

export function useCameraPatrol({
  videoRef,
  enabled,
  difficulty,
  onPatrol,
}: {
  videoRef: RefObject<HTMLVideoElement>
  enabled: boolean
  difficulty: StudyDifficulty
  onPatrol: (label: StudyLabel, confidence: number, elapsedSeconds: number) => void
}) {
  const detectorRef = useRef<MoveNetDetector | null>(null)
  const intervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const absentStreakRef = useRef<number>(0)
  const onPatrolRef = useRef(onPatrol)
  const [isModelReady, setIsModelReady] = useState(false)

  useEffect(() => { onPatrolRef.current = onPatrol }, [onPatrol])

  // 1. 懒加载 TF.js + MoveNet
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let localDetector: MoveNetDetector | null = null
    ;(async () => {
      try {
        const tf = await import('@tensorflow/tfjs')
        const poseDetection = await import('@tensorflow-models/pose-detection')
        if (cancelled) return
        await tf.ready()
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        )
        if (cancelled) {
          detector.dispose?.()
          return
        }
        localDetector = detector as unknown as MoveNetDetector
        detectorRef.current = localDetector
        setIsModelReady(true)
      } catch (e) {
        console.warn('[useCameraPatrol] TF.js / MoveNet 加载失败，降级为无监控模式', e)
        setIsModelReady(true)
      }
    })()
    return () => {
      cancelled = true
      if (localDetector) localDetector.dispose?.()
      detectorRef.current = null
      setIsModelReady(false)
    }
  }, [enabled])

  // 2. 定时巡查（只在 enabled && modelReady 时启动）
  useEffect(() => {
    if (!enabled || !isModelReady) return
    startTimeRef.current = Date.now()
    absentStreakRef.current = 0

    const intervalMs = INTERVAL_MAP[difficulty] * 1000
    intervalRef.current = window.setInterval(() => {
      const detector = detectorRef.current
      const video = videoRef.current
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)

      if (!detector || !video || video.readyState < 2) {
        // 视频流未就绪或模型未加载 → 累计 absent
        absentStreakRef.current += 1
        if (absentStreakRef.current >= ABSENT_CONSECUTIVE) {
          onPatrolRef.current('absent', 0, elapsed)
        }
        return
      }
      try {
        detector.estimatePoses(video).then(poses => {
          const label = judgePose(poses)
          const confidence = computeConfidence(poses)
          if (label === 'absent') {
            absentStreakRef.current += 1
            if (absentStreakRef.current < ABSENT_CONSECUTIVE) return
          } else {
            absentStreakRef.current = 0
          }
          onPatrolRef.current(label, confidence, elapsed)
        }).catch(e => {
          console.warn('[useCameraPatrol] 推理失败', e)
        })
      } catch (e) {
        console.warn('[useCameraPatrol] 推理同步失败', e)
      }
    }, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, isModelReady, difficulty, videoRef])

  return { isModelReady }
}

// ===== 行为判定（参考 v2.0 方案） =====
function getKeypoint(poses: Pose[], name: string): Keypoint | undefined {
  return poses?.[0]?.keypoints?.find(k => k.name === name)
}

function judgePose(poses: Pose[]): StudyLabel {
  const nose = getKeypoint(poses, 'nose')
  const ls = getKeypoint(poses, 'left_shoulder')
  const rs = getKeypoint(poses, 'right_shoulder')
  if (!nose || !ls || !rs) return 'absent'
  if ((nose.score ?? 0) < KEYPOINT_SCORE_MIN
      || (ls.score ?? 0) < KEYPOINT_SCORE_MIN
      || (rs.score ?? 0) < KEYPOINT_SCORE_MIN) {
    return 'absent'
  }
  const shoulderMidY = (ls.y + rs.y) / 2
  const shoulderWidth = Math.abs(ls.x - rs.x)
  if (shoulderWidth < SHOULDER_WIDTH_MIN) return 'absent'
  const dy = shoulderMidY - nose.y
  const ratio = dy / (shoulderWidth + 0.01)
  return ratio > HEAD_DOWN_RATIO ? 'distracted' : 'focus'
}

function computeConfidence(poses: Pose[]): number {
  const kps = poses?.[0]?.keypoints
  if (!kps) return 0
  const sum = ['nose', 'left_shoulder', 'right_shoulder']
    .map(n => kps.find(k => k.name === n)?.score ?? 0)
    .reduce((a, b) => a + b, 0)
  return Math.round((sum / 3) * 100) / 100
}