import React, { useState } from 'react'
import { DAYS, GREEN, FAINT, INK, LINE, LINE_SOFT, RED, SUB, fromISO, toISO } from '../logic.js'

const TYPES = ['휴업일', '행사', '고사', '개인']
// 고사는 대개 여러 날 이어지므로 기간 입력을 기본으로 연다.
const defaultRange = type => type === '고사'

// 일정 등록 폼 + 목록. 최초 설정 화면과 일정 화면이 함께 쓴다.
export default function ScheduleEditor({ data, setData, computed, setSnack, maxHeight }) {
  const todayISO = toISO(new Date())
  const initDate = data.semStart && todayISO < data.semStart ? data.semStart : todayISO
  const [sched, setSched] = useState({
    start: initDate, end: '', name: '', type: '행사', range: false, detail: false, period: '전체', cls: '전체',
  })
  const patchSched = p => setSched(s => ({ ...s, ...p }))

  const pickType = tp => {
    const range = defaultRange(tp) ? true : sched.range
    patchSched({ type: tp, range, end: range && !sched.end ? sched.start : sched.end })
  }

  const toggleRange = () => {
    const range = !sched.range
    patchSched({ range, end: range ? sched.end || sched.start : '' })
  }

  const add = () => {
    const start = sched.start
    if (!start || !sched.name.trim()) {
      setSnack({ text: '날짜와 이름을 확인해주세요.', kind: 'none' })
      return
    }
    const end = sched.range && sched.end && sched.end >= start ? sched.end : start
    const id = Date.now()
    const ev = { id, start, end, name: sched.name.trim(), type: sched.type }
    if (sched.period !== '전체') ev.period = Number(sched.period)
    if (sched.cls !== '전체') ev.cls = sched.cls

    // 어느 반이 몇 시수 빠지는지 미리 계산해 알려준다 (개인 일정도 동일하게 결손 처리)
    const lost = {}
    let d = fromISO(start)
    const last = fromISO(end)
    while (d <= last) {
      const dow = d.getDay()
      const iso = toISO(d)
      if (dow >= 1 && dow <= 5) {
        for (let p = 1; p <= 7; p++) {
          const cls = data.pattern[dow + '-' + p]
          if (!cls) continue
          if (ev.period && ev.period !== p) continue
          if (ev.cls && ev.cls !== cls) continue
          const ex = computed.sessions[iso + '|' + p]
          if (ex && ex.canceled) continue
          lost[cls] = (lost[cls] || 0) + 1
        }
      }
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    }
    const parts = Object.keys(lost).map(c => c + '반 ' + lost[c] + '시수')
    const text = parts.length ? parts.join(' · ') + ' 결손' : '일정을 추가했습니다.'

    setData(dd => ({ ...dd, events: [...dd.events, ev] }))
    setSched(s => ({ ...s, name: '', end: s.range ? s.end : '' }))
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
        style={{ borderTop: '1px solid ' + LINE, borderBottom: '1px solid ' + LINE, padding: '14px 0 16px' }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
          {TYPES.map(tp => (
            <button
              key={tp}
              onClick={() => pickType(tp)}
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
          <div style={{ flex: 1 }} />
          <button
            onClick={toggleRange}
            style={{
              border: '1px solid ' + (sched.range ? GREEN : LINE), borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
              fontSize: 12, fontWeight: sched.range ? 700 : 400,
              background: sched.range ? GREEN : '#FFFFFF', color: sched.range ? '#FFFFFF' : SUB, lineHeight: 1.5,
            }}
          >
            기간
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <input type="date" value={sched.start} onChange={e => patchSched({ start: e.target.value })} style={{ ...uInput, colorScheme: 'light' }} />
          {sched.range && (
            <>
              <span style={{ fontSize: 13, color: FAINT }}>~</span>
              <input type="date" value={sched.end} min={sched.start} onChange={e => patchSched({ end: e.target.value })} style={{ ...uInput, colorScheme: 'light' }} />
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 12 }}>
          <input
            value={sched.name}
            onChange={e => patchSched({ name: e.target.value })}
            placeholder="일정 이름"
            style={{ ...uInput, flex: 1, minWidth: 0 }}
          />
          <button onClick={add} style={{ ...linkBtn(GREEN), fontSize: 14, fontWeight: 700 }}>추가</button>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginTop: 10 }}>
          <button onClick={() => patchSched({ detail: !sched.detail })} style={linkBtn(FAINT)}>
            {sched.detail ? '상세 닫기' : '일부 교시·반만'}
          </button>
        </div>
        {sched.detail && (
          <div style={{ marginTop: 10, display: 'flex', gap: 24, fontSize: 13, color: SUB, alignItems: 'baseline', flexWrap: 'wrap' }}>
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

      <div className="soft-scroll" style={{ maxHeight, overflowY: maxHeight ? 'auto' : 'visible', paddingRight: maxHeight ? 6 : 0 }}>
        {groups.length === 0 && <div style={{ paddingTop: 18, fontSize: 13, color: FAINT }}>등록된 일정이 없습니다.</div>}
        {groups.map(g => (
          <div key={g.label} style={{ paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: FAINT }}>{g.label}</div>
            {g.rows.map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto auto', gap: 10, padding: '11px 0', borderBottom: '1px solid ' + LINE_SOFT, fontSize: 14, alignItems: 'baseline' }}>
                <div style={{ color: SUB, fontSize: 13 }}>{r.date}</div>
                <div style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: r.type === '고사' ? RED : FAINT }}>{r.type === '휴업일' ? '휴업' : r.type}</div>
                <button onClick={() => remove(r.id)} style={{ ...linkBtn(FAINT), fontSize: 12 }}>삭제</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

const uInput = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '4px 0' }
const uSelect = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '2px 0' }
