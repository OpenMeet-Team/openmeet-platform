export const truncateDescription = (description: string, length: number = 100): string => {
  return description.length > length
    ? description.substring(0, length) + '...'
    : description
}
