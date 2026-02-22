'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useCounterContract } from '@/hooks/useMyContract'
import { Header } from './components/Header'
import { toast } from 'react-toastify'
import { Search, ChevronDown, ChevronUp, Lock, Play, Unlock, Star, Clock, BookOpen } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL ?? 'http://localhost:8000'
const UNLOCK_PRICE_ETH = '0.001'
const PREVIEW_SECONDS = 40

interface Course {
  id?: string
  score?: number
  courseTitle?: string
  lectureTitle?: string
  youtubeUrl?: string
}

interface GroupedCourse {
  courseTitle: string
  lectures: Course[]
}

function extractYoutubeId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('v')
  } catch {
    return null
  }
}

function groupByCourse(courses: Course[]): GroupedCourse[] {
  const map = new Map<string, Course[]>()
  for (const course of courses) {
    const key = course.courseTitle ?? 'Untitled Course'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(course)
  }
  return Array.from(map.entries()).map(([courseTitle, lectures]) => ({ courseTitle, lectures }))
}

async function fetchCourses(query: string): Promise<Course[]> {
  const res = await fetch(`${FASTAPI_URL}/search?query=${encodeURIComponent(query)}&top_k=20`)
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`)
  const data = await res.json()
  return data.results as Course[]
}

// Stable iframe — rendered once, never re-mounts. Hidden via CSS when not needed.
function StableIframe({ videoId, lectureTitle, active }: {
  videoId: string
  lectureTitle: string
  active: boolean
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`

  useEffect(() => {
    const el = iframeRef.current
    if (!el) return
    if (active) {
      // Only restore src if it was previously cleared
      if (!el.getAttribute('src')) el.setAttribute('src', src)
    } else {
      // Wipe src directly on the DOM node — stops audio+video without unmounting
      el.setAttribute('src', '')
    }
  }, [active, src])

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={lectureTitle}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="absolute inset-0 h-full w-full"
    />
  )
}

// ─── Preview Player ───────────────────────────────────────────────────────────
function PreviewPlayer({ videoId, lectureTitle, onUnlock, unlocked }: {
  videoId: string
  lectureTitle: string
  onUnlock: () => Promise<void>
  unlocked: boolean
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // iframeLoaded: once true the iframe stays in the DOM forever — no flicker
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'ended'>('idle')
  const [paying, setPaying] = useState(false)
  const [countdown, setCountdown] = useState(PREVIEW_SECONDS)

  const stopTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const startPreview = () => {
    stopTimers()
    setCountdown(PREVIEW_SECONDS)
    setIframeLoaded(true)  // mount iframe once, never unmount
    setPhase('playing')

    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current!); return 0 }
        return c - 1
      })
    }, 1000)

    timerRef.current = setTimeout(() => {
      stopTimers()
      setPhase('ended')
    }, PREVIEW_SECONDS * 1000)
  }

  useEffect(() => () => stopTimers(), [])

  const handlePay = async () => {
    setPaying(true)
    try { await onUnlock() } finally { setPaying(false) }
  }

  const showIframe = unlocked || iframeLoaded

  return (
    <div className="relative aspect-video w-full bg-black overflow-hidden">

      {/* Iframe lives here permanently once mounted — display:none hides it when ended */}
      {showIframe && (
        <StableIframe
          videoId={videoId}
          lectureTitle={lectureTitle}
          active={unlocked || phase === 'playing'}
        />
      )}

      {/* Thumbnail — shown before iframe is ever loaded */}
      {!iframeLoaded && !unlocked && (
        <img
          src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
          alt={lectureTitle}
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
      )}

      {/* Overlay — hidden while playing, visible when idle or ended */}
      {!unlocked && phase !== 'playing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-[2px]">
          {phase === 'ended' ? (
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <div className="rounded-full bg-gray-800 p-4 border border-gray-700">
                <Lock className="h-7 w-7 text-gray-300" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Preview ended</p>
                <p className="text-gray-400 text-sm mt-1">
                  Unlock the full lecture for {UNLOCK_PRICE_ETH} ETH
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={startPreview}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:border-gray-400 hover:text-white transition-colors"
                >
                  Replay preview
                </button>
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  <Unlock className="h-4 w-4" />
                  {paying ? 'Processing...' : 'Pay & Watch'}
                </button>
              </div>
            </div>
          ) : (
            // Idle
            <div className="flex flex-col items-center gap-4">
              <button onClick={startPreview} className="group flex flex-col items-center gap-2">
                <div className="rounded-full bg-white/10 p-5 border border-white/20 group-hover:bg-violet-600/80 group-hover:border-violet-500 transition-all">
                  <Play className="h-8 w-8 text-white" />
                </div>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors font-medium">
                  Watch {PREVIEW_SECONDS}s free preview
                </span>
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex items-center gap-2 rounded-full border border-violet-400/50 px-5 py-2 text-sm font-medium text-violet-300 hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all disabled:opacity-50"
              >
                <Unlock className="h-3.5 w-3.5" />
                {paying ? 'Processing...' : `Unlock full lecture — ${UNLOCK_PRICE_ETH} ETH`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Countdown badge — only while playing */}
      {!unlocked && phase === 'playing' && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur-sm pointer-events-none">
          <Clock className="h-3 w-3 text-violet-400" />
          <span className="text-xs font-mono font-semibold text-white">{countdown}s left</span>
        </div>
      )}

      {/* Unlock-early button — only while playing */}
      {!unlocked && phase === 'playing' && (
        <button
          onClick={handlePay}
          disabled={paying}
          className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          <Unlock className="h-3 w-3" />
          {paying ? 'Processing...' : `Unlock — ${UNLOCK_PRICE_ETH} ETH`}
        </button>
      )}
    </div>
  )
}

// ─── Lecture Card ─────────────────────────────────────────────────────────────
function LectureCard({ lecture, index, onPay }: {
  lecture: Course
  index: number
  onPay: (id: string) => Promise<boolean>
}) {
  const [expanded, setExpanded] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const videoId = lecture.youtubeUrl ? extractYoutubeId(lecture.youtubeUrl) : null
  const lectureKey = lecture.id ?? lecture.lectureTitle ?? String(index)

  const handleUnlock = async () => {
    const ok = await onPay(lectureKey)
    if (ok) setUnlocked(true)
  }

  return (
    <div className={`rounded-xl border transition-all overflow-hidden bg-white ${expanded ? 'border-violet-200 shadow-md' : 'border-gray-200 hover:border-gray-300'
      }`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-3.5 text-left"
      >
        <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
          {index + 1}
        </span>
        {videoId && (
          <img
            src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
            alt=""
            className="h-9 w-14 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {lecture.lectureTitle ?? 'Untitled Lecture'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {unlocked ? 'Full access' : `${UNLOCK_PRICE_ETH} ETH to unlock`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unlocked
            ? <span className="flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-medium text-green-600"><Unlock className="h-3 w-3" />Unlocked</span>
            : <span className="flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-400"><Lock className="h-3 w-3" />Locked</span>
          }
          {expanded
            ? <ChevronUp className="h-4 w-4 text-gray-400" />
            : <ChevronDown className="h-4 w-4 text-gray-400" />
          }
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {videoId
            ? <PreviewPlayer videoId={videoId} lectureTitle={lecture.lectureTitle ?? ''} onUnlock={handleUnlock} unlocked={unlocked} />
            : <p className="px-5 py-4 text-sm text-gray-400">No video available.</p>
          }
        </div>
      )}
    </div>
  )
}

// ─── Course Group ─────────────────────────────────────────────────────────────
function CourseGroup({ group, onPay }: {
  group: GroupedCourse
  onPay: (id: string) => Promise<boolean>
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100">
            <BookOpen className="h-4 w-4 text-violet-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900 truncate">{group.courseTitle}</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-500">
                {group.lectures.length} lecture{group.lectures.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <Star className="h-3 w-3 fill-amber-400" />4.5
              </span>
            </div>
          </div>
        </div>
        {collapsed
          ? <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
          : <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" />
        }
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-2 border-t border-gray-200 px-4 pb-4 pt-3">
          {group.lectures.map((lecture, i) => (
            <LectureCard key={lecture.id ?? i} lecture={lecture} index={i} onPay={onPay} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { authenticated } = usePrivy()
  const { isPending, increaseCounter } = useCounterContract()

  const [query, setQuery] = useState('')
  const [grouped, setGrouped] = useState<GroupedCourse[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const results = await fetchCourses(query.trim())
      const groups = groupByCourse(results)
      setGrouped(groups)
      if (groups.length === 0) toast.info('No courses found.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handlePay = async (_lectureId: string): Promise<boolean> => {
    if (!authenticated) {
      toast.error('Connect your wallet to unlock lectures.')
      return false
    }
    try {
      // Swap increaseCounter() with: sendTransaction({ to: PAYMENT_ADDRESS, value: parseEther(UNLOCK_PRICE_ETH) })
      const txPromise = increaseCounter()
      await toast.promise(txPromise, {
        pending: 'Processing payment...',
        success: {
          render({ data }) {
            const h = String(data ?? '')
            return `Unlocked! Tx: ${h.slice(0, 10)}...${h.slice(-6)}`
          }
        },
        error: {
          render({ data }) {
            return data instanceof Error ? data.message : 'Payment failed.'
          }
        },
      })
      return true
    } catch {
      return false
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 pt-14">

        {/* Hero */}
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3 sm:text-5xl">
              Learn anything, anywhere
            </h1>
            <p className="text-violet-200 text-lg mb-8">
              Search thousands of lectures. Preview free, unlock with crypto.
            </p>
            <div className="flex overflow-hidden rounded-xl bg-white shadow-lg">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search for a topic, skill, or course..."
                className="flex-1 bg-transparent px-5 py-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="flex items-center gap-2 bg-violet-600 px-6 py-4 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-40"
              >
                <Search className="h-4 w-4" />
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mx-auto max-w-4xl px-6 py-10">
          {grouped.length > 0 ? (
            <>
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  {grouped.length} course{grouped.length !== 1 ? 's' : ''} &middot; {grouped.reduce((a, g) => a + g.lectures.length, 0)} lectures
                </p>
                <p className="text-xs text-gray-400">Results for &ldquo;{query}&rdquo;</p>
              </div>
              <div className="flex flex-col gap-4">
                {grouped.map(group => (
                  <CourseGroup key={group.courseTitle} group={group} onPay={handlePay} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Search className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-base font-semibold text-gray-500">Search to discover courses</p>
              <p className="text-sm text-gray-400 mt-1">Try topics like "React", "Machine Learning", or "Design"</p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}