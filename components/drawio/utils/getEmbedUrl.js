/**
 * Generate the Draw.io embed URL with parameters
 * @param {string} baseUrl - Base URL for Draw.io (defaults to embed.diagrams.net)
 * @param {Object} urlParameters - Additional URL parameters
 * @param {boolean} hasConfiguration - Whether configuration will be sent
 * @returns {string} Complete embed URL
 */
export function getEmbedUrl(baseUrl, urlParameters = {}, hasConfiguration = false) {
  const base = baseUrl || 'https://embed.diagrams.net/';

  // Default parameters for embed mode
  const defaultParams = {
    embed: '1',
    proto: 'json',
    spin: '1',
    libraries: '1',
    saveAndExit: '0',
    noSaveBtn: '1',
    noExitBtn: '1',
    ...(hasConfiguration ? { configure: '1' } : {})
  };

  // Merge with custom parameters
  const params = { ...defaultParams, ...urlParameters };

  // Build query string
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${base}?${queryString}`;
}
