import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useTheme } from '../../styles/useTheme'
import { toUnixSeconds } from '../../lib/dates'
import type { Round } from '../../lib/models'
import { oldestFirst } from '../../lib/rounds'

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'

/** Rest and movement pain over time (0-10). Expects pain rounds only. */
export default function PainChart({ rounds }: { rounds: Round[] }) {
  const host = useRef<HTMLDivElement>(null)
  const { effective } = useTheme() // redraw when the theme changes

  useEffect(() => {
    const el = host.current
    if (!el) return
    const sorted = [...rounds].sort(oldestFirst)
    const times = sorted.map((r) => toUnixSeconds(r.round_date, r.round_time, r.session))
    const data: uPlot.AlignedData = [times, sorted.map((r) => r.pain_rest), sorted.map((r) => r.pain_move)]
    const muted = cssVar('--ink-muted')
    const grid = { stroke: cssVar('--line'), width: 1 }
    const stamp = (v: number) => {
      const d = new Date(v * 1000)
      const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      return `${day}\n${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    const opts: uPlot.Options = {
      width: Math.max(el.clientWidth, 240),
      height: 210,
      legend: { show: false }, // we draw our own below (the built-in one shows "--" until you hover)
      scales: { x: { time: true }, y: { range: [0, 10] } },
      axes: [
        { stroke: muted, grid, ticks: grid, space: 64, size: 44, values: (_u, splits) => splits.map((v) => stamp(v)) },
        { stroke: muted, grid, ticks: grid, splits: () => [0, 2, 4, 6, 8, 10] },
      ],
      series: [
        {},
        { label: 'Rest', stroke: cssVar('--primary-ink'), width: 2, points: { show: true, size: 7 } },
        { label: 'Movement', stroke: cssVar('--alert'), width: 2, points: { show: true, size: 7 }, dash: [6, 4] },
      ],
    }
    const plot = new uPlot(opts, data, el)
    const ro = new ResizeObserver(() => plot.setSize({ width: Math.max(el.clientWidth, 240), height: 210 }))
    ro.observe(el)
    return () => { ro.disconnect(); plot.destroy() }
  }, [rounds, effective])

  return (
    <div>
      <div ref={host} className="chart-wrap" role="img" aria-label="Chart of rest and movement pain scores over time" />
      <div className="row wrap faint" style={{ gap: 16, marginTop: 6 }} aria-hidden="true">
        <span><span style={{ display: 'inline-block', width: 18, borderTop: '3px solid var(--primary-ink)', verticalAlign: 'middle', marginRight: 6 }} />Rest</span>
        <span><span style={{ display: 'inline-block', width: 18, borderTop: '3px dashed var(--alert)', verticalAlign: 'middle', marginRight: 6 }} />Movement</span>
      </div>
    </div>
  )
}
