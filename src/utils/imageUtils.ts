import { FileEntity } from '../types'

export function getImageSrc (image: FileEntity | undefined | string | null, placeholder: string = generateRandomImageBase64(300, 150, 5)): string {
  if (typeof image === 'string') return image
  if (typeof image === 'object' && image?.path && typeof image.path === 'string') return image.path
  return placeholder
}

function generateRandomShape (width: number, height: number): string {
  const colors = ['#1E1A43', '#7B71DA', '#AF9EEB']
  const shapes = ['circle', 'ellipse']
  const shape = shapes[Math.floor(Math.random() * shapes.length)]
  const color = colors[Math.floor(Math.random() * colors.length)]

  switch (shape) {
    case 'circle': {
      const radius = Math.floor(Math.random() * Math.min(width, height) / 4)
      const cx = Math.floor(Math.random() * (width - 2 * radius) + radius)
      const cy = Math.floor(Math.random() * (height - 2 * radius) + radius)
      return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" opacity="${Math.random() * 0.5 + 0.5}" />`
    }
    case 'ellipse': {
      const rx = Math.floor(Math.random() * width / 4)
      const ry = Math.floor(Math.random() * height / 4)
      const ecx = Math.floor(Math.random() * (width - 2 * rx) + rx)
      const ecy = Math.floor(Math.random() * (height - 2 * ry) + ry)
      return `<ellipse cx="${ecx}" cy="${ecy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${Math.random() * 0.5 + 0.5}" />`
    }
    default:
      return ''
  }
}

export function generateRandomImageBase64 (width: number, height: number, shapeCount: number): string {
  let shapes = ''
  for (let i = 0; i < shapeCount; i++) {
    shapes += generateRandomShape(width, height)
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#f0f0f0" />
      ${shapes}
    </svg>
  `

  const base64 = btoa(svg)
  return `data:image/svg+xml;base64,${base64}`
}

// Приклад використання:
// const randomImageBase64 = generateRandomImageBase64(300, 200, 5);
