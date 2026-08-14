import React, { useEffect, useRef, useState } from 'react'
import { GREEN, INK, LINE, LINE_SOFT, FAINT, SUB, tintOf } from '../logic.js'

// 반 팔레트 + 드래그로 칠하는 시간표 그리드. 시간표 편집과 온보딩 2단계에서 공용.
export default function TimetableEditor({ data, setData, cellHeight = 48, compact = false }) {
  const [selTool, setSelTool] = useState(data.classes[0] || 'erase')
  const [adding, setAdding] = useState(false)
  const [newClass, setNewClass] = useState('')
  const paintRef = useRef(false)

  useEffect(() => {
    const up = () => { paintRef.current = false }
    document.addEventListener('mouseup', up)
    return () => document.removeEventListener('mouseup', up)
  }, [])

  const paint = k => {
    setData(d => {
      const pat = { ...d.pattern }
      if (selTool === 'erase') delete pat[k]
      else pat[k] = selTool
      return { ...d, pattern: pat }
    })
  }

  const addClass = () => {
    const v = newClass.trim()
    if (v && data.classes.indexOf(v) < 0) {
      setData(d => ({ ...d, classes: [...d.classes, v] }))
      setSelTool(v)
    }
    setAdding(false)
    setNewClass('')
  }

  const eDays = ['월', '화', '수', '목', '금']
  const rows = []
  for (let p = 1; p <= 7; p++) {
    const cells = []
    for (let dow = 1; dow <= 5; dow++) {
      const k = dow + '-' + p
      const name = data.pattern[k] || ''
      cells.push(
        <div
          key={k}
          onMouseDown={e => { e.preventDefault(); paintRef.current = true; paint(k) }}
          onMouseEnter={() => { if (paintRef.current) paint(k) }}
          style={{
            minHeight: cellHeight, padding: compact ? '7px 13px' : '8px 13px',
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: 'pointer', background: name ? tintOf(data.classes, name) : '#FFFFFF',
          }}
        >
          <div style={{ fontSize: compact ? 13 : 14, fontWeight: 500 }}>{name}</div>
        </div>
      )
    }
    rows.push(
      <div key={p} style={{ display: 'contents' }}>
        <div style={{ borderTop: '1px solid ' + LINE_SOFT, padding: '9px 0 0 15px', fontSize: 12, color: FAINT }}>{p}</div>
        {cells}
      </div>
    )
  }

  const weekly = data.classes.map(c => c + ' ' + Object.values(data.pattern).filter(v => v === c).length).join(' · ')

  return (
    <>
      <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', paddingBottom: 14 }}>
        {data.classes.map(c => (
          <button
            key={c}
            onClick={() => setSelTool(c)}
            style={{
              border: 'none', background: 'none', padding: '2px 0 4px', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              color: selTool === c ? INK : SUB, borderBottom: '2px solid ' + (selTool === c ? GREEN : 'transparent'),
            }}
          >
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: tintOf(data.classes, c), border: '1px solid rgba(26,26,26,0.10)', marginRight: 6 }} />
            {c}
          </button>
        ))}
        {!adding ? (
          <button onClick={() => setAdding(true)} style={{ border: 'none', background: 'none', padding: '2px 0 4px', cursor: 'pointer', fontSize: 14, color: SUB }}>+ 반</button>
        ) : (
          <input
            value={newClass}
            onChange={e => setNewClass(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addClass()
              if (e.key === 'Escape') { setAdding(false); setNewClass('') }
            }}
            placeholder="예: 2-4"
            autoFocus
            style={{ width: 64, border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '2px 0 4px' }}
          />
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setSelTool('erase')}
          style={{
            border: 'none', background: 'none', padding: '2px 0 4px', cursor: 'pointer', fontSize: 14,
            color: selTool === 'erase' ? INK : SUB, borderBottom: '2px solid ' + (selTool === 'erase' ? GREEN : 'transparent'),
          }}
        >
          지우기
        </button>
      </div>
      <div style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', userSelect: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(5,1fr)' }}>
          <div />
          {eDays.map(d => (
            <div key={d} style={{ padding: '10px 12px 8px', borderLeft: '1px solid ' + LINE_SOFT, fontSize: 13, color: SUB, fontWeight: 500 }}>{d}</div>
          ))}
          {rows}
        </div>
      </div>
      {!compact && <div style={{ marginTop: 13, fontSize: 13, color: SUB }}>{weekly ? '주당  ' + weekly : '반을 추가하고 칸을 칠해주세요.'}</div>}
    </>
  )
}
