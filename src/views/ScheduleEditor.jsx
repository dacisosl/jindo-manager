import React, { useState } from 'react'
import { DAYS, GREEN, FAINT, INK, LINE, LINE_SOFT, RED, SUB, fromISO, toISO } from '../logic.js'
import { CalendarIcon } from './ScheduleCalendar.jsx'

const TYPES = ['휴업일', '행사', '고사', '개인']

// 일정 등록 폼 + 목록. 최초 설정 화면과 일정 화면이 함께 쓴다.
// 기간은 시작일~종료일 두 칸(같으면 하루), "+ 기간"으로 띄엄띄엄 여러 구간을 한 번에 넣는다.
export default function ScheduleEditor({ data, setData, computed, setSnack, maxHeight, onImport, onToggleView, fill = false }) {
  const todayISO = toISO(new Date())
  const initDate = data.semStart && todayISO < data.semStart ? data.semStart : todayISO
  const [ranges, setRanges] = useState([{ start: initDate, end: initDate }])
  const [sched, setSched] = useState({ name: '', type: '행사' })
  const patchSched = p => setSched(s => ({ ...s, ...p }))

  const setRange = (i, patch) => setRanges(rs => rs.map((r, j) => {
    if (j !== i) return r
    const n = { ...r, ...patch }
    if (n.end < n.start) n.end = n.start
    return n
  }))
  const addRange = () => setRanges(rs => [...rs, { start: rs[rs.length - 1].end, end: rs[rs.length - 1].end }])
  const removeRange = i => setRanges(rs => rs.filter((_, j) => j !== i))

  const add = () => {
    if (!sched.name.trim() || !ranges.length || ranges.some(r => !r.start)) {
      setSnack({ text: '날짜와 이름을 확인해주세요.', kind: 'none' })
      return
    }
    const base = Date.now()
    const evs = ranges.map((r, i) => ({
      id: base + i,
      start: r.start,
      end: r.end && r.end >= r.start ? r.end : r.start,
      name: sched.name.trim(),
      type: sched.type,
    }))

    // 어느 반이 몇 시수 빠지는지 미리 계산해 알려준다 (개인 일정도 동일하게 결손 처리)
    const lost = {}
    for (const ev of evs) {
      let d = fromISO(ev.start)
      const last = fromISO(ev.end)
      while (d <= last) {
        const dow = d.getDay()
        const iso = toISO(d)
        if (dow >= 1 && dow <= 5) {
          for (let p = 1; p <= 7; p++) {
            const cls = data.pattern[dow + '-' + p]
            if (!cls) continue
            const ex = computed.sessions[iso + '|' + p]
            if (ex && ex.canceled) continue
            lost[cls] = (lost[cls] || 0) + 1
          }
        }
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      }
    }
    const parts = Object.keys(lost).map(c => c + '반 ' + lost[c] + '시수')
    const text = parts.length ? parts.join(' · ') + ' 결손' : '일정을 추가했습니다.'

    setData(dd => ({ ...dd, events: [...dd.events, ...evs] }))
    setSched(s => ({ ...s, name: '' }))
    setRanges(rs => [rs[0]].map(r => ({ ...r })))
    setSnack({ text, kind: 'events', prev: data.events })
  }

  const remove = id => setData(d => ({ ...d, events: d.events.filter(e => e.id !== id) }))

  const sorted = data.events.slice().sort((a, b) => (a.start < b.start ? -1 : 1))
  const groups = []
  sorted.forEach(ev => {
    const d1 = fromISO(ev.start)
    const label = d1.getMonth() + 1 + '월'
    let g = groups.find(x => x.label === label)
    if (!g) {
      g = { label, rows: [] }
      groups.push(g)
    }
    let date
    if (ev.start === ev.end) date = d1.getDate() + '일 ' + DAYS[d1.getDay()]
    else {
      const d2 = fromISO(ev.end)
      date = d1.getDate() + '–' + (d2.getMonth() + 1) + '.' + d2.getDate()
    }
    g.rows.push({ id: ev.id, date, name: ev.name, type: ev.type })
  })

  const linkBtn = c => ({ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: c })

  return (
    <>
      <div
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        style={{ borderTop: '1px solid ' + LINE, borderBottom: '1px solid ' + LINE, padding: '12px 0 14px', flex: 'none' }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
          {TYPES.map(tp => (
            <button
              key={tp}
              onClick={() => patchSched({ type: tp })}
              style={{
                border: 'none', background: 'none', padding: '2px 0 4px', cursor: 'pointer', fontSize: 13,
                fontWeight: sched.type === tp ? 700 : 400,
                color: sched.type === tp ? INK : FAINT,
                borderBottom: '2px solid ' + (sched.type === tp ? GREEN : 'transparent'),
              }}
            >
              {tp}
            </button>
          ))}
        </div>

        {/* 기간 여러 줄 — 6.10~6.12, 7.1~7.3 처럼 띄엄띄엄 골라 한 번에 넣는다 */}
        {ranges.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: i === 0 ? 12 : 8, flexWrap: 'wrap' }}>
            <input type="date" value={r.start} onChange={e => setRange(i, { start: e.target.value })} style={{ ...uInput, colorScheme: 'light' }} />
            <span style={{ fontSize: 13, color: FAINT }}>~</span>
            <input type="date" value={r.end} min={r.start} onChange={e => setRange(i, { end: e.target.value })} style={{ ...uInput, colorScheme: 'light' }} />
            {ranges.length > 1 && (
              <button onClick={() => removeRange(i)} title="이 기간 빼기" style={{ ...linkBtn(FAINT), fontSize: 15, lineHeight: 1 }}>×</button>
            )}
            {i === ranges.length - 1 && (
              <button onClick={addRange} style={{ ...linkBtn(GREEN), fontSize: 12, fontWeight: 700 }}>+ 기간</button>
            )}
            {i === 0 && (onImport || onToggleView) && (
              <>
                <div style={{ flex: 1 }} />
                {onToggleView && (
                  <button onClick={onToggleView} title="달력으로 보기" className="hov" style={iconBtnS}>
                    <CalendarIcon />
                  </button>
                )}
                {onImport && (
                  <button onClick={onImport} title="학사일정 파일에서 가져오기" className="hov" style={iconBtnS}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 8 12 3 17 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 12 }}>
          <input
            value={sched.name}
            onChange={e => patchSched({ name: e.target.value })}
            placeholder="일정 이름"
            style={{ ...uInput, flex: 1, minWidth: 0 }}
          />
          <button onClick={add} style={{ ...linkBtn(GREEN), fontSize: 14, fontWeight: 700 }}>추가</button>
        </div>
      </div>

      <div
        className="soft-scroll"
        style={{
          maxHeight, flex: fill ? 1 : undefined, minHeight: 0,
          overflowY: maxHeight || fill ? 'auto' : 'visible', paddingRight: maxHeight || fill ? 6 : 0,
        }}
      >
        {groups.length === 0 && <div style={{ paddingTop: 18, fontSize: 13, color: FAINT }}>등록된 일정이 없습니다.</div>}
        {groups.map(g => (
          <div key={g.label} style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 13, borderRadius: 2, background: GREEN, flex: 'none' }} />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>{g.label}</span>
            </div>
            {g.rows.map(r => {
              const tp = r.type === '휴업일' ? '휴업' : r.type
              const badge = TYPE_BADGE[tp] || TYPE_BADGE.기본
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto auto', gap: 10, padding: '11px 0', borderBottom: '1px solid ' + LINE_SOFT, fontSize: 14, alignItems: 'center' }}>
                  <div style={{ color: SUB, fontSize: 13 }}>{r.date}</div>
                  <div style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 7px', borderRadius: 4, lineHeight: 1, background: badge.bg, color: badge.fg, flex: 'none' }}>{tp}</span>
                  <button onClick={() => remove(r.id)} style={{ ...linkBtn(FAINT), fontSize: 12 }}>삭제</button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

const uInput = { border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', fontSize: 13, padding: '6px 8px', boxSizing: 'border-box' }
const iconBtnS = { border: 'none', background: 'none', padding: 4, borderRadius: 6, cursor: 'pointer', color: SUB, display: 'flex', flex: 'none' }

// 유형 배지 — 한눈에 성격이 구분되도록 유형별 색을 준다
const TYPE_BADGE = {
  고사: { bg: '#F6E0DC', fg: '#A32D2D' },
  행사: { bg: '#F4E8CE', fg: '#854F0B' },
  휴업: { bg: '#E2E8E2', fg: '#3F5C4C' },
  개인: { bg: '#DFE6F2', fg: '#185FA5' },
  기본: { bg: '#E4E1DA', fg: '#575757' },
}
