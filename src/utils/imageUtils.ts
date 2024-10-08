import { UploadedFileEntity } from 'src/types'

export function getImageSrc (image: UploadedFileEntity | undefined | string | null, placeholder: string = 'https://via.placeholder.com/350'): string {
  if (typeof image === 'object' && image?.path) {
    return image.path
  }
  return typeof image === 'string' ? image : placeholder
}
