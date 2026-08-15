import React, { useMemo, useRef, useState } from 'react'
import { DAYS, GREEN, INK, FAINT, LINE, LINE_SOFT, SUB, colorOf, subjectOf, fromISO, toISO } from '../logic.js'
import useWindowWidth from '../useWindowWidth.js'

// 미니멀 모드의 일정: 달력 뷰.
// 일정이 있는 날은 유형 색 X 표시. 빈 날을 눌러 추가, 드래그(모바일은 두 번 탭)로 기간.
const TYPE_COLOR = { 고사: '#A32D2D', 행사: '#BA7517', 휴업일: '#3F5C4C', 개인: '#185FA5' }
const TYPES = ['휴업일', '행사', '고사', '개인']

// computed·subject 를 주면 날짜 밑에 그 날의 최소 차시를 동그라미로 표시한다.
export default function ScheduleCalendar({ data, setData, setSnack, computed, subject, onToggleView }) {
  const { isMobile } = useWindowWidth()
  const today = toISO(new Date())
  const initMonth = () => {
    const base = today >= data.semStart && today <= data.semEnd ? today : data.semStart || today
    const d = fromISO(base)
    return { y: d.getFullYear(), m: d.getMonth() }
  }
  const [ym, setYm] = useState(initMonth)
  const [drag, setDrag] = useState(null) // {start, end} 드래그 중 구간
  const [pick, setPick] = useState(null) // {start, end, name, type} 팝오버
  const [tapStart, setTapStart] = useState(null) // 모바일 두 탭 방식의 첫 탭
  const dragging = useRef(false)

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
    setPick(null)
    setTapStart(null)
  }

  const openPick = (start, end) => {
    const a = start <= end ? start : end
    const b = start <= end ? end : start
    setPick({ start: a, end: b, name: '', type: '행사' })
  }

  // 데스크톱: 드래그로 기간 선택
  const onDown = iso => {
    if (isMobile) return
    dragging.current = true
    setDrag({ start: iso, end: iso })
  }
  const onEnter = iso => {
    if (!isMobile && dragging.current) setDrag(d => (d ? { ...d, end: iso } : d))
  }
  const onUp = () => {
    if (isMobile || !dragging.current) return
    dragging.current = false
    setDrag(d => {
      if (d) openPick(d.start, d.end)
      return null
    })
  }

  // 모바일: 첫 탭 = 시작일, 두 번째 탭 = 종료일 (같은 날 다시 탭 = 하루)
  const onTap = iso => {
    if (!isMobile) return
    if (!tapStart) {
      setTapStart(iso)
      setPick(null)
    } else {
      openPick(tapStart, iso)
      setTapStart(null)
    }
  }

  const add = () => {
    if (!pick.name.trim()) return
    const ev = { id: Date.now(), start: pick.start, end: pick.end, name: pick.name.trim(), type: pick.type }
    setData(d => ({ ...d, events: [...d.events, ev] }))
    setSnack({ text: '일정을 추가했습니다.', kind: 'event', id: ev.id })
    setPick(null)
  }

  const remove = id => {
    setData(d => ({ ...d, events: d.events.filter(e => e.id !== id) }))
    setPick(null)
  }

  const inRange = (iso, r) => r && iso >= (r.start <= r.end ? r.start : r.end) && iso <= (r.start <= r.end ? r.end : r.start)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', position: 'relative' }} onMouseUp={onUp} onMouseLeave={onUp}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, flex: 'none' }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{monthLabel}</span>
        <div style={{ flex: 1 }} />
        <button className="hov" onClick={() => moveMonth(-1)} style={calNav}>‹</button>
        <button className="hov" onClick={() => moveMonth(1)} style={calNav}>›</button>
        {onToggleView && (
          <button className="hov" onClick={onToggleView} title="목록으로 보기" style={{ border: 'none', background: 'none', padding: 5, borderRadius: 6, cursor: 'pointer', color: SUB, display: 'flex', flex: 'none' }}>
            <ListIcon />
          </button>
        )}
      </div>

      <div style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
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
                const selected = inRange(cell.iso, drag) || (tapStart === cell.iso) || (pick && inRange(cell.iso, pick))
                const types = [...new Set(evs.map(e => e.type))].slice(0, 2)
                const ses = cell.inMonth ? sessionOn(cell.iso) : null
                return (
                  <div
                    key={cell.iso}
                    onMouseDown={() => onDown(cell.iso)}
                    onMouseEnter={() => onEnter(cell.iso)}
                    onClick={() => onTap(cell.iso)}
                    style={{
                      position: 'relative', minHeight: isMobile ? 44 : 0, padding: '4px 0 2px',
                      borderLeft: '1px solid ' + LINE_SOFT, cursor: 'pointer', boxSizing: 'border-box',
                      background: selected ? 'rgba(15,92,77,0.10)' : '#FFFFFF',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      opacity: cell.inMonth ? 1 : 0.32,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12, lineHeight: 1.4, fontWeight: isToday ? 800 : 400,
                        color: isToday ? '#FFFFFF' : INK,
                        background: isToday ? GREEN : 'transparent',
                        borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {cell.day}
                    </span>
                    {(types.length > 0 || ses) && (
                      <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
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
                        {types.map(t => <XMark key={t} color={TYPE_COLOR[t] || SUB} />)}
                        {evs.length > 2 && <span style={{ fontSize: 9, color: FAINT }}>+</span>}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {isMobile && tapStart && (
        <div style={{ marginTop: 6, fontSize: 12, color: SUB, textAlign: 'center', flex: 'none' }}>
          {tapStart.slice(5).replace('-', '.')} 부터 — 종료일을 누르세요
        </div>
      )}

      {/* 추가·삭제 팝오버 (모바일은 하단 시트형) */}
      {pick && (
        <div
          onClick={e => e.stopPropagation()}
          style={
            isMobile
              ? { position: 'fixed', left: 10, right: 10, bottom: 12, background: '#FFFFFF', border: '1px solid ' + LINE, borderRadius: 10, boxShadow: '0 10px 30px rgba(26,26,26,0.2)', padding: 14, zIndex: 90 }
              : { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 8, width: 250, background: '#FFFFFF', border: '1px solid ' + LINE, borderRadius: 8, boxShadow: '0 10px 28px rgba(26,26,26,0.16)', padding: 12, zIndex: 60 }
          }
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {pick.start.slice(5).replace('-', '.')}{pick.end !== pick.start && ' ~ ' + pick.end.slice(5).replace('-', '.')}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setPick(null)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 15, lineHeight: 1, color: FAINT }}>×</button>
          </div>

          {/* 이 날짜에 걸친 기존 일정 — 삭제 */}
          {eventsOn(pick.start).map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <XMark color={TYPE_COLOR[e.type] || SUB} />
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
              <button onClick={() => remove(e.id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: FAINT }}>삭제</button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {TYPES.map(tp => (
              <button
                key={tp}
                onClick={() => setPick(p => ({ ...p, type: tp }))}
                title={tp}
                style={{
                  width: 22, height: 22, borderRadius: 5, cursor: 'pointer', boxSizing: 'border-box',
                  border: pick.type === tp ? '2px solid ' + INK : '1px solid rgba(26,26,26,0.15)',
                  background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <XMark color={TYPE_COLOR[tp]} />
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={pick.name}
              onChange={e => setPick(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              placeholder="일정 이름"
              autoFocus={!isMobile}
              style={{ flex: 1, minWidth: 0, border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', fontSize: 13, padding: '7px 9px', boxSizing: 'border-box' }}
            />
            <button
              onClick={add}
              style={{ border: 'none', borderRadius: 6, background: pick.name.trim() ? GREEN : '#E4E1DA', color: '#FFFFFF', padding: '0 14px', cursor: pick.name.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, flex: 'none' }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ListIcon() {
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

function XMark({ color }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

const calNav = {
  border: 'none', background: 'none', borderRadius: 6, cursor: 'pointer', color: SUB,
  padding: '2px 10px 4px', fontSize: 18, lineHeight: 1,
}
