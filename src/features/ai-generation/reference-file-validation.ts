import {
  ACCEPTED_REFERENCE_FILE_EXTENSIONS,
  MAX_REFERENCE_FILES,
  MAX_REFERENCE_FILE_SIZE_BYTES,
} from '@/features/ai-generation/constants'
import type { ReferenceFileMergeResult } from '@/features/ai-generation/types'

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function isSameFile(firstFile: File, secondFile: File): boolean {
  return firstFile.name === secondFile.name
    && firstFile.size === secondFile.size
    && firstFile.lastModified === secondFile.lastModified
}

export function mergeValidReferenceFiles(
  currentReferenceFiles: readonly File[],
  selectedReferenceFiles: readonly File[],
): ReferenceFileMergeResult {
  const containsUnsupportedFile = selectedReferenceFiles.some(
    (referenceFile) => !ACCEPTED_REFERENCE_FILE_EXTENSIONS.has(
      getFileExtension(referenceFile.name),
    ),
  )
  if (containsUnsupportedFile) {
    return { referenceFiles: [...currentReferenceFiles], errorKey: 'ai.unsupportedFile' }
  }

  const containsOversizedFile = selectedReferenceFiles.some(
    (referenceFile) => referenceFile.size > MAX_REFERENCE_FILE_SIZE_BYTES,
  )
  if (containsOversizedFile) {
    return { referenceFiles: [...currentReferenceFiles], errorKey: 'ai.fileTooLarge' }
  }

  const mergedReferenceFiles = [...currentReferenceFiles]
  for (const selectedReferenceFile of selectedReferenceFiles) {
    const isDuplicate = mergedReferenceFiles.some(
      (currentReferenceFile) => isSameFile(currentReferenceFile, selectedReferenceFile),
    )
    if (!isDuplicate) mergedReferenceFiles.push(selectedReferenceFile)
  }

  if (mergedReferenceFiles.length > MAX_REFERENCE_FILES) {
    return { referenceFiles: [...currentReferenceFiles], errorKey: 'ai.tooManyFiles' }
  }

  return { referenceFiles: mergedReferenceFiles, errorKey: null }
}
