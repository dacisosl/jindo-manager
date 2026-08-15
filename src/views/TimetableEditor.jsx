import React, { useEffect, useRef, useState } from 'react'
import { GREEN, INK, LINE, LINE_SOFT, FAINT, SUB, TINTS, colorOf, subjectOf } from '../logic.js'
import useWindowWidth from '../useWindowWidth.js'

// 시간표 입력 두 가지 방식:
// 1) 블록 선택: 칸들을 눌러 고르고 [반 등록]으로 한 번에 배정 (기본, 모바일 주력)
// 2) 칠하기: 팔레트에서 반을 고른 뒤 드래그/탭으로 칠하기
export default function TimetableEditor({ data, setData, cellHeight = 46, compact = false, fill = false }) {
  const { isMobile } = useWindowWidth()
  const [selTool, setSelTool] = useState('select')
  const [selected, setSelected] = useState({}) // {'dow-p': true}
  const [regOpen, setRegOpen] = useState(false)
  const [newClass, setNewClass] = useState('')
  const [newSubject, setNewSubject] = useState(data.subjects[0] || '수학')
  const [chipPop, setChipPop] = useState(null) // 팝오버 열린 반 이름
  const paintRef = useRef(false)

  useEffect(() => {
    const up = () => { paintRef.current = false }
    const close = () => setChipPop(null)
    document.addEventListener('mouseup', up)
    document.addEventListener('click', close)
    return () => {
      document.removeEventListener('mouseup', up)
      document.removeEventListener('click', close)
    }
  }, [])

  const selCount = Object.keys(selected).length

  const paint = k => {
    setData(d => {
      const pat = { ...d.pattern }
      if (selTool === 'erase') delete pat[k]
      else pat[k] = selTool
      return { ...d, pattern: pat }
    })
  }

  const tapCell = k => {
    if (selTool === 'select') {
      setSelected(s => {
        const n = { ...s }
        if (n[k]) delete n[k]
        else n[k] = true
        return n
      })
    } else {
      paint(k)
    }
  }

  // 선택된 칸들을 반으로 등록. 새 반이면 색·과목도 함께 부여.
  const register = () => {
    const name = newClass.trim()
    if (!name || !selCount) return
    setData(d => {
      const pat = { ...d.pattern }
      Object.keys(selected).forEach(k => { pat[k] = name })
      const isNew = d.classes.indexOf(name) < 0
      const classes = isNew ? [...d.classes, name] : d.classes
      const colors = { ...d.colors }
      if (isNew && !colors[name]) {
        const used = d.classes.map(c => colorOf(d, c))
        colors[name] = TINTS.find(t => !used.includes(t)) || TINTS[(classes.length - 1) % TINTS.length]
      }
      const subj = newSubject.trim() || d.subjects[0] || '수학'
      const subjects = d.subjects.includes(subj) ? d.subjects : [...d.subjects, subj]
      return { ...d, pattern: pat, classes, colors, subjects, clsSubject: { ...d.clsSubject, [name]: subj } }
    })
    setSelected({})
    setRegOpen(false)
    setNewClass('')
  }

  const setColor = (cls, color) => setData(d => ({ ...d, colors: { ...d.colors, [cls]: color } }))
  const setSubject = (cls, subj) => setData(d => ({
    ...d,
    subjects: d.subjects.includes(subj) ? d.subjects : [...d.subjects, subj],
    clsSubject: { ...d.clsSubject, [cls]: subj },
  }))

  const eDays = ['월', '화', '수', '목', '금']
  const rows = []
  for (let p = 1; p <= 7; p++) {
    const cells = []
    for (let dow = 1; dow <= 5; dow++) {
      const k = dow + '-' + p
      const name = data.pattern[k] || ''
      const isSel = !!selected[k]
      cells.push(
        <div
          key={k}
          onClick={() => tapCell(k)}
          onMouseDown={e => {
            if (selTool === 'select') return
            e.preventDefault()
            paintRef.current = true
            paint(k)
          }}
          onMouseEnter={() => { if (paintRef.current) paint(k) }}
          style={{
            minHeight: cellHeight, padding: isMobile ? '5px 4px' : compact ? '6px 9px' : '8px 12px',
            boxSizing: 'border-box', overflow: 'hidden', minWidth: 0,
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: isMobile ? 'center' : 'flex-start',
            background: name ? colorOf(data, name) : isSel ? 'rgba(15,92,77,0.07)' : '#FFFFFF',
            boxShadow: isSel ? 'inset 0 0 0 2px ' + GREEN : 'none',
          }}
        >
          <div style={{ fontSize: isMobile ? 11 : 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        </div>
      )
    }
    rows.push(
      <div key={p} style={{ display: 'contents' }}>
        <div
          style={{
            borderTop: '1px solid ' + LINE_SOFT, fontSize: isMobile ? 10 : 12, color: FAINT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {p}
        </div>
        {cells}
      </div>
    )
  }

  const weekly = data.classes.map(c => c + ' ' + Object.values(data.pattern).filter(v => v === c).length).join(' · ')

  const toolChip = (active, label, onClick) => (
    <button
      onClick={onClick}
      style={{
        border: 'none', background: 'none', padding: '2px 0 4px', cursor: 'pointer', fontSize: isMobile ? 13 : 14,
        fontWeight: active ? 700 : 400,
        color: active ? INK : SUB,
        borderBottom: '2px solid ' + (active ? GREEN : 'transparent'),
        whiteSpace: 'nowrap', flex: 'none',
      }}
    >
      {label}
    </button>
  )

  const registerForm = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: isMobile ? 1 : 'none' }}>
      <input
        value={newClass}
        onChange={e => setNewClass(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') register()
          if (e.key === 'Escape') { setRegOpen(false); setNewClass('') }
        }}
        placeholder="반 예: 2-1"
        autoFocus
        style={{ ...fieldStyle, width: isMobile ? 0 : 108, flex: isMobile ? 1 : 'none', minWidth: 0 }}
      />
      <input
        value={newSubject}
        onChange={e => setNewSubject(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') register() }}
        placeholder="과목"
        list="subject-list"
        style={{ ...fieldStyle, width: isMobile ? 0 : 84, flex: isMobile ? 1 : 'none', minWidth: 0 }}
      />
      <datalist id="subject-list">
        {data.subjects.map(s => <option key={s} value={s} />)}
      </datalist>
      <button
        onClick={register}
        style={{ border: 'none', borderRadius: 6, background: GREEN, color: '#FFFFFF', padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, flex: 'none' }}
      >
        등록
      </button>
    </div>
  )

  return (
    <>
      <div
        data-intro-palette
        className={isMobile ? 'chip-scroll' : ''}
        style={{ display: 'flex', gap: isMobile ? 14 : 18, alignItems: 'center', paddingBottom: 10, flexWrap: isMobile ? 'nowrap' : 'wrap', flex: 'none' }}
      >
        {toolChip(selTool === 'select', '선택', () => setSelTool('select'))}
        {data.classes.map(c => (
          <div key={c} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
            <span
              onClick={e => { e.stopPropagation(); setChipPop(chipPop === c ? null : c) }}
              title="색·과목 편집"
              style={{
                display: 'inline-block', width: 11, height: 11, borderRadius: 2, background: colorOf(data, c),
                border: '1px solid rgba(26,26,26,0.18)', marginRight: 6, cursor: 'pointer',
              }}
            />
            {toolChip(selTool === c, c, () => setSelTool(c))}
            {chipPop === c && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', left: 0, top: 30, width: 196, background: '#FFFFFF',
                  border: '1px solid ' + LINE, borderRadius: 6, boxShadow: '0 8px 24px rgba(26,26,26,0.12)',
                  padding: 12, zIndex: 50, cursor: 'default',
                }}
              >
                <div style={{ fontSize: 12, color: FAINT }}>색</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginTop: 7 }}>
                  {TINTS.map(t => (
                    <span
                      key={t}
                      onClick={() => setColor(c, t)}
                      style={{
                        width: 22, height: 22, borderRadius: 3, background: t, cursor: 'pointer',
                        border: colorOf(data, c) === t ? '2px solid ' + GREEN : '1px solid rgba(26,26,26,0.14)',
                        boxSizing: 'border-box',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: FAINT, marginTop: 12 }}>과목</div>
                <select
                  value={subjectOf(data, c)}
                  onChange={e => setSubject(c, e.target.value)}
                  style={{ ...fieldStyle, width: '100%', marginTop: 4 }}
                >
                  {data.subjects.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
        {toolChip(selTool === 'erase', '지우기', () => setSelTool('erase'))}
        {!isMobile && (
          <>
            <div style={{ flex: 1 }} />
            <div data-intro-register style={{ display: 'inline-flex', alignItems: 'center' }}>
              {regOpen ? registerForm : (
                <button
                  onClick={() => { if (selCount) setRegOpen(true) }}
                  style={{
                    border: '1px solid ' + (selCount ? GREEN : LINE), borderRadius: 6, padding: '6px 14px',
                    background: selCount ? GREEN : '#FFFFFF', color: selCount ? '#FFFFFF' : FAINT,
                    cursor: selCount ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                  }}
                >
                  반 등록{selCount ? ' (' + selCount + '칸)' : ''}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 모바일: 선택하면 바로 아래에 큰 등록 버튼이 나타난다 */}
      {isMobile && (
        <div data-intro-register style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, flex: 'none' }}>
          {regOpen ? registerForm : selCount ? (
            <button
              onClick={() => setRegOpen(true)}
              style={{ flex: 1, border: 'none', borderRadius: 6, background: GREEN, color: '#FFFFFF', padding: '10px 0', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
            >
              선택한 {selCount}칸을 반으로 등록
            </button>
          ) : (
            <div style={{ fontSize: 12, color: FAINT }}>
              {selTool === 'select' ? '수업이 있는 칸을 눌러 고르세요.' : selTool === 'erase' ? '지울 칸을 누르세요.' : '칠할 칸을 누르세요.'}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: fill ? 1 : 'none', minHeight: 0 }}>
        <div
          data-intro-grid
          style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', userSelect: 'none', height: fill ? '100%' : undefined, overflow: 'hidden' }}
        >
          <div
            style={{
              display: 'grid', gridTemplateColumns: (isMobile ? '22px' : '38px') + ' repeat(5,minmax(0,1fr))',
              gridTemplateRows: fill ? 'auto repeat(7, minmax(0,1fr))' : undefined, height: fill ? '100%' : undefined,
            }}
          >
            <div style={{ background: '#F4F2ED' }} />
            {eDays.map(d => (
              <div
                key={d}
                style={{
                  padding: isMobile ? '6px 0 5px' : '9px 12px 8px', borderLeft: '1px solid ' + LINE_SOFT,
                  fontSize: isMobile ? 11 : 13, color: SUB, fontWeight: 700, background: '#F4F2ED',
                  textAlign: isMobile ? 'center' : 'left',
                }}
              >
                {d}
              </div>
            ))}
            {rows}
          </div>
        </div>
      </div>

      {!weekly && (
        <div style={{ marginTop: 8, fontSize: 12, color: SUB, flex: 'none' }}>
          칸을 골라 반으로 등록하거나, 반을 고른 뒤 칠해주세요.
        </div>
      )}
    </>
  )
}

const fieldStyle = {
  border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF',
  fontSize: 14, padding: '7px 9px', boxSizing: 'border-box',
}
