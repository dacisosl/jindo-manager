import React from 'react'
import { GREEN, SUB } from '../logic.js'
import ScheduleEditor from './ScheduleEditor.jsx'

export default function ScheduleView({ data, setData, computed, go, goImport, setSnack }) {
  const linkBtn = c => ({ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: c })
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, paddingBottom: 18 }}>
        <button onClick={() => go('grid')} style={linkBtn(SUB)}>← 진도표</button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>일정</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => goImport('schedule')} style={linkBtn(GREEN)}>파일에서 가져오기</button>
      </div>
      <ScheduleEditor data={data} setData={setData} computed={computed} setSnack={setSnack} />
    </div>
  )
}
