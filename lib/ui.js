import chalk from 'chalk'

// ── Rivian brand colors ──────────────────────────────────────────────

export const c = {
  brand: chalk.hex('#FFAA00'), // Rivian amber
  dim: chalk.dim,
  bold: chalk.bold,
  white: chalk.white,
  red: chalk.red,
  yellow: chalk.yellow,
  green: chalk.green,
  cyan: chalk.cyan,
  gray: chalk.gray,
  blue: chalk.blue,
}

// ── Logo ─────────────────────────────────────────────────────────────

export function logo() {
  return c.brand('  ━0━━━━0━  ') + c.bold('RIVIAN')
}

// ── Section headers ──────────────────────────────────────────────────

export function section(title) {
  const bar = '━'.repeat(Math.max(0, 40 - title.length - 1))
  return c.brand(`${title} ${bar}`)
}

// ── Progress bar ─────────────────────────────────────────────────────

export function bar(value, max = 100, width = 20, opts = {}) {
  const pct = Math.max(0, Math.min(1, value / max))
  const filled = Math.round(pct * width)
  const empty = width - filled

  const filledChar = opts.filledChar || '█'
  const emptyChar = opts.emptyChar || '░'

  let color = c.green
  if (pct <= 0.2) color = c.red
  else if (pct <= 0.4) color = c.yellow

  const filledStr = color(filledChar.repeat(filled))
  const emptyStr = c.dim(emptyChar.repeat(empty))

  return `${filledStr}${emptyStr}`
}

// ── Key-value alignment ──────────────────────────────────────────────

export function kv(label, value, suffix = '', labelWidth = 18) {
  if (value === null || value === undefined) return null
  const padded = label.padEnd(labelWidth)
  return `  ${c.dim(padded)} ${value}${suffix}`
}

// ── Table ────────────────────────────────────────────────────────────

export function table(headers, rows, colWidths) {
  const lines = []

  const headerLine = headers.map((h, i) => c.dim(h.padEnd(colWidths[i]))).join('  ')
  lines.push(`  ${headerLine}`)

  const separator = colWidths.map((w) => '─'.repeat(w)).join('──')
  lines.push(`  ${c.dim(separator)}`)

  for (const row of rows) {
    const line = row.map((cell, i) => String(cell).padEnd(colWidths[i])).join('  ')
    lines.push(`  ${line}`)
  }

  return lines.join('\n')
}

// ── Vehicle diagram (doors/windows) ──────────────────────────────────

export function vehicleDiagram(doors) {
  const dot = (closed, locked) => {
    if (closed === 'closed' && locked === 'locked') return c.green('●')
    if (closed === 'closed') return c.yellow('●')
    if (closed === 'open') return c.red('○')
    return c.dim('·')
  }

  const fl = dot(doors.fl?.closed, doors.fl?.locked)
  const fr = dot(doors.fr?.closed, doors.fr?.locked)
  const rl = dot(doors.rl?.closed, doors.rl?.locked)
  const rr = dot(doors.rr?.closed, doors.rr?.locked)

  return [
    `        ┌───────────┐`,
    `     ${fl} ─┤           ├─ ${fr}`,
    `        │           │`,
    `     ${rl} ─┤           ├─ ${rr}`,
    `        └───────────┘`,
    `    ${c.dim(`${c.green('●')} locked  ${c.yellow('●')} closed  ${c.red('○')} open`)}`,
  ].join('\n')
}

// ── Tire diagram ─────────────────────────────────────────────────────

export function tireDiagram(tires) {
  const okColor = (value) => {
    if (!value) return '--'
    const lower = value.toLowerCase()
    if (lower === 'ok' || lower === 'normal') return c.green(value)
    return c.yellow(value)
  }

  const fl = okColor(tires.fl)
  const fr = okColor(tires.fr)
  const rl = okColor(tires.rl)
  const rr = okColor(tires.rr)

  // Right-pad visible text to fixed width before adding color
  const padLeft = (label, val, rawVal, width = 10) => {
    const visible = `${label}: ${rawVal || '--'}`
    const padding = ' '.repeat(Math.max(0, width - visible.length))
    return `${padding}${label}: ${val}`
  }

  const flLabel = padLeft('FL', fl, tires.fl)
  const rlLabel = padLeft('RL', rl, tires.rl)

  return [
    `    ${flLabel}  ┤ ├  FR: ${fr}`,
    `                │ │`,
    `    ${rlLabel}  ┤ ├  RR: ${rr}`,
  ].join('\n')
}

// ── Closures line ────────────────────────────────────────────────────

export function closureStatus(name, closed, locked) {
  const parts = [closed, locked].filter(Boolean)
  if (!parts.length) return null
  const allGood = closed === 'closed' && locked === 'locked'
  const icon = allGood ? c.green('✓') : c.yellow('○')
  return `  ${icon} ${name}: ${parts.join(', ')}`
}
