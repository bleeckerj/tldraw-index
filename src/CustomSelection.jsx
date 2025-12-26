import React from 'react'
import { useEditor, DefaultShapeIndicator } from 'tldraw'

export function CustomSelectionOutline({ width, height, className }) {
  const editor = useEditor()
  const onlySelectedShape = editor.getOnlySelectedShape()
  const isCard = onlySelectedShape?.type === 'card'

  // --------------------------------------------------
  // EDIT HERE: Customize the outline style
  // --------------------------------------------------
  // If the selected shape is a 'card', use gray
  // Otherwise, use the default tldraw selection blue
  const stroke = isCard ? '#808080' : 'var(--color-selection-stroke)'

  return (
    <rect
      className={className}
      width={width}
      height={height}
      fill="none"
      style={{ stroke: stroke }}
      strokeWidth={isCard ? 2 : 0}
      pointerEvents="none"
    />
  )
}

export function CustomSelectionCornerHandle({ x, y, width, height, className }) {
  const editor = useEditor()
  const onlySelectedShape = editor.getOnlySelectedShape()
  const isCard = onlySelectedShape?.type === 'card'

  // --------------------------------------------------
  // EDIT HERE: Customize the handle style
  // --------------------------------------------------
  // If it's a card, use black fill with white stroke
  // Otherwise, use the default tldraw selection colors
  const fill = isCard ? 'black' : 'var(--color-selection-handle-fill)'
  const stroke = isCard ? 'white' : 'var(--color-selection-handle-stroke)'

  return (
    <rect
      className={className}
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ fill: fill, stroke: stroke }}
      strokeWidth={1}
    />
  )
}

export function CustomShapeIndicator(props) {
  const editor = useEditor()
  const shape = editor.getShape(props.shapeId)
  const isCard = shape?.type === 'card'

  // If you want this style for ALL shapes, remove the "if (isCard)" check
  if (isCard) {
    return (
      <div style={{ '--color-selection-stroke': '#808080', display: 'contents' }}>
        <DefaultShapeIndicator {...props} />
      </div>
    )
  }

  return <DefaultShapeIndicator {...props} />
}
