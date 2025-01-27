/**
 * Retrieves environment variables from window.configs or process.env
 * @param {string} name - The name of the environment variable
 * @returns {string|undefined} - The value of the environment variable
 */
const getEnv = (name?: string) => {
  // Check if running in a browser and window.configs is defined
  // if (typeof window !== 'undefined' && window.APP_CONFIG) {
  //   if (name === undefined) {
  //     return window.APP_CONFIG
  //   }
  //   return window.APP_CONFIG[name]
  // }
  // Fallback to process.env for Node.js environments
  if (name === undefined) {
    return process.env
  }
  return process.env[name]
}

export default getEnv
