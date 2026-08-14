import { useRef, useState } from 'react'

// 왼쪽(시간표)과 오른쪽 패널의 너비 비율. 진도표 화면과 설정 화면이 같은 비율을 공유한다.
export default function useSplit(data, setData) {
  const [dragPct, setDragPct] = useState(null)
  const wrapRef = useRef(null)
  const pct = Math.min(78, Math.max(38, dragPct ?? data.ui.splitPct))

  const startDrag = e => {
    e.preventDefault()
    const rect = wrapRef.current.getBoundingClientRect()
    const pctOf = x => Math.min(78, Math.max(38, ((x - rect.left) / rect.width) * 100))
    const move = ev => setDragPct(pctOf(ev.clientX))
    const up = ev => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      setDragPct(null)
      setData(d => ({ ...d, ui: { ...d.ui, splitPct: Math.round(pctOf(ev.clientX)) } }))
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return { wrapRef, splitPct: pct, dragging: dragPct != null, startDrag }
}
