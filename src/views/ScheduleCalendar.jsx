import React, { useMemo, useRef, useState } from 'react'
import { GREEN, INK, FAINT, LINE, LINE_SOFT, SUB, colorOf, subjectOf, fromISO, toISO, mergeDates, md } from '../logic.js'
import useWindowWidth from '../useWindowWidth.js'

// 일정 달력 뷰 — 이름을 따로 넣지 않고 수업 없는 날만 칠하는 간편 등록.
// 누르거나 죽 끌면 그 날이 휴업일로 들어가고, 이미 칠해진 날을 누르면 지워진다.
// 이름·유형이 필요한 일정(고사·행사 등)은 일정뷰에서 넣는다.
export const TYPE_COLOR = { 고사: '#A32D2D', 행사: '#BA7517', 휴업일: '#3F5C4C', 개인: '#185FA5' }
// 수업이 없는 날임을 한눈에 알 수 있게 칸 전체에 옅은 배경도 함께 깐다
export const TYPE_BG = { 고사: '#F7E7E4', 행사: '#F8EEDA', 휴업일: '#E6ECE7', 개인: '#E4EBF5' }
const OFF = '휴업일'

// computed·subject 를 주면 날짜 밑에 그 날의 최소 차시를 동그라미로 표시한다.
// paintable 이 false 면 보기 전용 (차시별 내용의 달력 탭).
export default function ScheduleCalendar({ data, setData, setSnack, computed, subject, onToggleView, actions, paintable = false }) {
  const { isMobile } = useWindowWidth()
  const today = toISO(new Date())
  const initMonth = () => {
    const base = today >= data.semStart && today <= data.semEnd ? today : data.semStart || today
    const d = fromISO(base)
    return { y: d.getFullYear(), m: d.getMonth() }
  }
  const [ym, setYm] = useState(initMonth)
  // 한 번의 칠하기(누름→끌기→뗌)를 통째로 되돌릴 수 있게 시작 시점을 기록해 둔다.
  // 렌더에 쓰이지 않으므로 state 가 아니라 ref — 같은 틱에 들어오는 mouseenter 도 놓치지 않는다.
  const gesture = useRef(null) // {mode, prev, first, last}

  const monthLabel = ym.y + '.' + String(ym.m + 1).padStart(2, '0')

  // 이 달의 주 배열 (일~토)
  const weeks = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1)
    const start = new Date(ym.y, ym.m, 1 - first.getDay())
    const out = []
    let cur = start
    while (cur <= new Date(ym.y, ym.m + 1, 0) || out.length === 0 || cur.getDay() !== 0) {
      if (cur.getDay() === 0) out.push([])
      out[out.length - 1].push({ iso: toISO(cur), day: cur.getDate(), inMonth: cur.getMonth() === ym.m })
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
      if (out.length > 6) break
    }
    return out
  }, [ym])

  const eventsOn = iso => data.events.filter(e => e.start <= iso && iso <= e.end)

  // 그 날의 최소 차시 (과목이 주어지면 그 과목 반만) — 날짜 밑 동그라미로 보여준다
  const sessionOn = iso => {
    if (!computed) return null
    let best = null
    for (let p = 1; p <= 7; p++) {
      const s = computed.sessions[iso + '|' + p]
      if (!s || s.canceled || !s.num) continue
      if (subject && subjectOf(data, s.cls) !== subject) continue
      if (!best || s.num < best.num) best = s
    }
    return best
  }

  const moveMonth = d => {
    setYm(({ y, m }) => {
      const nd = new Date(y, m + d, 1)
      return { y: nd.getFullYear(), m: nd.getMonth() }
    })
  }

  // 칠하기 — 이름 없이 휴업일로 넣고, 이어붙은 날은 한 건으로 묶는다.
  // 지울 때도 그 하루만 빠지도록 남은 날들로 다시 묶는다. 이름이 있는 일정은 통째로 뺀다.
  const isPlain = e => e.type === OFF && e.name === OFF
  const apply = (iso, mode) => {
    setData(d => {
      const covering = d.events.filter(e => e.start <= iso && iso <= e.end)
      if (mode === 'on' ? covering.length > 0 : covering.length === 0) return d
      const days = new Set()
      for (const e of d.events.filter(isPlain)) {
        let x = fromISO(e.start)
        const last = fromISO(e.end)
        while (x <= last) {
          days.add(toISO(x))
          x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)
        }
      }
      let rest = d.events.filter(e => !isPlain(e))
      if (mode === 'off') {
        days.delete(iso)
        rest = rest.filter(e => !(e.start <= iso && iso <= e.end))
      } else {
        days.add(iso)
      }
      const base = Date.now()
      const merged = mergeDates([...days]).map((r, i) => ({ id: base + i, start: r.start, end: r.end, name: OFF, type: OFF }))
      return { ...d, events: [...rest, ...merged] }
    })
  }

  const down = iso => {
    if (!paintable) return
    const mode = eventsOn(iso).length ? 'off' : 'on'
    gesture.current = { mode, prev: data.events, first: iso, last: iso }
    apply(iso, mode)
  }
  const over = iso => {
    const g = gesture.current
    if (!g || g.last === iso) return
    g.last = iso
    apply(iso, g.mode)
  }
  const up = () => {
    const g = gesture.current
    if (!g) return
    gesture.current = null
    const a = g.first <= g.last ? g.first : g.last
    const b = g.first <= g.last ? g.last : g.first
    const range = a === b ? md(a) : md(a) + '~' + md(b)
    setSnack({
      text: g.mode === 'off' ? range + ' 일정을 지웠습니다.' : range + ' 수업 없는 날로 등록했습니다.',
      kind: 'events',
      prev: g.prev,
    })
  }
  // 모바일: 손가락을 끌면 지나간 칸이 함께 칠해진다
  const touchMove = e => {
    if (!gesture.current) return
    const t = e.touches[0]
    const el = document.elementFromPoint(t.clientX, t.clientY)
    const box = el && el.closest('[data-iso]')
    if (box) over(box.dataset.iso)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, flex: 'none' }}>
        {/* 월 이동은 제목 바로 옆에 붙여 눈에 띄게 */}
        <button className="hov" onClick={() => moveMonth(-1)} title="이전 달" style={calNav}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', minWidth: 62, textAlign: 'center' }}>{monthLabel}</span>
        <button className="hov" onClick={() => moveMonth(1)} title="다음 달" style={calNav}>›</button>
        <div style={{ flex: 1 }} />
        {actions}
        {onToggleView && (
          <button className="hov" onClick={onToggleView} title="목록으로 보기" style={{ border: 'none', background: 'none', padding: 5, borderRadius: 6, cursor: 'pointer', color: SUB, display: 'flex', flex: 'none' }}>
            <ListIcon />
          </button>
        )}
      </div>

      <div
        onMouseUp={up}
        onMouseLeave={up}
        onTouchMove={touchMove}
        onTouchEnd={up}
        style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', userSelect: 'none', touchAction: paintable ? 'none' : 'auto' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#F4F2ED', flex: 'none' }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} style={{ padding: '5px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#B0574A' : i === 6 ? '#4A6B9B' : SUB }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(' + weeks.length + ',1fr)', flex: 1, minHeight: 0 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderTop: '1px solid ' + LINE_SOFT, minHeight: 0 }}>
              {week.map(cell => {
                const evs = eventsOn(cell.iso)
                const isToday = cell.iso === today
                const types = [...new Set(evs.map(e => e.type))].slice(0, 2)
                const ses = cell.inMonth ? sessionOn(cell.iso) : null
                const off = evs.length > 0 // 일정이 있으면 그 날은 수업이 빠진다
                const plain = evs.length === 1 && evs[0].name === OFF // 간편 등록한 휴업일은 글자 없이 X 만
                return (
                  <div
                    key={cell.iso}
                    data-iso={cell.iso}
                    onMouseDown={() => down(cell.iso)}
                    onMouseEnter={() => over(cell.iso)}
                    onTouchStart={() => down(cell.iso)}
                    style={{
                      position: 'relative', minHeight: isMobile ? 44 : 0, padding: '4px 0 2px',
                      borderLeft: '1px solid ' + LINE_SOFT, cursor: paintable ? 'pointer' : 'default', boxSizing: 'border-box',
                      background: off ? (TYPE_BG[types[0]] || '#EFEDE8') : '#FFFFFF',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                      opacity: cell.inMonth ? 1 : 0.32, overflow: 'hidden',
                    }}
                  >
                    {/* 수업이 빠지는 날은 칸을 가로지르는 큰 X */}
                    {off && (
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                        <line x1="8" y1="8" x2="92" y2="92" stroke={TYPE_COLOR[types[0]] || SUB} strokeWidth="4" strokeLinecap="round" opacity="0.5" vectorEffect="non-scaling-stroke" />
                        <line x1="92" y1="8" x2="8" y2="92" stroke={TYPE_COLOR[types[0]] || SUB} strokeWidth="4" strokeLinecap="round" opacity="0.5" vectorEffect="non-scaling-stroke" />
                      </svg>
                    )}
                    <span
                      style={{
                        position: 'relative',
                        fontSize: 12, lineHeight: 1.4, fontWeight: isToday ? 800 : 400,
                        color: isToday ? '#FFFFFF' : INK,
                        background: isToday ? GREEN : 'transparent',
                        borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {cell.day}
                    </span>
                    {(ses || (off && !plain)) && (
                      <span style={{ position: 'relative', display: 'flex', gap: 3, alignItems: 'center', maxWidth: '100%' }}>
                        {ses && (
                          <span
                            title={ses.cls + ' ' + ses.num + '차시'}
                            style={{
                              minWidth: 17, height: 17, padding: '0 3px', borderRadius: 999, boxSizing: 'border-box',
                              background: colorOf(data, ses.cls), border: '1px solid rgba(26,26,26,0.16)',
                              fontSize: 10, fontWeight: 700, color: INK,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                            }}
                          >
                            {ses.num}
                          </span>
                        )}
                        {off && !plain && (
                          <span
                            style={{
                              fontSize: 9.5, fontWeight: 700, color: TYPE_COLOR[types[0]] || SUB,
                              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                          >
                            {evs[0].name}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {paintable && (
        <div style={{ marginTop: 6, fontSize: 12, color: FAINT, flex: 'none' }}>
          수업 없는 날을 누르거나 죽 끌어서 칠하세요. 칠한 날을 다시 누르면 지워집니다.
        </div>
      )}
    </div>
  )
}

export function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </svg>
  )
}

export function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  )
}

export function XMark({ color }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

// 월 이동 — 제목 옆에서 바로 눈에 띄도록 테두리를 준다
const calNav = {
  border: '1px solid ' + LINE, background: '#FFFFFF', borderRadius: 6, cursor: 'pointer', color: INK,
  padding: '0 9px 3px', fontSize: 17, lineHeight: '22px', height: 26, flex: 'none', fontWeight: 700,
}
