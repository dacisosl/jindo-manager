import React from 'react'
import { DAYS, GREEN, LINE, SUB, WARN, addDays, fromISO, md, tintOf, toISO } from '../logic.js'

export default function DashView({ data, computed, today, go, setWeekOffset }) {
  const { sessions, perClass, exam } = computed
  const cfg = data.cfg
  const todayD = fromISO(today)
  const dashDate = todayD.getMonth() + 1 + '.' + todayD.getDate() + ' ' + DAYS[todayD.getDay()]

  const todayRows = []
  for (let p = 1; p <= 7; p++) {
    const s = sessions[today + '|' + p]
    if (s && !s.canceled) todayRows.push({ p: p + '교시', cls: s.cls, tint: tintOf(data.classes, s.cls), num: s.num + '차시', memo: data.memos[today + '|' + p] || '' })
  }

  const curOf = c => {
    const l = (perClass[c] || []).filter(x => x.iso <= today)
    return l.length ? l[l.length - 1].num : 0
  }
  const maxCur = Math.max(...data.classes.map(curOf), 0)
  const mon0 = addDays(todayD, 1 - (todayD.getDay() || 7))

  const goBehind = c => {
    const ent = Object.entries(sessions).find(kv => kv[1].cls === c && kv[1].canceled)
    if (!ent) return
    const iso = ent[0].split('|')[0]
    const dm = fromISO(iso)
    const m = addDays(dm, 1 - (dm.getDay() || 7))
    setWeekOffset(Math.round((m - mon0) / (7 * 86400000)))
    go('grid')
  }

  const prog = data.classes.map(c => {
    const cur = curOf(c)
    const behind = maxCur - cur
    return { name: c, tint: tintOf(data.classes, c), cur, behind }
  })

  let ddaysLabel = '', examLine = ''
  if (exam) {
    ddaysLabel = Math.round((fromISO(exam.start) - todayD) / 86400000) + '일'
    examLine = data.classes.map(c => c + ' ' + (perClass[c] || []).filter(x => x.iso > today && x.iso < exam.start).length + '차시').join(' · ')
  }

  const mon0iso = toISO(mon0)
  const fri0iso = toISO(addDays(mon0, 4))
  const weekSumLine = data.classes.map(c => c + ' ' + (perClass[c] || []).filter(x => x.iso >= mon0iso && x.iso <= fri0iso).length + '차시').join(' · ')
  const allCanceled = Object.values(sessions).filter(v => v.canceled)
  const lossLine = '결손 ' + allCanceled.length + '건 · 일정 ' + allCanceled.filter(v => !v.user).length + ' · 직접 처리 ' + allCanceled.filter(v => v.user).length
  const forecastLine = cfg.target + '차시 도달 예상 · ' + data.classes.map(c => {
    const slot = (perClass[c] || []).find(x => x.num === cfg.target)
    return c + ' ' + (slot ? md(slot.iso) : '미정')
  }).join(' · ')

  const secTitle = { fontSize: 13, fontWeight: 500, color: SUB }
  const widgetSec = (title, line) => (
    <div style={{ borderTop: '1px solid ' + LINE, marginTop: 26, paddingTop: 18 }}>
      <div style={secTitle}>{title}</div>
      <div style={{ marginTop: 10, fontSize: 13, color: SUB }}>{line}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', paddingTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={secTitle}>오늘</div>
        <div style={{ fontSize: 13, color: SUB }}>{dashDate}</div>
      </div>
      <div style={{ padding: '16px 0 30px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {todayRows.length === 0 && <div style={{ fontSize: 13, color: SUB }}>오늘은 수업이 없습니다.</div>}
        {todayRows.map(r => (
          <div key={r.p} style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <div style={{ width: 44, fontSize: 13, color: SUB }}>{r.p}</div>
            <div style={{ width: 52, fontSize: 14, fontWeight: 500 }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: r.tint, border: '1px solid rgba(26,26,26,0.10)', marginRight: 7 }} />
              {r.cls}
            </div>
            <div style={{ width: 56, fontSize: 15, fontWeight: 700 }}>{r.num}</div>
            <div style={{ fontSize: 13, color: SUB }}>{r.memo}</div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid ' + LINE, paddingTop: 18 }}>
        <div style={secTitle}>진도</div>
        <div style={{ padding: '18px 0 30px', display: 'flex', flexDirection: 'column', gap: 17 }}>
          {prog.map(g => (
            <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 52, fontSize: 14, fontWeight: 500 }}>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: g.tint, border: '1px solid rgba(26,26,26,0.10)', marginRight: 7 }} />
                {g.name}
              </div>
              <div style={{ flex: 1, position: 'relative', height: 14 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 6.5, height: 1, background: LINE }} />
                <div style={{ position: 'absolute', top: 3.5, left: Math.min(100, (g.cur / cfg.target) * 100) + '%', width: 7, height: 7, borderRadius: '50%', background: GREEN, transform: 'translateX(-50%)' }} />
              </div>
              <div style={{ width: 52, textAlign: 'right', fontSize: 14 }}>{g.cur + ' / ' + cfg.target}</div>
              <div style={{ width: 64, textAlign: 'right' }}>
                {g.behind > 0 && (
                  <button onClick={() => goBehind(g.name)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: WARN }}>
                    뒤처짐 {g.behind}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: '1px solid ' + LINE, paddingTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{exam ? exam.name + '까지' : '기준 고사 없음'}</div>
          {exam && <div style={{ fontSize: 20, fontWeight: 700 }}>{ddaysLabel}</div>}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: SUB }}>
          {exam ? examLine : '일정에서 고사 일정을 추가하면 남은 차시가 표시됩니다.'}
        </div>
      </div>
      {cfg.widgets.week && widgetSec('이번 주', weekSumLine)}
      {cfg.widgets.loss && widgetSec('결손 통계', lossLine)}
      {cfg.widgets.forecast && widgetSec('완주 예측', forecastLine)}
    </div>
  )
}
