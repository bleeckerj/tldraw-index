import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Tldraw, DefaultToolbar, DefaultToolbarContent, ToolbarItem } from 'tldraw'
import { createShapeId } from '@tldraw/editor'
import 'tldraw/tldraw.css'
import CardShapeUtil from './CardShapeUtil.jsx'
import rawCardsData from './data/cards.json'
import { TimedLineShapeUtil, TimedLineTool, setTimedLineConfig } from './TimedLineTool.js'
import { TimedDrawShapeUtil, TimedDrawTool } from './TimedDrawTool.js'
import { TimedHighlightShapeUtil, TimedHighlightTool } from './TimedHighlightTool.js'
import { CustomSelectionOutline, CustomSelectionCornerHandle } from './CustomSelection.jsx'

const cardsData = [...rawCardsData].sort((a, b) => {
  const da = new Date(a.date || 0)
  const db = new Date(b.date || 0)
  return db - da
})

function calculateInitialLayout() {
  const pos = {}
  const GAP = 20
  const CARD_WIDTH = 360
  const COLUMNS = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(cardsData.length))))
  const colHeights = new Array(COLUMNS).fill(0)
  const startX = 60
  const startY = 60

  cardsData.forEach((c) => {
    let minCol = 0
    for (let col = 1; col < COLUMNS; col++) {
      if (colHeights[col] < colHeights[minCol]) {
        minCol = col
      }
    }
    const x = startX + minCol * (CARD_WIDTH + GAP)
    const y = startY + colHeights[minCol]
    const height = 420 // Default height

    pos[c.id] = { x, y }
    colHeights[minCol] += height + GAP
  })
  return pos
}

function randomPos(i) {
  return {
    x: 60 + (i % 5) * 360 + Math.random() * 60,
    y: 60 + Math.floor(i / 5) * 260 + Math.random() * 60
  }
}

export default function App() {
  const editorRef = useRef(null)
  const [appReady, setAppReady] = useState(false)
  const [collections, setCollections] = useState([])
  const [tags, setTags] = useState([])
  const [years, setYears] = useState([])
  const [activeCollections, setActiveCollections] = useState(new Set())
  const [activeTags, setActiveTags] = useState(new Set())
  const [activeYears, setActiveYears] = useState(new Set())
  const [positions, setPositions] = useState({})
  const [selectedCard, setSelectedCard] = useState(null)
  const [viewingUrl, setViewingUrl] = useState(null)
  const [timedSeconds, setTimedSeconds] = useState(5)
  const [timedFadeSeconds, setTimedFadeSeconds] = useState(2)
  const [showTimedControls, setShowTimedControls] = useState(false)
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showInterface, setShowInterface] = useState(false)
  const [showControlPanel, setShowControlPanel] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('panel:visible')
    return saved ? saved === 'true' : false
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const placed = useRef(false)
  const positionsCache = useRef(calculateInitialLayout())

  useEffect(() => {
    const cols = Array.from(new Set(cardsData.map(c => c.collection)))
    
    // Calculate tag counts and filter/sort
    const tagCounts = {}
    cardsData.flatMap(c => c.tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1
    })
    const ts = Object.keys(tagCounts)
      .filter(t => tagCounts[t] > 5)
    const ys = Array.from(new Set(cardsData.map(c => new Date(c.date || 0).getFullYear())))
      .sort((a, b) => b - a)

    setCollections(cols)
    setTags(ts)
    setYears(ys)
    const savedCols = (() => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.localStorage.getItem('panel:collections')
        return raw ? new Set(JSON.parse(raw).filter(x => cols.includes(x))) : null
      } catch {
        return null
      }
    })()
    const savedTags = (() => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.localStorage.getItem('panel:tags')
        return raw ? new Set(JSON.parse(raw).filter(x => ts.includes(x))) : null
      } catch {
        return null
      }
    })()
    const savedYears = (() => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.localStorage.getItem('panel:years')
        return raw ? new Set(JSON.parse(raw).filter(x => ys.includes(x))) : null
      } catch {
        return null
      }
    })()
    setActiveCollections(savedCols ?? new Set(cols))
    setActiveTags(savedTags ?? new Set())
    setActiveYears(savedYears ?? new Set())
    if (typeof window !== 'undefined') {
      const savedLife = parseFloat(window.localStorage.getItem('panel:lifespan') || '')
      const savedFade = parseFloat(window.localStorage.getItem('panel:fade') || '')
      if (!Number.isNaN(savedLife)) setTimedSeconds(Math.min(10, Math.max(5, savedLife)))
      if (!Number.isNaN(savedFade)) setTimedFadeSeconds(Math.min(5, Math.max(0.5, savedFade)))
      const savedVisible = window.localStorage.getItem('panel:visible')
      if (savedVisible !== null) setShowControlPanel(savedVisible === 'true')
    }
    
    // Sync state with cache
    setPositions(positionsCache.current)
  }, [])

  const visibleIds = useMemo(
    () =>
      new Set(
        cardsData
          .filter(
            c =>
              activeCollections.has(c.collection) &&
              (activeTags.size === 0 || c.tags.some(t => activeTags.has(t))) &&
              (activeYears.size === 0 || activeYears.has(new Date(c.date || 0).getFullYear()))
          )
          .map(c => c.id)
      ),
    [activeCollections, activeTags, activeYears]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [activeCollections, activeTags, activeYears])

  // visibility + prop sync (add/remove shapes instead of opacity)
  useEffect(() => {
    if (!appReady || !editorRef.current) return
    const editor = editorRef.current
    
    // 1. Sync current positions to cache
    const currentShapes = editor.getCurrentPageShapes().filter(s => s.type === 'card')
    const currentShapeMap = new Map(currentShapes.map(s => [s.props.cardId, s]))

    // 2. Calculate new layout for PAGED visible IDs
    const allVisibleList = [...visibleIds].sort((a, b) => {
      const idxA = cardsData.findIndex(c => c.id === a)
      const idxB = cardsData.findIndex(c => c.id === b)
      return idxA - idxB
    })

    const start = (currentPage - 1) * pageSize
    const pagedVisibleList = allVisibleList.slice(start, start + pageSize)
    const pagedVisibleSet = new Set(pagedVisibleList)

    const GAP = 20
    const CARD_WIDTH = 360
    const COLUMNS = Math.max(3, Math.min(18, Math.ceil(Math.sqrt(pagedVisibleList.length))))
    const colHeights = new Array(COLUMNS).fill(0)
    const startX = 60
    const startY = 60
    const newPositions = {}

    pagedVisibleList.forEach(id => {
      let minCol = 0
      for (let col = 1; col < COLUMNS; col++) {
        if (colHeights[col] < colHeights[minCol]) {
          minCol = col
        }
      }
      const x = startX + minCol * (CARD_WIDTH + GAP)
      const y = startY + colHeights[minCol]
      
      // Use existing height if available, else default
      const existingShape = currentShapeMap.get(id)
      let height = 420
      if (existingShape) {
        const geo = editor.getShapeGeometry(existingShape)
        height = geo ? geo.bounds.h : existingShape.props.h
      }

      newPositions[id] = { x, y }
      positionsCache.current[id] = { x, y }
      
      colHeights[minCol] += height + GAP
    })
    setPositions(p => ({ ...p, ...newPositions }))

    // 3. Determine what to add/remove/update
    const currentCardIds = new Set(currentShapes.map(s => s.props.cardId))
    const toDelete = currentShapes.filter(s => !pagedVisibleSet.has(s.props.cardId)).map(s => s.id)
    const toAdd = pagedVisibleList.filter(id => !currentCardIds.has(id))
    const toUpdate = currentShapes.filter(s => pagedVisibleSet.has(s.props.cardId))

    editor.run(() => {
      // Delete hidden shapes
      if (toDelete.length > 0) {
        editor.deleteShapes(toDelete)
      }

      // Create new shapes
      if (toAdd.length > 0) {
        const shapes = toAdd.map(id => {
          const card = cardsData.find(c => c.id === id)
          const pos = newPositions[id] || { x: 0, y: 0 }
          return {
            id: createShapeId(id),
            type: 'card',
            x: pos.x,
            y: pos.y,
            props: {
              w: 360,
              h: 420,
              title: card.title,
              image: card.image,
              summary: card.summary,
              url: card.url || '',
              collection: card.collection,
              cardId: card.id,
              tags: card.tags || [],
              date: card.date || '',
              opacity: 1,
              showDetails: true
            },
            meta: { cardId: id }
          }
        })
        editor.createShapes(shapes)
      }

      // Update existing shapes (sync props + move to new grid position)
      if (toUpdate.length > 0) {
        const updates = toUpdate.map(shape => {
          const card = cardsData.find(c => c.id === shape.props.cardId)
          if (!card) return null
          const pos = newPositions[shape.props.cardId]
          return {
            id: shape.id,
            type: 'card',
            x: pos ? pos.x : shape.x,
            y: pos ? pos.y : shape.y,
            props: {
              ...shape.props,
              title: card.title,
              image: card.image,
              summary: card.summary,
              url: card.url || '',
              collection: card.collection,
              tags: card.tags || [],
              date: card.date || '',
              opacity: 1
            }
          }
        }).filter(Boolean)
        editor.updateShapes(updates)
      }
      
      editor.zoomToFit({ animation: { duration: 400 } })
    })
  }, [appReady, visibleIds, currentPage, pageSize])

  function toggleCollection(c, checked) {
    const next = new Set(activeCollections)
    if (checked) next.add(c)
    else next.delete(c)
    setActiveCollections(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('panel:collections', JSON.stringify(Array.from(next)))
    }
  }

  function toggleDetails(cardId) {
    if (!editorRef.current) return
    const shape = editorRef.current
      .getCurrentPageShapes()
      .find(s => s.type === 'card' && s.props.cardId === cardId)
    if (shape) {
      const next = !(shape.props.showDetails ?? true)
      editorRef.current.updateShapes([{
        id: shape.id,
        type: shape.type,
        props: { ...shape.props, showDetails: next }
      }])
    }
  }

  function toggleTag(t, checked) {
    const next = new Set(activeTags)
    if (checked) next.add(t)
    else next.delete(t)
    setActiveTags(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('panel:tags', JSON.stringify(Array.from(next)))
    }
  }

  function toggleYear(y, checked) {
    const next = new Set(activeYears)
    if (checked) next.add(y)
    else next.delete(y)
    setActiveYears(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('panel:years', JSON.stringify(Array.from(next)))
    }
  }

  function shuffle() {
    if (!appReady) return
    const editor = editorRef.current
    if (!editor) return
    const pos = {}
    const updates = []
    let i = 0
    editor
      .getCurrentPageShapes()
      .filter(s => s.type === 'card' && visibleIds.has(s.props.cardId))
      .forEach(shape => {
        const next = randomPos(i++)
        pos[shape.props.cardId] = next
        positionsCache.current[shape.props.cardId] = next
        updates.push({
          id: shape.id,
          type: 'card',
          x: next.x,
          y: next.y,
          props: { ...shape.props }
        })
      })
    setPositions(p => ({ ...p, ...pos }))
    if (updates.length) editor.updateShapes(updates)
    editor.zoomToFit({ animation: { duration: 400 } })
  }

  function layoutGrid() {
    if (!appReady || !editorRef.current) return
    const editor = editorRef.current
    
    const shapes = editor
      .getCurrentPageShapes()
      .filter(s => s.type === 'card' && visibleIds.has(s.props.cardId))
      .sort((a, b) => {
        const idxA = cardsData.findIndex(c => c.id === a.props.cardId)
        const idxB = cardsData.findIndex(c => c.id === b.props.cardId)
        return idxA - idxB
      })
    
    if (shapes.length === 0) return

    const GAP = 20
    const CARD_WIDTH = 360
    const COLUMNS = Math.max(3, Math.min(12, Math.ceil(Math.sqrt(shapes.length))))
    
    const colHeights = new Array(COLUMNS).fill(0)
    const startX = 60
    const startY = 60
    
    const updates = []
    const pos = {}
    
    shapes.forEach(shape => {
      let minCol = 0
      for (let i = 1; i < COLUMNS; i++) {
        if (colHeights[i] < colHeights[minCol]) {
          minCol = i
        }
      }
      
      const x = startX + minCol * (CARD_WIDTH + GAP)
      const y = startY + colHeights[minCol]
      
      const geo = editor.getShapeGeometry(shape)
      const height = geo ? geo.bounds.h : shape.props.h

      updates.push({
        id: shape.id,
        type: 'card',
        x,
        y,
        props: { ...shape.props }
      })
      
      pos[shape.props.cardId] = { x, y }
      positionsCache.current[shape.props.cardId] = { x, y }
      
      colHeights[minCol] += height + GAP
    })
    
    setPositions(p => ({ ...p, ...pos }))
    if (updates.length) editor.updateShapes(updates)
    editor.zoomToFit({ animation: { duration: 400 } })
  }

  function resetFilters() {
    const cols = Array.from(new Set(cardsData.map(c => c.collection)))
    setActiveCollections(new Set(cols))
    setActiveTags(new Set())
    setActiveYears(new Set())
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('panel:collections')
      window.localStorage.removeItem('panel:tags')
      window.localStorage.removeItem('panel:years')
    }
  }

  // Handle selection changes and "move to front"
  useEffect(() => {
    if (!appReady || !editorRef.current) return
    const editor = editorRef.current

    const unsubscribe = editor.store.listen((event) => {
      const changes = event.changes.updated
      if (!changes) return

      // Look for changes to the instance_page_state (which holds selection)
      const instanceChange = Object.values(changes).find(
        record => record[1].typeName === 'instance_page_state'
      )

      if (instanceChange) {
        const [prev, next] = instanceChange
        if (prev.selectedShapeIds !== next.selectedShapeIds) {
          const selectedIds = next.selectedShapeIds


          // Find the newly selected shape
          const addedId = selectedIds.find(id => !prev.selectedShapeIds.includes(id))
          
          if (addedId) {
            const shape = editor.getShape(addedId)
            if (shape && shape.type === 'card') {
              const cardId = shape.props.cardId
              const card = cardsData.find(c => c.id === cardId)
              setSelectedCard(card || null)
              setViewingUrl(null)
            }
          }
        }
      }
    })

    return unsubscribe
  }, [appReady])

  // pinch zoom on trackpad
  function onWheel(e) {
    if (!editorRef.current || !e.ctrlKey) return
    // best effort prevent the browser zoom; React's wheel may be passive, so this may be ignored
    e.preventDefault?.()
    const editor = editorRef.current
    if (typeof editor.zoomIn === 'function' && typeof editor.zoomOut === 'function') {
      if (e.deltaY < 0) editor.zoomIn()
      else editor.zoomOut()
    }
  }

  // timed line config -> tool module
  useEffect(() => {
    setTimedLineConfig({
      lifespanMs: Math.max(500, timedSeconds * 1000),
      fadeMs: Math.max(200, timedFadeSeconds * 1000)
    })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('panel:lifespan', String(timedSeconds))
      window.localStorage.setItem('panel:fade', String(timedFadeSeconds))
    }
  }, [timedSeconds, timedFadeSeconds])

  // fade + delete timed lines / draws (smooth via rAF)
  useEffect(() => {
    if (!appReady) return
    let rafId = null

    const tick = () => {
      const editor = editorRef.current
      if (!editor) {
        rafId = requestAnimationFrame(tick)
        return
      }
      const now = Date.now()
      const shapes = editor
        .getCurrentPageShapes()
        .filter(s => s.type === 'timed-line' || s.type === 'timed-draw' || s.type === 'timed-highlight')
      if (shapes.length) {
        const updates = []
        const toDelete = []
        shapes.forEach(shape => {
          const meta = shape.meta || {}
          const createdAt = meta.createdAt || now
          const lifespanMs = meta.lifespanMs || timedSeconds * 1000
          const fadeMs = Math.min(meta.fadeMs || timedFadeSeconds * 1000, lifespanMs)
          const baseOpacity = meta.baseOpacity ?? 1
          const age = now - createdAt
          if (age >= lifespanMs) {
            toDelete.push(shape.id)
            return
          }
          const fadeStart = lifespanMs - fadeMs
          let nextOpacity = baseOpacity
          if (age > fadeStart) {
            const t = Math.max(0, 1 - (age - fadeStart) / fadeMs)
            nextOpacity = baseOpacity * t
          }
          if (nextOpacity !== meta.fade) {
            updates.push({
              id: shape.id,
              type: shape.type,
              meta: { ...meta, fade: nextOpacity }
            })
          }
        })
        if (updates.length) editor.updateShapes(updates)
        if (toDelete.length) editor.deleteShapes(toDelete)
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [appReady, timedSeconds, timedFadeSeconds])

  const uiOverrides = useMemo(() => ({
    tools(editor, tools) {
      return {
        ...tools,
        'timed-line': {
          id: 'timed-line',
          label: 'Timed line',
          icon: 'tool-line',
          kbd: 'shift+l',
          onSelect() {
            editor.setCurrentTool('timed-line')
          }
        },
        'timed-draw': {
          id: 'timed-draw',
          label: 'Timed draw',
          icon: 'tool-pencil',
          kbd: 'shift+d',
          onSelect() {
            editor.setCurrentTool('timed-draw')
          }
        },
        'timed-highlight': {
          id: 'timed-highlight',
          label: 'Timed highlight',
          icon: 'tool-highlight',
          kbd: 'shift+h',
          onSelect() {
            editor.setCurrentTool('timed-highlight')
          }
        }
      }
    }
  }), [])

  const CustomToolbarContent = () => (
    <>
      <DefaultToolbarContent />
      <ToolbarItem tool="timed-line" />
      <ToolbarItem tool="timed-draw" />
      <ToolbarItem tool="timed-highlight" />
    </>
  )

  const ThemeCss = () => (
    <style>{`
      .tl-container {
        --tl-selection-color: #d6d6d6;
        --tl-user-handles-fill: #d6d6d6;
        --tl-user-handles-stroke: #d6d6d6;
      }
    `}</style>
  )

  const ControlsOverlay = () => {
    const hideTimer = React.useRef(null)

    const cancelHide = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }

    const scheduleHide = () => {
      cancelHide()
      hideTimer.current = setTimeout(() => setShowTimedControls(false), 1200)
    }

    return (
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 80,
          zIndex: 20000,
          pointerEvents: 'auto'
        }}
        onPointerEnter={cancelHide}
        onPointerDown={e => { cancelHide(); e.stopPropagation() }}
        onPointerMove={e => e.stopPropagation()}
        onPointerUp={e => { e.stopPropagation() }}
        onPointerLeave={scheduleHide}
      >
        {!showTimedControls && (
          <button
            onClick={() => { cancelHide(); setShowTimedControls(true) }}
            style={{
              background: '#efefef',
              color: '#111',
              border: '0.4px solid #000',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
            }}
          >
            🕖
          </button>
        )}
        {showTimedControls && (
          <div
            style={{
              position: 'relative',
              minWidth: 240,
              background: '#f9fafb',
              border: '1px solid #dcdcdc',
              borderRadius: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
              padding: 12,
              fontSize: 12,
              color: '#111'
            }}
            onPointerEnter={cancelHide}
            onPointerLeave={scheduleHide}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Adj</div>
              <button
                onClick={() => { cancelHide(); setShowTimedControls(false) }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: 4
                }}
                aria-label="Close timed tools"
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 }}>
              <span style={{ width: 70 }}>Lifespan</span>
              <input
                type="range"
                min={5}
                max={10}
                step={0.5}
                value={timedSeconds}
                onChange={e => setTimedSeconds(parseFloat(e.target.value) || 5)}
                style={{ flex: 1 }}
                onPointerDown={e => e.stopPropagation()}
                onPointerMove={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation() }}
              />
              <span style={{ width: 44, textAlign: 'right' }}>{timedSeconds.toFixed(1)}s</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 70 }}>Fade</span>
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.1}
                value={timedFadeSeconds}
                onChange={e => setTimedFadeSeconds(parseFloat(e.target.value) || 0.5)}
                style={{ flex: 1 }}
                onPointerDown={e => e.stopPropagation()}
                onPointerMove={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation() }}
              />
              <span style={{ width: 44, textAlign: 'right' }}>{timedFadeSeconds.toFixed(1)}s</span>
            </div>
            <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 8 }}>
              <button
                onClick={() => { cancelHide(); layoutGrid() }}
                style={{
                  width: '100%',
                  background: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                Layout Grid
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => { cancelHide(); setShowStylePanel(s => !s) }}
                style={{
                  width: '100%',
                  background: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                {showStylePanel ? 'Hide Styles' : 'Show Styles'}
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => { cancelHide(); setShowInterface(s => !s) }}
                style={{
                  width: '100%',
                  background: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                {showInterface ? 'Hide Interface' : 'Show Interface'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const uiComponents = useMemo(() => {
    const overrides = {
      Toolbar: (props) => (
        <DefaultToolbar {...props}>
          <CustomToolbarContent />
        </DefaultToolbar>
      ),
      InFrontOfTheCanvas: ThemeCss,
      SelectionOutline: CustomSelectionOutline,
      SelectionCornerHandle: CustomSelectionCornerHandle,
    }
    if (!showStylePanel) {
      overrides.StylePanel = null
    }
    if (!showInterface) {
      overrides.Toolbar = null
      overrides.MainMenu = null
      overrides.PageMenu = null
      overrides.HelpMenu = null
      overrides.NavigationPanel = null
      overrides.DebugMenu = null
      overrides.ActionsMenu = null
      overrides.ZoomMenu = null
      overrides.Minimap = null
      overrides.KeyboardShortcutsDialog = null
      overrides.QuickActions = null
      overrides.HelperButtons = null
    }
    return overrides
  }, [showStylePanel, showInterface])

  return (
    <div style={{ height: '100vh', minHeight: '800px', display: 'flex' }}>
      <div style={{ width: 240, borderRight: '1px solid #ddd', padding: 12, boxSizing: 'border-box', position: 'relative', overflowY: 'auto' }}>
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: '"3270"', fontWeight: 'bold', fontSize: '18px' }}>Page</span>
            <span style={{ fontFamily: '"3270"', fontSize: '14px' }}>
              {currentPage} / {Math.ceil(visibleIds.size / pageSize) || 1}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                flex: 1,
                fontFamily: '"3270"',
                fontSize: 14,
                padding: '4px 8px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(visibleIds.size / pageSize), p + 1))}
              disabled={currentPage >= Math.ceil(visibleIds.size / pageSize)}
              style={{
                flex: 1,
                fontFamily: '"3270"',
                fontSize: 14,
                padding: '4px 8px',
                cursor: currentPage >= Math.ceil(visibleIds.size / pageSize) ? 'not-allowed' : 'pointer',
                opacity: currentPage >= Math.ceil(visibleIds.size / pageSize) ? 0.5 : 1
              }}
            >
              Next
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: '"3270"', fontSize: '12px' }}>Per page:</span>
            <select 
              value={pageSize} 
              onChange={e => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              style={{ fontFamily: '"3270"', fontSize: '12px' }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
        {/* <h3>Filters</h3> */}
        <div>
          <span style={{ fontFamily: '"3270"', fontWeight: 'bold', fontSize: '18px' }}>Collections</span>
          {collections.map(c => (
            <div key={c}>
              <label style={{ fontSize: '16px', fontFamily: '"3270"', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={activeCollections.has(c)}
                  onChange={e => toggleCollection(c, e.target.checked)}
                  style={{ margin: '0 6px 0 0' }}
                />
                {' '}{c}
              </label>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontFamily: '"3270"', fontWeight: 'bold', fontSize: '18px' }}>Years</span>
            <button
              onClick={() => {
                setActiveYears(new Set())
                if (typeof window !== 'undefined') window.localStorage.removeItem('panel:years')
              }}
              disabled={activeYears.size === 0}
              style={{ fontFamily: '"3270"', fontSize: 14, padding: '2px 6px', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: 4 }}>
            {years.map(y => (
              <div key={`year-${y}`} style={{ lineHeight: '1.2' }}>
                <label style={{ fontSize: '12px', fontFamily: '"3270"', display: 'flex', alignItems: 'center', cursor: 'pointer' }} >
                  <input
                    type="checkbox" 
                    checked={activeYears.has(y)}
                    onChange={e => toggleYear(y, e.target.checked)}
                    style={{ margin: '0 6px 0 0' }}
                  />
                  {y}
                </label>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontFamily: '"3270"', fontWeight: 'bold', fontSize: '18px' }}>Tags</span>
            <button
              onClick={() => {
                setActiveTags(new Set())
                if (typeof window !== 'undefined') window.localStorage.removeItem('panel:tags')
              }}
              disabled={activeTags.size === 0}
              style={{ fontFamily: '"3270"', fontSize: 14, padding: '2px 6px', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', padding: 4 }}>
            {tags.map(t => (
              <div key={`tag-${t}`} style={{ lineHeight: '1.2' }}>
                <label style={{ fontSize: '12px', fontFamily: '"3270"', display: 'flex', alignItems: 'center', cursor: 'pointer' }} >
                  <input
                    type="checkbox" 
                    checked={activeTags.has(t)}
                    onChange={e => toggleTag(t, e.target.checked)}
                    style={{ margin: '0 6px 0 0' }}
                  />
                  {t}
                </label>
              </div>
            ))}
          </div>
        </div>
        {/* 
        <div style={{ marginTop: 12 }}>
          <button onClick={() => { }}>Refresh</button>
          <button style={{ marginLeft: 8 }} onClick={() => shuffle()}>Shuffle</button>
          <button style={{ marginLeft: 8 }} onClick={() => resetFilters()}>Reset</button>
        </div> 
        */}
        {/* Selected card details removed */}
      </div>

      {selectedCard && (
        <div style={{ width: 600, borderRight: '1px solid #ddd', padding: 12, boxSizing: 'border-box', position: 'relative', overflowY: 'auto', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column' }}>
          {viewingUrl ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <button 
                onClick={() => setViewingUrl(null)} 
                style={{ 
                  marginBottom: 8, 
                  fontFamily: '"3270"', 
                  fontSize: '14px', 
                  padding: '4px 8px', 
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                ← Back to details
              </button>
              <iframe 
                src={viewingUrl} 
                style={{ flex: 1, border: '1px solid #ddd', background: 'white' }} 
                title="Content Viewer"
              />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontFamily: '"ChicagoKare"', fontWeight: 'bold', lineHeight: 1, fontSize: '18px', flex: 1, marginRight: 8 }}>{selectedCard.title}</div>
                <button 
                  onClick={() => { setSelectedCard(null); setViewingUrl(null); }}
                  style={{ 
                    fontFamily: '"3270"', 
                    fontSize: '12px', 
                    padding: '2px 6px', 
                    cursor: 'pointer',
                    border: '1px solid #ccc',
                    background: 'white',
                    flexShrink: 0
                  }}
                >
                  CLOSE
                </button>
              </div>
              {selectedCard.image && (
                <div style={{ marginBottom: 12 }}>
                  <img 
                    src={selectedCard.image} 
                    alt={selectedCard.title} 
                    style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4 }} 
                  />
                </div>
              )}
              <p style={{ fontFamily: '"3270"', fontSize: '12px', color: '#888', marginBottom: 12 }}>
                {selectedCard.date ? (new Date(selectedCard.date)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
              </p>
              <p style={{ fontFamily: '"AppleGaramond"', fontSize: '16px', lineHeight: 1.2, marginBottom: 12, color: '#000' }}>
                {selectedCard.summary || ''}
              </p>
              <div style={{ fontSize: 12, color: '#666' }}>
                COLLECTION: <span style={{ backgroundColor: "black", color: "white", margin: '2px', padding: '2px 4px', borderRadius: '4px', fontFamily: '"3270"', lineHeight: 1, display: 'inline-block' }}>{selectedCard.collection}</span><br />
                TAGS: {selectedCard.tags.map(tag => (
                  <span key={tag} style={{ backgroundColor: "black", color: "white", margin: '2px', padding: '2px 4px', borderRadius: '4px', fontFamily: '"3270"', lineHeight: 1, display: 'inline-block' }}>
                    {tag}
                  </span>
                ))}
              </div>
              {selectedCard.url && (
                <div style={{ fontFamily: '"3270"', marginTop: 12, fontSize: '12px', fontWeight: 'bold', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 6px', borderRadius: '6px', display: 'block', width: 'fit-content' }}>
                  <button 
                    onClick={() => setViewingUrl(selectedCard.url)}
                    style={{ color: 'white', textDecoration: 'none', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                  >
                    Open detail
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }} onWheel={onWheel}>
        <Tldraw
          tools={[TimedLineTool, TimedDrawTool, TimedHighlightTool]}
          onMount={editor => { editorRef.current = editor; setAppReady(true) }}
          shapeUtils={[CardShapeUtil, TimedLineShapeUtil, TimedDrawShapeUtil, TimedHighlightShapeUtil]}
          overrides={uiOverrides}
          components={uiComponents}
        />
        {createPortal(<ControlsOverlay />, document.body)}
      </div>
    </div>
  )
}
