export interface GridSlot {
  itemId: string
  count: number
}

export interface CraftingGridData {
  grid: GridSlot[][]
  outputItem: string
  outputCount: number
}

export type SlotRef =
  | { kind: 'grid'; row: number; col: number }
  | { kind: 'output' }

const EMPTY_SLOT: GridSlot = { itemId: '', count: 0 }

export function slotFromRef(
  ref: SlotRef,
  grid: GridSlot[][],
  outputItem: string,
  outputCount: number,
): GridSlot {
  if (ref.kind === 'output') {
    return outputItem
      ? { itemId: outputItem, count: outputCount > 0 ? outputCount : 1 }
      : EMPTY_SLOT
  }
  return grid[ref.row][ref.col]
}

export function applySlot(
  ref: SlotRef,
  slot: GridSlot,
  grid: GridSlot[][],
  outputItem: string,
  outputCount: number,
): CraftingGridData {
  if (ref.kind === 'output') {
    return {
      grid,
      outputItem: slot.itemId,
      outputCount: slot.itemId ? Math.max(1, slot.count || 1) : 1,
    }
  }
  const newGrid = grid.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      rowIndex === ref.row && colIndex === ref.col ? { ...slot } : { ...cell },
    ),
  )
  return { grid: newGrid, outputItem, outputCount }
}
