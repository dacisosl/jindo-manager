import React, { useEffect, useRef, useState } from 'react'
import { GREEN, INK, FAINT, LINE, LINE_SOFT, SUB, SECTION_TITLE, subjectOf } from '../logic.js'

// 차시별 내용: 과목 탭 아래 차시 번호별 입력.
// 여기 적은 내용이 진도표의 같은 차시 칸에 그대로 표시된다 (저장소는 contents 하나).
export default function ContentsPanel({ data, setData, computed, today, active, setActive, height, focusNum, weekNums, onCollapse }) {
  const scrollRef = useRef(null)
  const [adding, setAdding] = useState(false)
  const [newSubj, setNewSubj] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')

  const subj = data.subjects.includes(active) ? active : data.subjects[0]
  const subjClasses = data.classes.filter(c => subjectOf(data, c) === subj)

  // 이 과목 반들의 최대 차시 + 여유 5행. 진도가 없어도 최소 15행은 보여 미리 적을 수 있게.
  let maxNum = 0
  let curNum = 0
  subjClasses.forEach(c => {
    const list = computed.perClass[c] || []
    list.forEach(x => {
      if (x.num > maxNum) maxNum = x.num
      if (x.iso <= today && x.num > curNum) curNum = x.num
    })
  })
  const rowCount = Math.max(maxNum, 10) + 5

  const setContent = (num, v) => {
    setData(d => {
      const contents = { ...d.contents, [subj]: { ...(d.contents[subj] || {}) } }
      if (v) contents[subj][num] = v
      else delete contents[subj][num]
      return { ...d, contents }
    })
  }

  const addSubject = () => {
    const v = newSubj.trim()
    if (v && !data.subjects.includes(v)) {
      setData(d => ({ ...d, subjects: [...d.subjects, v] }))
      setActive(v)
    }
    setAdding(false)
    setNewSubj('')
  }

  const renameSubject = () => {
    const v = renameVal.trim()
    if (v && v !== subj && !data.subjects.includes(v)) {
      setData(d => {
        const contents = { ...d.contents }
        if (contents[subj]) {
          contents[v] = contents[subj]
          delete contents[subj]
        }
        const clsSubject = { ...d.clsSubject }
        Object.keys(clsSubject).forEach(c => { if (clsSubject[c] === subj) clsSubject[c] = v })
        return { ...d, subjects: d.subjects.map(s => (s === subj ? v : s)), contents, clsSubject }
      })
      setActive(v)
    }
    setRenaming(false)
  }

  const deleteSubject = () => {
    if (data.subjects.length <= 1) return
    setData(d => {
      const subjects = d.subjects.filter(s => s !== subj)
      const contents = { ...d.contents }
      delete contents[subj]
      const clsSubject = { ...d.clsSubject }
      Object.keys(clsSubject).forEach(c => { if (clsSubject[c] === subj) clsSubject[c] = subjects[0] })
      return { ...d, subjects, contents, clsSubject }
    })
    setActive(data.subjects.filter(s => s !== subj)[0])
  }

  // 보고 있는 주의 차시를 패널 가운데로 옮긴다 — 주를 넘길 때마다 따라온다.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !focusNum || el.scrollHeight <= el.clientHeight) return
    const row = el.querySelector('[data-row="' + focusNum + '"]')
    if (!row) return
    // 즉시 이동 — 부드러운 스크롤은 렌더링이 멈춘 탭에서 반영되지 않는다
    el.scrollTop = Math.max(0, row.offsetTop - (el.clientHeight - row.offsetHeight) / 2)
  }, [focusNum, subj, height])

  const week = new Set(weekNums || [])
  const rows = []
  for (let n = 1; n <= rowCount; n++) {
    const isCur = n === curNum
    const inWeek = week.has(n)
    rows.push(
      <div
        key={n}
        data-row={n}
        style={{
          display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 6px', borderBottom: '1px solid ' + LINE_SOFT,
          background: inWeek ? 'rgba(15,92,77,0.05)' : 'transparent',
          borderRadius: inWeek ? 4 : 0,
        }}
      >
        <div style={{ width: 26, textAlign: 'right', fontSize: 13, fontWeight: isCur || inWeek ? 700 : 400, color: isCur ? GREEN : inWeek ? INK : FAINT, flex: 'none' }}>{n}</div>
        <input
          value={(data.contents[subj] || {})[n] || ''}
          onChange={e => setContent(n, e.target.value)}
          placeholder=""
          style={{
            flex: 1, border: 'none', background: 'transparent', fontSize: 13, padding: '2px 0', minWidth: 0,
            color: INK,
          }}
        />
      </div>
    )
  }

  const tabBtn = s => {
    const on = s === subj
    if (renaming === s) {
      return (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          <input
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') renameSubject()
              if (e.key === 'Escape') setRenaming(null)
            }}
            autoFocus
            style={{ width: 78, border: '1px solid ' + LINE, borderRadius: 5, background: '#FFFFFF', fontSize: 13, padding: '3px 6px' }}
          />
          <button onClick={renameSubject} style={{ ...miniBtn, color: GREEN, fontWeight: 700 }}>저장</button>
          {data.subjects.length > 1 && <button onClick={deleteSubject} style={miniBtn}>삭제</button>}
        </span>
      )
    }
    return (
      <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flex: 'none' }}>
        <button
          onClick={() => { setActive(s); setRenaming(s); setRenameVal(s) }}
          title="과목 이름 수정"
          style={{ border: 'none', background: 'none', padding: 2, cursor: 'pointer', color: on ? SUB : FAINT, display: 'flex', alignItems: 'center' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
        <button
          onClick={() => setActive(s)}
          style={{
            border: 'none', background: 'none', padding: '2px 2px 4px', cursor: 'pointer', fontSize: 14,
            fontWeight: on ? 700 : 500, color: on ? INK : SUB,
            borderBottom: '2px solid ' + (on ? GREEN : 'transparent'),
          }}
        >
          {s}
        </button>
      </span>
    )
  }

  return (
    <div style={{ height: height || undefined, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, flex: 'none' }}>
        <span style={SECTION_TITLE}>차시별 내용</span>
        <div style={{ flex: 1 }} />
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="접기"
            className="hov"
            style={{
              display: 'flex', alignItems: 'center', gap: 3, border: 'none', borderRadius: 5, background: 'none',
              padding: '3px 6px', cursor: 'pointer', color: SUB, fontSize: 12, fontWeight: 600,
            }}
          >
            접기
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 5 16 12 9 19" />
            </svg>
          </button>
        )}
      </div>
      <div
        className="chip-scroll"
        style={{
          display: 'flex', gap: 12, alignItems: 'center', background: '#F4F2ED',
          border: '1px solid ' + LINE, borderRadius: '6px 6px 0 0', borderBottom: 'none',
          padding: '5px 10px', flex: 'none',
        }}
      >
        {data.subjects.map(tabBtn)}
        {adding ? (
          <input
            value={newSubj}
            onChange={e => setNewSubj(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addSubject()
              if (e.key === 'Escape') { setAdding(false); setNewSubj('') }
            }}
            placeholder="과목명"
            autoFocus
            style={{ width: 74, border: '1px solid ' + LINE, borderRadius: 5, background: '#FFFFFF', fontSize: 13, padding: '3px 6px', flex: 'none' }}
          />
        ) : (
          <button onClick={() => setAdding(true)} title="과목 추가" style={{ border: 'none', background: 'none', padding: '0 2px', cursor: 'pointer', fontSize: 16, color: FAINT, flex: 'none', lineHeight: 1 }}>+</button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="soft-scroll"
        style={{
          flex: 1, minHeight: 0, overflowY: height ? 'auto' : 'visible',
          border: '1px solid ' + LINE, borderRadius: '0 0 6px 6px', background: '#FFFFFF', padding: '2px 8px 4px',
        }}
      >
        {rows}
      </div>
    </div>
  )
}

const miniBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: FAINT }
