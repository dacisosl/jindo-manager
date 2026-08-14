import React from 'react'
import { GREEN, SUB } from '../logic.js'
import TimetableEditor from './TimetableEditor.jsx'

export default function TimetableView({ data, setData, go, goImport }) {
  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, paddingBottom: 22 }}>
        <button onClick={() => go('grid')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: SUB }}>← 진도표</button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>시간표</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => go('schedule')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: SUB }}>일정</button>
        <button onClick={() => goImport('timetable')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN }}>파일에서 가져오기</button>
      </div>
      <TimetableEditor data={data} setData={setData} />
    </div>
  )
}
