// import { FileEntity } from 'src/types'

// export function getImageSrc (image: FileEntity | undefined | string | null, placeholder: string = 'https://via.placeholder.com/350'): string {
//   if (typeof image === 'object' && image?.path) {
//     return image.path
//   }
//   return typeof image === 'string' ? image : placeholder
// }

import { FileEntity } from 'src/types'

export function getImageSrc (image: FileEntity | undefined | string | null, placeholder: string = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YwZjBmMCIvPgogIDxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iODAiIGZpbGw9IiNlMGUwZTAiLz4KICA8cGF0aCBkPSJNNDAgMTYwIFE3MCAxMjAgMTAwIDE2MCBRMTMwIDEyMCAxNjAgMTYwIiBzdHJva2U9IiNkMGQwZDAiIHN0cm9rZS13aWR0aD0iOCIgZmlsbD0ibm9uZSIvPgo8L3N2Zz4='): string {
  if (typeof image === 'object' && image?.path) {
    return image.path
  }
  return typeof image === 'string' ? image : placeholder
}
