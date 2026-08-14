import React, { useEffect, useState } from 'react'
import { DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, addDays, fromISO, toISO, tintOf } from '../logic.js'

export default function GridView({ data, setData, computed, today, setSnack, go, goImport, weekOffset, setWeekOffset, stagger }) {
  const { sessions, perClass, exam } = computed
  const cfg = data.cfg
  const [pop, setPop] = useState(null) // {key, mode:'menu'|'memo', draft}
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const close = () => {
      setPop(null)
      setMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const t = fromISO(today)
  const mon0 = addDays(t, 1 - (t.getDay() || 7))
  const mon = addDays(mon0, weekOffset * 7)
  const days = []
  for (let i = 0; i < 5; i++) {
    const d = addDays(mon, i)
    const iso = toISO(d)
    const isToday = iso === today
    days.push({ iso, label: DAYS[d.getDay()] + ' ' + d.getDate(), isToday })
  }
  const fri = addDays(mon, 4)
  const weekLabel = mon.getMonth() + 1 + '.' + mon.getDate() + ' – ' + (fri.getMonth() + 1) + '.' + fri.getDate()

  const semD = data.semStart ? fromISO(data.semStart) : t
  const semLabel = semD.getFullYear() + '-' + (semD.getMonth() + 1 >= 3 && semD.getMonth() + 1 <= 8 ? '1' : '2') + '학기'

  const setMemo = (key, v) => {
    setData(d => {
      const m = { ...d.memos }
      if (v) m[key] = v
      else delete m[key]
      return { ...d, memos: m }
    })
  }

  const doCancel = key => {
    const s = sessions[key]
    if (!s) return
    if (s.canceled && s.user) {
      setData(d => {
        const c = { ...d.cancels }
        delete c[key]
        return { ...d, cancels: c }
      })
      setPop(null)
      setSnack({ text: '결손을 해제했습니다.', kind: 'none' })
    } else if (!s.canceled) {
      const examStart = exam ? exam.start : null
      const cnt = (perClass[s.cls] || []).filter(x => x.num > s.num && (!examStart || x.iso < examStart)).length
      setData(d => ({ ...d, cancels: { ...d.cancels, [key]: { reason: '' } } }))
      setPop(null)
      setSnack({ text: s.num + '차시 이후 ' + cnt + '개 차시가 이동했습니다.', kind: 'cancel', key, canReason: true })
    }
  }

  let idx = 0
  const mkNum = num => {
    const i = idx++
    return (
      <span
        key={num + (stagger ? '-s' : '')}
        style={{
          display: 'inline-block', fontSize: 20, fontWeight: 700, lineHeight: 1.15,
          animation: cfg.anim ? 'numSlide 200ms ease both' : 'none',
          animationDelay: stagger ? i * 40 + 'ms' : '0ms',
        }}
      >
        {num}
      </span>
    )
  }

  const rows = []
  for (let p = 1; p <= 7; p++) {
    const cells = days.map(day => {
      const key = day.iso + '|' + p
      const s = sessions[key]
      const memo = data.memos[key] || ''
      const clickable = !!(s && (!s.canceled || s.user))
      const popOpen = !!(pop && pop.key === key)
      return (
        <div
          key={key}
          onClick={clickable ? e => { e.stopPropagation(); setPop({ key, mode: 'menu', draft: memo }); setMenuOpen(false) } : undefined}
          style={{
            position: 'relative', minHeight: 66, padding: '10px 13px',
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: clickable ? 'pointer' : 'default',
            boxShadow: day.isToday ? 'inset 1px 0 0 rgba(15,92,77,0.35), inset -1px 0 0 rgba(15,92,77,0.35)' : 'none',
            background: s && !s.canceled ? tintOf(data.classes, s.cls) : '#FFFFFF',
          }}
        >
          {s && !s.canceled && (
            <>
              <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{s.cls}</div>
              <div style={{ marginTop: 1 }}>{mkNum(s.num)}</div>
              <input
                value={memo}
                onChange={e => setMemo(key, e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="내용"
                style={{ width: '100%', boxSizing: 'border-box', border: 'none', background: 'transparent', fontSize: 12, color: SUB, padding: 0, marginTop: 3 }}
              />
            </>
          )}
          {s && s.canceled && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent 0,transparent 5px,rgba(26,26,26,0.05) 5px,rgba(26,26,26,0.05) 6px)' }} />
              <div style={{ position: 'relative', fontSize: 14, fontWeight: 500, color: FAINT, lineHeight: 1.3 }}>{s.cls}</div>
              <div style={{ position: 'relative', fontSize: 12, color: SUB, marginTop: 4 }}>{s.reason}</div>
            </>
          )}
          {popOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', left: 8, top: 'calc(100% - 8px)', width: 210, background: '#FFFFFF',
                border: '1px solid #E7E5E0', borderRadius: 6, boxShadow: '0 8px 24px rgba(26,26,26,0.10)',
                zIndex: 50, textAlign: 'left', cursor: 'default',
              }}
            >
              <div style={{ padding: '9px 14px', fontSize: 13, color: SUB, borderBottom: '1px solid ' + LINE_SOFT }}>
                {popTitle(pop.key, sessions)}
              </div>
              {pop.mode === 'menu' && (
                <>
                  <div className="hov2" onClick={() => doCancel(key)} style={{ padding: '9px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    {s && s.canceled ? '결손 해제' : '결손 처리'}
                  </div>
                  <div className="hov2" onClick={() => setPop({ ...pop, mode: 'memo' })} style={{ padding: '9px 14px 11px', fontSize: 14, cursor: 'pointer' }}>
                    메모 편집
                  </div>
                </>
              )}
              {pop.mode === 'memo' && (
                <div style={{ padding: '11px 14px 12px' }}>
                  <input
                    value={pop.draft}
                    onChange={e => setPop({ ...pop, draft: e.target.value })}
                    placeholder="메모"
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '4px 0' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      onClick={() => { setMemo(key, pop.draft); setPop(null) }}
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: GREEN }}
                    >
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )
    })
    rows.push(
      <div key={p} style={{ display: 'contents' }}>
        <div style={{ borderTop: '1px solid ' + LINE_SOFT, padding: '10px 0 0 15px', fontSize: 12, color: FAINT }}>{p}</div>
        {cells}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, paddingBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{semLabel}</div>
        <button onClick={() => go('timetable')} data-print="hide" style={linkBtn}>편집</button>
        <button onClick={() => go('schedule')} data-print="hide" style={linkBtn}>일정</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: SUB }}>{weekLabel}</div>
        <div data-print="hide" style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <button className="hov" onClick={() => { setWeekOffset(weekOffset - 1); setPop(null) }} style={navBtn(15)}>‹</button>
          <button className="hov" onClick={() => { setWeekOffset(0); setPop(null) }} style={navBtn(13)}>오늘</button>
          <button className="hov" onClick={() => { setWeekOffset(weekOffset + 1); setPop(null) }} style={navBtn(15)}>›</button>
          <div style={{ position: 'relative' }}>
            <button
              className="hov"
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); setPop(null) }}
              style={{ ...navBtn(15), letterSpacing: '0.05em' }}
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', right: 0, top: 32, width: 172, background: '#FFFFFF', border: '1px solid #E7E5E0', borderRadius: 6, boxShadow: '0 8px 24px rgba(26,26,26,0.10)', padding: '6px 0', zIndex: 50 }}
              >
                <div className="hov2" onClick={() => { setMenuOpen(false); setTimeout(() => window.print(), 100) }} style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>인쇄</div>
                <div className="hov2" onClick={() => { setMenuOpen(false); goImport('timetable') }} style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>파일에서 가져오기</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(5,1fr)' }}>
          <div />
          {days.map(day => (
            <div key={day.iso} style={{ padding: '11px 12px 9px', borderLeft: '1px solid ' + LINE_SOFT, fontSize: 13, color: day.isToday ? GREEN : SUB }}>
              <span style={{ borderBottom: '2px solid ' + (day.isToday ? GREEN : 'transparent'), paddingBottom: 3, fontWeight: 500 }}>{day.label}</span>
            </div>
          ))}
          {rows}
        </div>
      </div>
      {exam && toISO(fri) < exam.start && (
        <div style={{ marginTop: 28, borderTop: '1px solid ' + LINE, paddingTop: 2 }}>
          <div style={{ borderTop: '1px solid ' + LINE, paddingTop: 9, fontSize: 12, color: FAINT }}>
            {exam.name} 이전 · 구간 목표 {cfg.target}차시
          </div>
        </div>
      )}
    </div>
  )
}

function popTitle(key, sessions) {
  const [iso, ps] = key.split('|')
  const s = sessions[key]
  if (!s) return ''
  const dd = fromISO(iso)
  return s.cls + ' · ' + DAYS[dd.getDay()] + ' ' + ps + '교시' + (s.num ? ' · ' + s.num + '차시' : '')
}

const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN }
const navBtn = fs => ({ border: 'none', background: 'none', padding: fs === 15 ? '3px 9px' : '4px 9px', borderRadius: 6, cursor: 'pointer', fontSize: fs, lineHeight: 1 })
