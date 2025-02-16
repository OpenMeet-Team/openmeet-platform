export const getSourceColor = (sourceType: string) => {
  switch (sourceType) {
    case 'bluesky':
      return 'info'
    default:
      return 'grey'
  }
}
