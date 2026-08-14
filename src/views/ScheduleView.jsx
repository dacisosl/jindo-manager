import React, { useState } from 'react'
import { DAYS, GREEN, FAINT, INK, LINE, LINE_SOFT, SUB, fromISO } from '../logic.js'

export default function ScheduleView({ data, setData, computed, go, goImport, setSnack }) {
  const [open, setOpen] = useState(true)
  const [sched, setSched] = useState({ date: '', name: '', type: '행사', detail: false, period: '전체', cls: '전체' })
  const patchSched = p => setSched(s => ({ ...s, ...p }))

  const year = data.semStart ? fromISO(data.semStart).getFullYear() : new Date().getFullYear()

  const add = () => {
    const raw = sched.date.trim()
    const m = /^(\d{1,2})[./](\d{1,2})(?:\s*[-–~]\s*(\d{1,2})[./](\d{1,2}))?$/.exec(raw)
    if (!m || !sched.name.trim()) {
      setSnack({ text: '날짜와 이름을 확인해주세요.', kind: 'none' })
      return
    }
    const iso = (mm, dd) => year + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0')
    const start = iso(m[1], m[2])
    const end = m[3] ? iso(m[3], m[4]) : start
    const id = Date.now()
    const ev = { id, start, end: end >= start ? end : start, name: sched.name.trim(), type: sched.type }
    if (sched.period !== '전체') ev.period = Number(sched.period)
    if (sched.cls !== '전체') ev.cls = sched.cls

    let text = '일정을 추가했습니다.'
    if (sched.type !== '개인') {
      const dow = fromISO(start).getDay()
      const lost = {}
      if (dow >= 1 && dow <= 5) {
        for (let p = 1; p <= 7; p++) {
          const cls = data.pattern[dow + '-' + p]
          if (!cls) continue
          if (ev.period && ev.period !== p) continue
          if (ev.cls && ev.cls !== cls) continue
          const ex = computed.sessions[start + '|' + p]
          if (ex && ex.canceled) continue
          lost[cls] = (lost[cls] || 0) + 1
        }
      }
      const parts = Object.keys(lost).map(c => c + '반 ' + lost[c] + '시수')
      if (parts.length) text = parts.join(' · ') + ' 결손'
    }
    setData(d => ({ ...d, events: [...d.events, ev] }))
    setSched({ date: '', name: '', type: '행사', detail: false, period: '전체', cls: '전체' })
    setSnack({ text, kind: 'event', id })
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
    if (ev.start === ev.end) date = d1.getDate() + ' ' + DAYS[d1.getDay()]
    else {
      const d2 = fromISO(ev.end)
      date = d1.getDate() + '–' + (d2.getMonth() + 1) + '.' + d2.getDate()
    }
    g.rows.push({ id: ev.id, date, name: ev.name, type: ev.type === '휴업일' ? '휴업' : ev.type })
  })

  const linkBtn = c => ({ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: c })

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, paddingBottom: 20 }}>
        <button onClick={() => go('grid')} style={linkBtn(SUB)}>← 진도표</button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>일정</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setOpen(!open)} style={linkBtn(GREEN)}>추가</button>
        <button onClick={() => goImport('schedule')} style={linkBtn(GREEN)}>파일에서 가져오기</button>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid ' + LINE, borderBottom: '1px solid ' + LINE, padding: '18px 0', marginBottom: 6 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
            <input value={sched.date} onChange={e => patchSched({ date: e.target.value })} placeholder="8.20" style={{ ...uInput, width: 64 }} />
            <input value={sched.name} onChange={e => patchSched({ name: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()} placeholder="일정 이름" style={{ ...uInput, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', marginTop: 16 }}>
            {['휴업일', '행사', '고사', '개인'].map(tp => (
              <button
                key={tp}
                onClick={() => patchSched({ type: tp })}
                style={{
                  border: 'none', background: 'none', padding: '2px 0 4px', cursor: 'pointer', fontSize: 13,
                  color: sched.type === tp ? INK : FAINT,
                  borderBottom: '2px solid ' + (sched.type === tp ? GREEN : 'transparent'),
                }}
              >
                {tp}
              </button>
            ))}
            <button onClick={() => patchSched({ detail: !sched.detail })} style={linkBtn(FAINT)}>상세</button>
            <div style={{ flex: 1 }} />
            <button onClick={add} style={{ ...linkBtn(GREEN), fontSize: 14, fontWeight: 500 }}>추가</button>
          </div>
          {sched.detail && (
            <div style={{ marginTop: 14, display: 'flex', gap: 28, fontSize: 13, color: SUB, alignItems: 'baseline' }}>
              <label>
                교시&nbsp;
                <select value={sched.period} onChange={e => patchSched({ period: e.target.value })} style={uSelect}>
                  <option>전체</option>
                  {[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label>
                반&nbsp;
                <select value={sched.cls} onChange={e => patchSched({ cls: e.target.value })} style={uSelect}>
                  <option>전체</option>
                  {data.classes.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
      )}
      {groups.length === 0 && <div style={{ paddingTop: 20, fontSize: 13, color: SUB }}>등록된 일정이 없습니다.</div>}
      {groups.map(g => (
        <div key={g.label} style={{ paddingTop: 20 }}>
          <div style={{ fontSize: 13, color: FAINT }}>{g.label}</div>
          {g.rows.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto', gap: 16, padding: '13px 0', borderBottom: '1px solid ' + LINE_SOFT, fontSize: 14, alignItems: 'baseline' }}>
              <div style={{ color: SUB }}>{r.date}</div>
              <div style={{ fontWeight: 500 }}>{r.name}</div>
              <div style={{ color: FAINT, fontSize: 13 }}>{r.type}</div>
              <button onClick={() => remove(r.id)} style={{ ...linkBtn(FAINT), fontSize: 12 }}>삭제</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const uInput = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '4px 0' }
const uSelect = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '2px 0' }
