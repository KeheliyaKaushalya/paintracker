import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useTheme } from '../../styles/useTheme'
import { toUnixSeconds } from '../../lib/dates'
import type { Round } from '../../lib/models'
import { oldestFirst } from '../../lib/rounds'

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'

/** Pain scores over time (0-10). Expects pain rounds only. Cough and physio lines appear only if any round has them. */
export default function PainChart({ rounds }: { rounds: Round[] }) {
  const host = useRef<HTMLDivElement>(null)
  const { effective } = useTheme() // redraw when the theme changes
  const hasCough = rounds.some((r) => r.pain_cough != null)
  const hasPhysio = rounds.some((r) => r.pain_physio != null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const sorted = [...rounds].sort(oldestFirst)
    const times = sorted.map((r) => toUnixSeconds(r.round_date, r.round_time, r.session))
    const data: uPlot.AlignedData = [
      times,
      sorted.map((r) => r.pain_rest),
      sorted.map((r) => r.pain_move),
      sorted.map((r) => r.pain_cough),
      sorted.map((r) => r.pain_physio),
    ]
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
      legend: { show: false },
      scales: { x: { time: true }, y: { range: [0, 10] } },
      axes: [
        { stroke: muted, grid, ticks: grid, space: 64, size: 44, values: (_u, splits) => splits.map((v) => stamp(v)) },
        { stroke: muted, grid, ticks: grid, splits: () => [0, 2, 4, 6, 8, 10] },
      ],
      series: [
        {},
        { label: 'Rest', stroke: cssVar('--primary-ink'), width: 2, points: { show: true, size: 7 } },
        { label: 'Movement', stroke: cssVar('--alert'), width: 2, points: { show: true, size: 7 }, dash: [6, 4] },
        { label: 'Cough', stroke: cssVar('--warn'), width: 2, spanGaps: true, points: { show: true, size: 7 }, dash: [2, 4], show: hasCough },
        { label: 'Physio', stroke: '#3D6A8F', width: 2, spanGaps: true, points: { show: true, size: 7 }, dash: [8, 3, 2, 3], show: hasPhysio },
      ],
    }
    const plot = new uPlot(opts, data, el)
    const ro = new ResizeObserver(() => plot.setSize({ width: Math.max(el.clientWidth, 240), height: 210 }))
    ro.observe(el)
    return () => { ro.disconnect(); plot.destroy() }
  }, [rounds, effective, hasCough, hasPhysio])

  const swatch = (color: string, style: string, text: string) => (
    <span key={text}><span style={{ display: 'inline-block', width: 18, borderTop: `3px ${style} ${color}`, verticalAlign: 'middle', marginRight: 6 }} />{text}</span>
  )

  return (
    <div>
      <div ref={host} className="chart-wrap" role="img" aria-label="Chart of pain scores over time" />
      <div className="row wrap faint" style={{ gap: 16, marginTop: 6 }} aria-hidden="true">
        {swatch('var(--primary-ink)', 'solid', 'Rest')}
        {swatch('var(--alert)', 'dashed', 'Movement')}
        {hasCough && swatch('var(--warn)', 'dotted', 'Cough')}
        {hasPhysio && swatch('#3D6A8F', 'dashed', 'Physio')}
      </div>
    </div>
  )
}