/** Chooses a broad enterprise category from a module title or description. */
export function detectEnterpriseCategory(value: string) {
  if (/(sales|customer|revenue|presales)/i.test(value)) return 'Revenue Enablement'
  if (/(ai|langchain|mcp|model|agent|rag)/i.test(value)) return 'Artificial Intelligence'
  if (/(it|software|network|cloud|cyber)/i.test(value)) return 'Digital Foundations'
  return 'Professional Development'
}
