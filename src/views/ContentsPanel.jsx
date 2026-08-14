import React, { useState } from 'react'
import { GREEN, INK, FAINT, LINE, LINE_SOFT, SUB, subjectOf } from '../logic.js'

// 차시별 내용: 과목 탭 아래 차시 번호별 입력.
// 여기 적은 내용이 진도표의 같은 차시 칸에 그대로 표시된다 (저장소는 contents 하나).
export default function ContentsPanel({ data, setData, computed, today, active, setActive }) {
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

  const rows = []
  for (let n = 1; n <= rowCount; n++) {
    const isCur = n === curNum
    rows.push(
      <div key={n} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', borderBottom: '1px solid ' + LINE_SOFT }}>
        <div style={{ width: 30, textAlign: 'right', fontSize: 13, fontWeight: isCur ? 700 : 400, color: isCur ? GREEN : FAINT, flex: 'none' }}>{n}</div>
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

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap', borderBottom: '1px solid ' + LINE, paddingBottom: 8 }}>
        {data.subjects.map(s => (
          <button
            key={s}
            onClick={() => setActive(s)}
            style={{
              border: 'none', background: 'none', padding: '2px 0 6px', cursor: 'pointer', fontSize: 14,
              fontWeight: s === subj ? 700 : 400, color: s === subj ? INK : SUB,
              borderBottom: '2px solid ' + (s === subj ? GREEN : 'transparent'), marginBottom: -9,
            }}
          >
            {s}
          </button>
        ))}
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
            style={{ width: 64, border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '2px 0' }}
          />
        ) : (
          <button onClick={() => setAdding(true)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 14, color: FAINT }}>+</button>
        )}
        <div style={{ flex: 1 }} />
        {renaming ? (
          <input
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') renameSubject()
              if (e.key === 'Escape') setRenaming(false)
            }}
            autoFocus
            style={{ width: 72, border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 12, padding: '2px 0' }}
          />
        ) : (
          <button onClick={() => { setRenaming(true); setRenameVal(subj) }} style={miniBtn}>이름 변경</button>
        )}
        {data.subjects.length > 1 && <button onClick={deleteSubject} style={miniBtn}>삭제</button>}
      </div>
      {subjClasses.length === 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: FAINT }}>이 과목으로 지정된 반이 없습니다. 시간표 편집에서 반의 과목을 지정하세요.</div>
      )}
      <div style={{ marginTop: 4 }}>{rows}</div>
    </div>
  )
}

const miniBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: FAINT }
