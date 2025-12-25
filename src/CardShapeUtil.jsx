import React from 'react'
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d } from '@tldraw/editor'
import stylesConfig from './data/styles.json'

function getSectionStyle(section, collection) {
  const defaults = stylesConfig.sections?.[section] || {}
  const overrides = stylesConfig.collections?.[collection]?.[section] || {}
  return { ...defaults, ...overrides }
}

export class CardShapeUtil extends BaseBoxShapeUtil {
  static type = 'card'

  getDefaultProps() {
    return {
      w: 360,
      h: 420,
      title: '',
      image: '',
      summary: '',
      content: '',
      collection: '',
      cardId: '',
      opacity: 1,
      showDetails: true
    }
  }

  getEffectiveHeight(shape) {
    const { w, h, showDetails = true } = shape.props
    if (showDetails) return h
    const titleH = 40
    const reserved = titleH + 0 + 20
    const fallbackImageH = Math.max(140, Math.min(220, h * 0.45))
    const maxImageH = Math.max(100, h - reserved)
    const imageH = Math.max(80, Math.min(maxImageH, w * 0.75))
    return titleH + imageH
  }

  getGeometry(shape) {
    const { w } = shape.props
    const effH = this.getEffectiveHeight(shape)
    return new Rectangle2d({ x: 0, y: 0, width: w, height: effH, isFilled: false })
  }

  canResize() {
    return true
  }

  isAspectRatioLocked() {
    return false
  }

  component(shape) {
    const { w, h, title, image, summary, tags = [], opacity = 1, collection, showDetails = true } = shape.props
    const [aspectRatio, setAspectRatio] = React.useState(null)
    const titleH = 40
    const tagsH = showDetails ? 40 : 0
    const reserved = titleH + tagsH + 20
    const fallbackImageH = Math.max(140, Math.min(220, h * 0.45))
    const maxImageH = Math.max(100, h - reserved)
    const imageH = aspectRatio
      ? Math.max(80, Math.min(maxImageH, w * aspectRatio))
      : fallbackImageH
    const summaryH = showDetails ? Math.max(80, h - titleH - imageH - tagsH - 10) : 0
    const summaryFontSize = Math.max(8, Math.min(14, h * 0.04))
    const tagFontSize = Math.max(6, Math.min(10, h * 0.02))
    const titleFontSize = Math.max(9, Math.min(20, h * 0.05))
    const effectiveHeight = showDetails ? h : titleH + imageH
    const cardStyle = getSectionStyle('card', collection)
    const titleStyle = getSectionStyle('titleBar', collection)
    const imageStyle = getSectionStyle('image', collection)
    const tagsBarStyle = getSectionStyle('tagsBar', collection)
    const tagStyle = getSectionStyle('tag', collection)
    const summaryStyle = getSectionStyle('summary', collection)

    const editor = this.editor

    return (
      <HTMLContainer id={shape.id}>
        <div
          style={{
            ...cardStyle,
            width: w,
            height: effectiveHeight,
            overflow: 'hidden',
            // fontFamily: 'serif',
            userSelect: 'none',
            opacity,
            pointerEvents: opacity === 0 ? 'none' : 'auto',
            visibility: opacity === 0 ? 'hidden' : 'visible'
          }}
        >
          <div
            style={{
              ...titleStyle,
              height: titleH,
              padding: '8px 12px',
              fontWeight: 700,
              fontSize: titleFontSize,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title || '(untitled)'}
            </span>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                if (!editor) return
                const next = !(showDetails ?? true)
                editor.updateShapes([{
                  id: shape.id,
                  type: shape.type,
                  props: { ...shape.props, showDetails: next }
                }])
              }}
              style={{
                background: '#fff',
                color: '#000',
                border: '2px solid #000',
                padding: '2px 8px',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              title={showDetails ? 'Hide details' : 'Show details'}
            >
              {showDetails ? '–' : '+'}
            </button>
          </div>
          <div style={{ height: imageH, overflow: 'hidden', ...imageStyle }}>
            {image ? (
              <img
                alt=""
                src={image}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  display: 'block',
                  background: imageStyle.background || '#111'
                }}
                onPointerDown={e => {
                  // prevent native drag/copy but still allow drawing; hold Shift to allow native behavior if needed
                  if (!e.shiftKey) e.preventDefault()
                }}
                onDragStart={e => {
                  if (!e.shiftKey) e.preventDefault()
                }}
                onLoad={e => {
                  const nw = e.target.naturalWidth || 0
                  const nh = e.target.naturalHeight || 0
                  if (nw > 0 && nh > 0) {
                    const ar = nh / nw
                    if (!aspectRatio || Math.abs(ar - aspectRatio) > 0.001) {
                      setAspectRatio(ar)
                    }
                  }
                }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#666' }}>
                (no image)
              </div>
            )}
          </div>
          {showDetails && (
            <>
              <div
                style={{
                  ...tagsBarStyle,
                  minHeight: tagsH,
                  padding: '8px 12px',
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}
              >
                {tags.map(tag => (
                  <span
                    key={tag}
                    className='font-mono tags'
                    style={{
                      ...tagStyle,
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: tagFontSize
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div
                style={{
                  ...summaryStyle,
                  height: summaryH,
                  padding: '12px',
                  fontSize: summaryFontSize,
                  lineHeight: 1.35,
                  boxSizing: 'border-box'
                }}
              >
                {summary || '(no summary)'}
              </div>
            </>
          )}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape) {
    const { w } = shape.props
    const effectiveHeight = this.getEffectiveHeight(shape)
    return <rect width={w} height={effectiveHeight} rx={12} ry={12} />
  }
}

export default CardShapeUtil
