'use client'

import { useCallback, useRef, useState } from 'react'
import { FileDown, FileText, Loader2, Pencil, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { t9, type Lang } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'

interface AddSectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  onSaved: () => void
}

const MAX_PRESENTATION_BYTES = 200 * 1024 * 1024
const MAX_PRESENTATIONS_PER_LESSON = 10
const ALLOWED_PRESENTATION_EXTENSIONS = ['.pdf', '.ppt', '.pptx']

interface PresentationDraft {
  key: string
  fileName: string
  filePath?: string
  file?: File
}

export default function AddSectionModal({
  open,
  onOpenChange,
  courseId,
  onSaved,
}: AddSectionModalProps) {
  const setAddSectionOpen = useAppStore((state) => state.setAddSectionOpen)
  const editLesson = useAppStore((state) => state.editLesson)
  const setEditLesson = useAppStore((state) => state.setEditLesson)
  const lang = useAppStore((state) => state.lang) as Lang
  const presentationInputRef = useRef<HTMLInputElement>(null)

  const [sectionName, setSectionName] = useState(editLesson?.title ?? '')
  const [description, setDescription] = useState(editLesson?.description ?? '')
  const [presentations, setPresentations] = useState<PresentationDraft[]>(() => (
    editLesson?.presentations.map((presentation) => ({
      key: presentation.id,
      fileName: presentation.fileName,
      filePath: presentation.filePath,
    })) ?? []
  ))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = Boolean(editLesson)

  const resetForm = useCallback(() => {
    setSectionName('')
    setDescription('')
    setPresentations([])
    setError(null)
    if (presentationInputRef.current) presentationInputRef.current.value = ''
  }, [])

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
      setEditLesson(null)
    }
    onOpenChange(nextOpen)
    setAddSectionOpen(nextOpen)
  }, [onOpenChange, resetForm, setAddSectionOpen, setEditLesson])

  const validatePresentation = useCallback((file: File) => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!ALLOWED_PRESENTATION_EXTENSIONS.includes(extension)) {
      setError(t9('addSection.acceptedFiles', lang))
      return false
    }
    if (file.size > MAX_PRESENTATION_BYTES) {
      setError(t9('addSection.fileSizeLimit', lang))
      return false
    }
    setError(null)
    return true
  }, [lang])

  const selectPresentations = useCallback((files: File[]) => {
    if (files.length === 0) return
    if (presentations.length + files.length > MAX_PRESENTATIONS_PER_LESSON) {
      setError(t9('addSection.tooManyPresentations', lang))
      return
    }
    for (const file of files) {
      if (!validatePresentation(file)) return
    }

    setPresentations((currentPresentations) => {
      const existingNames = new Set(currentPresentations.map((presentation) => presentation.fileName.toLowerCase()))
      const uniqueFiles = files.filter((file) => !existingNames.has(file.name.toLowerCase()))
      return [
        ...currentPresentations,
        ...uniqueFiles.map((file) => ({
          key: `${file.name}:${file.size}:${file.lastModified}`,
          fileName: file.name,
          file,
        })),
      ]
    })
    setError(null)
    if (presentationInputRef.current) presentationInputRef.current.value = ''
  }, [lang, presentations.length, validatePresentation])

  const removePresentation = useCallback((key: string) => {
    setPresentations((currentPresentations) => (
      currentPresentations.filter((presentation) => presentation.key !== key)
    ))
    setError(null)
  }, [])

  const uploadPresentation = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/upload', { method: 'POST', body: formData })
    const responseBody = await response.json()
    if (!response.ok) throw new Error(responseBody.error || 'Upload failed.')
    return {
      fileName: responseBody.filename as string,
      filePath: responseBody.filePath as string,
    }
  }

  const handleSubmit = async () => {
    const trimmedSectionName = sectionName.trim()
    if (!trimmedSectionName) {
      setError(t9('addSection.enterSectionName', lang))
      return
    }
    if (!description.trim()) {
      setError(t9('addSection.descriptionRequired', lang))
      return
    }
    if (presentations.length === 0) {
      setError(t9('addSection.presentationRequired', lang))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const presentationMetadata = await Promise.all(presentations.map((presentation) => (
        presentation.file
          ? uploadPresentation(presentation.file)
          : Promise.resolve({ fileName: presentation.fileName, filePath: presentation.filePath as string })
      )))

      const response = editLesson
        ? await fetch(`/api/lessons/${editLesson.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: trimmedSectionName,
              description: description.trim(),
              presentations: presentationMetadata,
            }),
          })
        : await fetch(`/api/courses/${courseId}/add-manual-section`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sectionName: trimmedSectionName,
              description: description.trim(),
              presentations: presentationMetadata,
            }),
          })

      const responseBody = await response.json()
      if (!response.ok) {
        throw new Error(responseBody.error || (
          editLesson
            ? t9('addSection.failedUpdate', lang)
            : t9('addSection.failedAdd', lang)
        ))
      }

      resetForm()
      setEditLesson(null)
      onSaved()
      handleClose(false)
    } catch (submissionError) {
      setError(submissionError instanceof Error
        ? submissionError.message
        : t9('error.unexpected', lang))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className='flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[560px]'>
        <div className='flex shrink-0 items-center justify-between border-b border-border/60 px-6 py-3'>
          <DialogHeader className='p-0'>
            <DialogTitle className='flex items-center gap-2 text-lg font-semibold'>
              {isEditMode ? <Pencil className='size-4 text-slate-500' /> : <FileText className='size-4 text-slate-500' />}
              {isEditMode ? t9('addSection.editTitle', lang) : t9('addSection.title', lang)}
            </DialogTitle>
          </DialogHeader>
          <button
            type='button'
            aria-label={t9('addSection.cancel', lang)}
            onClick={() => handleClose(false)}
            className='rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
          >
            <X className='size-4' />
          </button>
        </div>

        <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='section-name'>{t9('addSection.sectionNameRequired', lang)}</Label>
            <Input
              id='section-name'
              required
              value={sectionName}
              onChange={(event) => {
                setSectionName(event.target.value)
                setError(null)
              }}
              placeholder={t9('addSection.sectionPlaceholder', lang)}
              maxLength={160}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='section-description'>{t9('addSection.descriptionRequiredLabel', lang)}</Label>
            <textarea
              id='section-description'
              required
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
                setError(null)
              }}
              placeholder={t9('addSection.descriptionPlaceholder', lang)}
              maxLength={1000}
              rows={3}
              className='flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
            />
            <p className='text-right text-[11px] text-muted-foreground'>{description.length} / 1000</p>
          </div>

          <div className='space-y-2'>
            <Label>{t9('addSection.pptSlides', lang)}</Label>
            <div
              role='button'
              tabIndex={0}
              onClick={() => presentationInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') presentationInputRef.current?.click()
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                selectPresentations(Array.from(event.dataTransfer.files ?? []))
              }}
              className='flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-3 text-center transition-colors hover:border-slate-400 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'
            >
              <Upload className='mb-1 size-6 text-muted-foreground' />
              <p className='text-sm font-medium'>
                {isEditMode
                  ? t9('addSection.clickUploadNewPpt', lang)
                  : t9('addSection.clickUploadPpt', lang)}
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {t9('addSection.pptInfoOptional', lang)}
              </p>
            </div>
            <input
              ref={presentationInputRef}
              type='file'
              multiple
              accept='.pdf,.ppt,.pptx'
              className='hidden'
              onChange={(event) => selectPresentations(Array.from(event.target.files ?? []))}
            />
            {presentations.length > 0 && (
              <div className='space-y-2 rounded-lg border border-border/60 bg-white p-2'>
                <p className='px-1 text-xs font-medium text-muted-foreground'>
                  {presentations.length} / {MAX_PRESENTATIONS_PER_LESSON} {t9('addSection.presentationFiles', lang)}
                </p>
                {presentations.map((presentation) => (
                  <div key={presentation.key} className='flex items-center gap-3 rounded-md bg-muted/30 px-3 py-1.5'>
                    <FileDown className='size-4 shrink-0 text-emerald-600' />
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium'>{presentation.fileName}</p>
                      <p className='text-[11px] text-muted-foreground'>
                        {presentation.file
                          ? `${(presentation.file.size / 1024 / 1024).toFixed(1)} MB`
                          : t9('addSection.existingPresentation', lang)}
                      </p>
                    </div>
                    <button
                      type='button'
                      aria-label={`${t9('addSection.removePresentation', lang)}: ${presentation.fileName}`}
                      onClick={() => removePresentation(presentation.key)}
                      className='rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600'
                    >
                      <X className='size-4' />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className='text-xs text-muted-foreground'>
              {isEditMode
                ? t9('addSection.editUploadHint', lang)
                : t9('addSection.uploadHint', lang)}
            </p>
          </div>

          {error && (
            <div role='alert' className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600'>
              {error}
            </div>
          )}
        </div>

        <div className='flex shrink-0 justify-end gap-2 border-t border-border/60 bg-muted/20 px-6 py-3'>
          <Button type='button' variant='outline' onClick={() => handleClose(false)} disabled={loading}>
            {t9('addSection.cancel', lang)}
          </Button>
          <Button type='button' onClick={handleSubmit} disabled={loading || !sectionName.trim() || !description.trim() || presentations.length === 0} className='bg-slate-900 text-white hover:bg-slate-800'>
            {loading ? <Loader2 className='size-4 animate-spin' /> : null}
            {loading
              ? t9('addSection.saving', lang)
              : isEditMode
                ? t9('addSection.saveChanges', lang)
                : t9('addSection.addSection', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
