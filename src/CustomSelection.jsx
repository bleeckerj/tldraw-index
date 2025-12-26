import React from 'react'
import { useEditor } from 'tldraw'

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------
const CARD_SELECTION_COLOR = '#808080'
const CARD_HOVER_COLOR = '#808080'  // <--- Change this for the hover outline
const CARD_HANDLE_FILL = 'black'
const CARD_HANDLE_STROKE = 'white'

export function CustomSelectionOutline({ width, height, className }) {
  const editor = useEditor()
  const onlySelectedShape = editor.getOnlySelectedShape()
  const isCard = onlySelectedShape?.type === 'card'

  // If the selected shape is a 'card', use our custom color
  // Otherwise, use the default tldraw selection blue
  const stroke = isCard ? CARD_SELECTION_COLOR : 'var(--color-selection-stroke)'

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

  // If it's a card, use custom handle colors
  // Otherwise, use the default tldraw selection colors
  const fill = isCard ? CARD_HANDLE_FILL : 'var(--color-selection-handle-fill)'
  const stroke = isCard ? CARD_HANDLE_STROKE : 'var(--color-selection-handle-stroke)'

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

