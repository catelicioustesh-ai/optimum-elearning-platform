export function wikipediaSearchUrl(...topics) {
  const query = topics.filter(Boolean).join(' ')
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`
}
