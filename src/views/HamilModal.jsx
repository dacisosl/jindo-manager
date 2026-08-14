import React, { useRef, useState } from 'react'
import { GREEN, FAINT, LINE, SUB, WARN } from '../logic.js'
import { coerceData } from '../storage.js'
import Modal from './Modal.jsx'

// 해밀고 교사 프리셋: 이름으로 검색해 미리 준비된 시간표·일정 데이터를 통째로 적용한다.
// 데이터 파일: public/teachers.json — {"teachers":[{"name":"홍길동","data":{...}}]}
// 개인정보라 공개 저장소에는 올리지 않으므로, 파일이 없으면 배포받은 파일을 직접 열 수 있게 한다.
export default function HamilModal({ data, setData, setSnack, onClose }) {
  const [name, setName] = useState('')
  const [state, setState] = useState('idle') // idle | loading | found | error
  const [error, setError] = useState('')
  const [found, setFound] = useState(null)
  const [list, setList] = useState(null) // 파일에서 직접 읽어온 교사 목록
  const fileRef = useRef()

  const pick = (teachers, q) => {
    if (!teachers.length) throw new Error('파일에 등록된 교사가 없습니다.')
    const t = teachers.find(x => x.name === q) || teachers.find(x => x.name && x.name.includes(q))
    if (!t) throw new Error('"' + q + '" 이름을 찾지 못했습니다.')
    const normalized = coerceData(t.data)
    normalized.setupDone = true
    return { name: t.name, normalized }
  }

  const search = async () => {
    const q = name.trim()
    if (!q) return
    setState('loading')
    setError('')
    setFound(null)
    try {
      let teachers = list
      if (!teachers) {
        const res = await fetch(import.meta.env.BASE_URL + 'teachers.json', { cache: 'no-store' })
        if (!res.ok) throw new Error('NOFILE')
        const json = await res.json()
        teachers = Array.isArray(json.teachers) ? json.teachers : []
        setList(teachers)
      }
      setFound(pick(teachers, q))
      setState('found')
    } catch (e) {
      setError(e.message === 'NOFILE' ? '이 기기에 교사 데이터 파일이 없습니다. 학교에서 받은 파일을 열어주세요.' : e.message || '불러오지 못했습니다.')
      setState('error')
    }
  }

  const openFile = async file => {
    if (!file) return
    setError('')
    try {
      const json = JSON.parse(await file.text())
      const teachers = Array.isArray(json.teachers) ? json.teachers : []
      if (!teachers.length) throw new Error('교사 목록이 없는 파일입니다.')
      setList(teachers)
      const q = name.trim()
      if (q) {
        setFound(pick(teachers, q))
        setState('found')
      } else {
        setState('idle')
        setError('교사 ' + teachers.length + '명을 읽었습니다. 이름을 입력하고 검색하세요.')
      }
    } catch (e) {
      setError(e.message || '파일을 읽지 못했습니다.')
      setState('error')
    }
    fileRef.current.value = ''
  }

  const apply = () => {
    const prev = data
    setData(found.normalized)
    setSnack({ text: found.name + ' 선생님 시간표를 적용했습니다.', kind: 'all', prev })
    onClose()
  }

  const d = found ? found.normalized : null
  const hours = d ? Object.keys(d.pattern).length : 0

  return (
    <Modal title="해밀고 시간표 불러오기" onClose={onClose} width={440}>
      <div style={{ marginTop: 6, fontSize: 13, color: SUB }}>
        이름을 검색하면 2026-2학기 시간표와 학사일정으로 바로 시작합니다.
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginTop: 18 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search() }}
          placeholder="교사 이름"
          autoFocus
          style={{ flex: 1, border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '5px 0' }}
        />
        <button onClick={search} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: GREEN }}>
          검색
        </button>
      </div>

      {state === 'loading' && <div style={{ marginTop: 16, fontSize: 13, color: SUB }}>찾는 중…</div>}
      {error && <div style={{ marginTop: 16, fontSize: 13, color: state === 'error' ? WARN : SUB }}>{error}</div>}

      {state === 'found' && d && (
        <div style={{ marginTop: 18, borderTop: '1px solid ' + LINE, paddingTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{found.name}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: SUB }}>
            {d.classes.length}개 반 · 주 {hours}시간 · 일정 {d.events.length}건
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: FAINT, lineHeight: 1.6 }}>
            {d.classes.join(', ')}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: FAINT }}>적용하면 현재 데이터를 대체합니다. 적용 후 되돌리기가 가능합니다.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={apply} style={{ border: 'none', borderRadius: 6, padding: '8px 20px', background: GREEN, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              적용
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, borderTop: '1px solid ' + LINE, paddingTop: 12 }}>
        <button onClick={() => fileRef.current.click()} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN }}>
          받은 파일에서 불러오기 (teachers.json)
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => openFile(e.target.files[0])} />
      </div>
    </Modal>
  )
}
