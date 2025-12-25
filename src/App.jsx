import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Tldraw, DefaultToolbar, DefaultToolbarContent, ToolbarItem } from 'tldraw'
import { createShapeId } from '@tldraw/editor'
import 'tldraw/tldraw.css'
import CardShapeUtil from './CardShapeUtil.jsx'
import cardsData from './data/cards.json'
import { TimedLineShapeUtil, TimedLineTool, setTimedLineConfig } from './TimedLineTool.js'
import { TimedDrawShapeUtil, TimedDrawTool } from './TimedDrawTool.js'
import { TimedHighlightShapeUtil, TimedHighlightTool } from './TimedHighlightTool.js'

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
  const [activeCollections, setActiveCollections] = useState(new Set())
  const [activeTags, setActiveTags] = useState(new Set())
  const [positions, setPositions] = useState({})
  const [selectedCard, setSelectedCard] = useState(null)
  const [timedSeconds, setTimedSeconds] = useState(5)
  const [timedFadeSeconds, setTimedFadeSeconds] = useState(2)
  const placed = useRef(false)

  useEffect(() => {
    const cols = Array.from(new Set(cardsData.map(c => c.collection)))
    const ts = Array.from(new Set(cardsData.flatMap(c => c.tags)))
    setCollections(cols)
    setTags(ts)
    setActiveCollections(new Set(cols))
    const pos = {}
    cardsData.forEach((c, i) => { pos[c.id] = randomPos(i) })
    setPositions(pos)
  }, [])

  const visibleIds = useMemo(
    () =>
      new Set(
        cardsData
          .filter(
            c =>
              activeCollections.has(c.collection) &&
              (activeTags.size === 0 || c.tags.some(t => activeTags.has(t)))
          )
          .map(c => c.id)
      ),
    [activeCollections, activeTags]
  )

  // seed cards as custom shapes
  useEffect(() => {
    if (!appReady || placed.current || Object.keys(positions).length === 0 || !editorRef.current) return
    const editor = editorRef.current
    const shapes = cardsData.map((card, idx) => {
      const pos = positions[card.id]
      return {
        id: createShapeId(card.id),
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
          opacity: 1,
          showDetails: true
        },
        meta: { cardId: card.id },
        index: `a${idx}`
      }
    })
    editor.createShapes(shapes)
    placed.current = true
  }, [appReady, positions])

  // visibility + prop sync (merge JSON content into shapes, hide via opacity)
  useEffect(() => {
    if (!appReady || !editorRef.current) return
    const editor = editorRef.current
    const current = editor.getCurrentPageShapes().filter(s => s.type === 'card')
    const cardById = new Map(cardsData.map(c => [c.id, c]))
      const updates = current.map(shape => {
        const card = cardById.get(shape.props.cardId)
        const opacity = visibleIds.has(shape.props.cardId) ? 1 : 0
        if (!card) return null
        return {
        id: shape.id,
        type: 'card',
        props: {
          ...shape.props,
          title: card.title,
          image: card.image,
          summary: card.summary,
          url: card.url || '',
          collection: card.collection,
          cardId: card.id,
          tags: card.tags || [],
          opacity,
          showDetails: shape.props.showDetails ?? true
        }
      }
    }).filter(Boolean)
    if (updates.length) editor.updateShapes(updates)
  }, [appReady, visibleIds, positions])

  function toggleCollection(c, checked) {
    const next = new Set(activeCollections)
    if (checked) next.add(c)
    else next.delete(c)
    setActiveCollections(next)
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
  }

  function handleChange(app) {
    if (!app) return
    editorRef.current = app
    const selectedId = app
      .getSelectedShapes()
      .find(shape => shape.type === 'card' && visibleIds.has(shape.props.cardId))?.id
    if (!selectedId) {
      setSelectedCard(null)
      return
    }
    const shape = app.getShape(selectedId)
    const cardId = shape?.props?.cardId
    const card = cardsData.find(c => c.id === cardId)
    setSelectedCard(card || null)
  }

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

  const uiComponents = useMemo(() => ({
    Toolbar: (props) => (
      <DefaultToolbar {...props}>
        <CustomToolbarContent />
      </DefaultToolbar>
    ),
    InFrontOfTheCanvas: ThemeCss
  }), [])

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <div style={{ width: 320, borderRight: '1px solid #ddd', padding: 12, boxSizing: 'border-box' }}>
        <h3>Filters</h3>
        <div>
          <strong>Collections</strong>
          {collections.map(c => (
            <div key={c}>
              <label>
                <input
                  type="checkbox"
                  checked={activeCollections.has(c)}
                  onChange={e => toggleCollection(c, e.target.checked)}
                />
                {' '}{c}
              </label>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <strong>Tags</strong>
          {tags.map(t => (
            <div key={t}>
              <label>
                <input
                  type="checkbox"
                  checked={activeTags.has(t)}
                  onChange={e => toggleTag(t, e.target.checked)}
                />
                {' '}{t}
              </label>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => { /* legacy */ }}>Refresh</button>
          <button style={{ marginLeft: 8 }} onClick={() => shuffle()}>Shuffle</button>
        </div>

        <div style={{ marginTop: 18 }}>
          <h4>Selected</h4>
          {selectedCard ? (
            <div>
              <strong>{selectedCard.title}</strong>
              <p>{selectedCard.summary}</p>
              <div style={{ fontSize: 12, color: '#666' }}>
                <div>Collection: {selectedCard.collection}</div>
                <div>Tags: {selectedCard.tags.join(', ')}</div>
                {selectedCard.url && (
                  <div style={{ marginTop: 8 }}>
                    <a href={selectedCard.url} target="_blank" rel="noreferrer">Open detail</a>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => toggleDetails(selectedCard.id)}>
                  Toggle details
                </button>
              </div>
            </div>
          ) : <div>(select a card)</div>}
        </div>

        <div style={{ marginTop: 18 }}>
          <h4>Timed line</h4>
          <div>
            <label>
              Lifespan (s){' '}
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={timedSeconds}
                onChange={e => setTimedSeconds(parseFloat(e.target.value) || 0)}
              />
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>
              Fade duration (s){' '}
              <input
                type="number"
                min={0.2}
                step={0.2}
                value={timedFadeSeconds}
                onChange={e => setTimedFadeSeconds(parseFloat(e.target.value) || 0)}
              />
            </label>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }} onWheel={onWheel}>
        <Tldraw
          tools={[TimedLineTool, TimedDrawTool, TimedHighlightTool]}
          onMount={editor => { editorRef.current = editor; setAppReady(true) }}
          onChange={handleChange}
          shapeUtils={[CardShapeUtil, TimedLineShapeUtil, TimedDrawShapeUtil, TimedHighlightShapeUtil]}
          overrides={uiOverrides}
          components={uiComponents}
        />
      </div>
    </div>
  )
}
