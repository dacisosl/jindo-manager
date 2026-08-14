import React from 'react'
import { GREEN, FAINT, LINE, SUB } from '../logic.js'
import TimetableEditor from './TimetableEditor.jsx'

const nextBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 15, fontWeight: 500, color: GREEN }

export function Setup1({ data, patch, go }) {
  const ok = data.semStart && data.semEnd && data.semStart < data.semEnd
  return (
    <div style={{ maxWidth: 420, margin: '110px auto 0' }}>
      <div style={{ fontSize: 13, color: FAINT }}>1 / 2</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 44 }}>학기 기간</div>
      <div style={{ display: 'flex', gap: 26, marginTop: 30 }}>
        <label style={{ flex: 1, fontSize: 12, color: SUB }}>
          시작일
          <input
            type="date"
            value={data.semStart}
            onChange={e => patch({ semStart: e.target.value })}
            style={dateInput}
          />
        </label>
        <label style={{ flex: 1, fontSize: 12, color: SUB }}>
          종료일
          <input
            type="date"
            value={data.semEnd}
            onChange={e => patch({ semEnd: e.target.value })}
            style={dateInput}
          />
        </label>
      </div>
      <button onClick={() => ok && go('setup2')} style={{ ...nextBtn, marginTop: 44, opacity: ok ? 1 : 0.4, cursor: ok ? 'pointer' : 'default' }}>다음</button>
    </div>
  )
}

export function Setup2({ data, setData, onStart }) {
  const ok = Object.keys(data.pattern).length > 0
  return (
    <div style={{ maxWidth: 680, margin: '70px auto 0' }}>
      <div style={{ fontSize: 13, color: FAINT }}>2 / 2</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 40 }}>시간표</div>
      <div style={{ fontSize: 13, color: SUB, marginTop: 8 }}>반을 선택해 칸을 칠해주세요.</div>
      <div style={{ marginTop: 26 }}>
        <TimetableEditor data={data} setData={setData} cellHeight={42} compact />
      </div>
      <button onClick={() => ok && onStart()} style={{ ...nextBtn, marginTop: 36, opacity: ok ? 1 : 0.4, cursor: ok ? 'pointer' : 'default' }}>시작</button>
    </div>
  )
}

const dateInput = {
  display: 'block', width: '100%', boxSizing: 'border-box', border: 'none',
  borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 15, padding: '7px 0', marginTop: 6,
}
