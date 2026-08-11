import { ApiError } from '@/server/http/api-response'

export function requiredString(
  value: unknown,
  fieldName: string,
  options: { minLength?: number; maxLength?: number } = {},
) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(`${fieldName} is required.`, 400, 'VALIDATION_ERROR')
  }

  const normalizedValue = value.trim()
  if (options.minLength && normalizedValue.length < options.minLength) {
    throw new ApiError(
      `${fieldName} must be at least ${options.minLength} characters.`,
      400,
      'VALIDATION_ERROR',
    )
  }
  if (options.maxLength && normalizedValue.length > options.maxLength) {
    throw new ApiError(
      `${fieldName} must be at most ${options.maxLength} characters.`,
      400,
      'VALIDATION_ERROR',
    )
  }

  return normalizedValue
}

export function optionalString(
  value: unknown,
  fieldName: string,
  options: { maxLength?: number; allowEmpty?: boolean } = {},
) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new ApiError(`${fieldName} must be a string.`, 400, 'VALIDATION_ERROR')
  }

  const normalizedValue = value.trim()
  if (!normalizedValue && !options.allowEmpty) {
    throw new ApiError(`${fieldName} cannot be empty.`, 400, 'VALIDATION_ERROR')
  }
  if (options.maxLength && normalizedValue.length > options.maxLength) {
    throw new ApiError(
      `${fieldName} must be at most ${options.maxLength} characters.`,
      400,
      'VALIDATION_ERROR',
    )
  }
  return normalizedValue
}

export function enumValue<const Values extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: Values,
): Values[number] {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw new ApiError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}.`,
      400,
      'VALIDATION_ERROR',
    )
  }
  return value as Values[number]
}
