import React from 'react'
import { StateNode } from '@tldraw/editor'
import { HighlightShapeUtil } from 'tldraw'
import * as DrawingModule from '../node_modules/tldraw/dist-esm/lib/shapes/draw/toolStates/Drawing.mjs'
import * as IdleModule from '../node_modules/tldraw/dist-esm/lib/shapes/draw/toolStates/Idle.mjs'
import { getTimedLineConfig } from './TimedLineTool'

const { Drawing } = DrawingModule
const { Idle } = IdleModule

export class TimedHighlightShapeUtil extends HighlightShapeUtil {
	static type = 'timed-highlight'
	static migrations = {
		id: 'com.tldraw.shape.timed-highlight',
		version: 1,
		sequence: []
	}

	component(shape) {
		const fade = shape?.meta?.fade ?? 1
		const base = super.component(shape)
		return applyOpacity(base, fade)
	}

	backgroundComponent(shape) {
		const fade = shape?.meta?.fade ?? 1
		const base = super.backgroundComponent(shape)
		return applyOpacity(base, fade)
	}
}

function applyOpacity(element, fade) {
	if (!React.isValidElement(element)) return element
	const child = applyOpacity(element.props.children, fade)
	const newProps = { ...element.props }
	if (newProps.opacity != null) newProps.opacity = (newProps.opacity || 0) * fade
	if (newProps.style && newProps.style.opacity != null) {
		newProps.style = { ...newProps.style, opacity: (newProps.style.opacity || 0) * fade }
	}
	return React.cloneElement(element, newProps, child)
}

class TimedHighlightDrawing extends Drawing {
	shapeType = 'timed-highlight'

	canClose() {
		// highlights should never be closed paths
		return false
	}

	onEnter(info) {
		super.onEnter(info)
		const cfg = getTimedLineConfig()
		const shape = this.initialShape ?? (this.editor && this.editor.getOnlySelectedShape?.())
		if (shape) {
			const opacityForShape = this.editor?.getStyleForNextShape?.('opacity') ?? 1
			this.editor.updateShapes([
				{
					id: shape.id,
					type: shape.type,
					meta: {
						...(shape.meta || {}),
						timed: true,
						createdAt: Date.now(),
						lifespanMs: cfg.lifespanMs,
						fadeMs: cfg.fadeMs,
						baseOpacity: opacityForShape,
						fade: opacityForShape
					}
				}
			])
		}
	}
}

class TimedHighlightIdle extends Idle {
	static id = 'idle'
}

export class TimedHighlightTool extends StateNode {
	static id = 'timed-highlight'
	static initial = 'idle'
	static isLockable = false
	static useCoalescedEvents = true
	static children() {
		return [TimedHighlightIdle, TimedHighlightDrawing]
	}

	shapeType = 'timed-highlight'

	onExit() {
		const drawingState = this.children?.['drawing']
		if (drawingState) drawingState.initialShape = undefined
	}
}
