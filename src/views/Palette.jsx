import React from 'react'
import { GREEN, TINTS } from '../logic.js'

// 30색 팔레트 — 반 색과 과목 색이 같은 판을 쓴다.
export default function Palette({ value, onPick, size = 20 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5 }}>
      {TINTS.map(t => (
        <span
          key={t}
          onClick={() => onPick(t)}
          title={t}
          style={{
            height: size, borderRadius: 4, background: t, cursor: 'pointer', boxSizing: 'border-box',
            border: value === t ? '2px solid ' + GREEN : '1px solid rgba(26,26,26,0.14)',
          }}
        />
      ))}
    </div>
  )
}
