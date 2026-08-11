import { useRef } from 'react'
import { CheckCircle2, FileText, Loader2, Upload, X, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { REFERENCE_FILE_INPUT_ACCEPT } from '@/features/ai-generation/constants'
import type { ReferenceFileUploadRecord } from '@/features/ai-generation/types'
import { t9, type Lang } from '@/lib/i18n'

interface ReferenceFilesSectionProps {
  language: Lang
  referenceFiles: readonly File[]
  referenceUploadRecords: readonly ReferenceFileUploadRecord[]
  onReferenceFilesSelected: (referenceFiles: File[]) => void
  onReferenceFileRemoved: (referenceFile: File) => void
}

function getUploadRecord(
  file: File,
  records: readonly ReferenceFileUploadRecord[],
): ReferenceFileUploadRecord | null {
  return records.find((r) => r.file === file) ?? null
}

export function ReferenceFilesSection({
  language,
  referenceFiles,
  referenceUploadRecords,
  onReferenceFilesSelected,
  onReferenceFileRemoved,
}: ReferenceFilesSectionProps) {
  const referenceFileInput = useRef<HTMLInputElement>(null)

  return (
    <section className='rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-sm font-semibold'>{t9('ai.referencesLabel', language)}</h2>
          <p className='mt-1 text-xs leading-5 text-muted-foreground'>
            {t9('ai.referencesHelp', language)}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => referenceFileInput.current?.click()}
        >
          <Upload className='size-3.5' /> {t9('ai.chooseFiles', language)}
        </Button>
      </div>
      <input
        ref={referenceFileInput}
        type='file'
        multiple
        accept={REFERENCE_FILE_INPUT_ACCEPT}
        onChange={(event) => {
          onReferenceFilesSelected(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
        className='hidden'
      />
      {referenceFiles.length > 0 ? (
        <div className='mt-3 space-y-2'>
          {referenceFiles.map((referenceFile) => {
            const record = getUploadRecord(referenceFile, referenceUploadRecords)
            const status = record?.status ?? 'pending'

            return (
              <div
                key={`${referenceFile.name}-${referenceFile.lastModified}`}
                className='flex items-center gap-2 rounded-lg border border-border/60 bg-slate-50 px-3 py-2'
              >
                <FileText className='size-4 shrink-0 text-slate-500' />
                <div className='min-w-0 flex-1'>
                  <span className='block truncate text-xs font-medium'>
                    {referenceFile.name}
                  </span>
                  {status === 'uploaded' && record && (
                    <span className='block text-[10px] text-emerald-600'>
                      {record.extractedTextLength.toLocaleString()} chars
                      {record.extractedImageCount > 0
                        ? `, ${record.extractedImageCount} image${record.extractedImageCount > 1 ? 's' : ''}`
                        : ''}
                    </span>
                  )}
                  {status === 'failed' && record?.errorMessage && (
                    <span className='block truncate text-[10px] text-red-600'>
                      {record.errorMessage}
                    </span>
                  )}
                  {status === 'pending' && (
                    <span className='block text-[10px] text-muted-foreground'>
                      {(referenceFile.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  )}
                </div>

                {/* Upload status indicator */}
                <span className='shrink-0' aria-label={`Upload status: ${status}`}>
                  {status === 'uploading' && (
                    <Loader2 className='size-3.5 animate-spin text-slate-400' />
                  )}
                  {status === 'uploaded' && (
                    <CheckCircle2 className='size-3.5 text-emerald-500' />
                  )}
                  {status === 'failed' && (
                    <XCircle className='size-3.5 text-red-500' />
                  )}
                </span>

                <button
                  type='button'
                  aria-label={`${t9('ai.removeFile', language)} ${referenceFile.name}`}
                  onClick={() => onReferenceFileRemoved(referenceFile)}
                  disabled={status === 'uploading'}
                  className='rounded p-1 text-muted-foreground hover:bg-slate-200 hover:text-foreground disabled:opacity-40'
                >
                  <X className='size-3.5' />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className='mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground'>
          {t9('ai.noReferences', language)}
        </div>
      )}
    </section>
  )
}
