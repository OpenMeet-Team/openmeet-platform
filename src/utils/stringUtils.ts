export const truncateDescription = (description: string, length: number = 100): string => {
  return description.length > length
    ? description.substring(0, length) + '...'
    : description
}

export function pluralize (count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return singular
  }
  return plural || `${singular}s`
}
