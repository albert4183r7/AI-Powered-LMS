'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { t9, type Lang } from '@/lib/i18n'

interface PdfSlideDeckProps {
  presentationId: string
  fileName: string
  lang: Lang
}

function PdfSlidePage({ pdfDocument, pageNumber, fileName }: {
  pdfDocument: PDFDocumentProxy
  pageNumber: number
  fileName: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let renderTask: { cancel: () => void } | null = null

    async function renderPage() {
      const canvas = canvasRef.current
      if (!canvas) return
      const page = await pdfDocument.getPage(pageNumber)
      if (cancelled) return

      const viewport = page.getViewport({ scale: 1.6 })
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewport.width * pixelRatio)
      canvas.height = Math.floor(viewport.height * pixelRatio)
      canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`

      const canvasContext = canvas.getContext('2d')
      if (!canvasContext) return
      const task = page.render({
        canvas,
        canvasContext,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      })
      renderTask = task
      await task.promise
    }

    void renderPage()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [fileName, pageNumber, pdfDocument])

  return (
    <figure className='overflow-hidden rounded-lg border border-slate-700 bg-white shadow-xl'>
      <canvas ref={canvasRef} aria-label={`${fileName}, slide ${pageNumber}`} className='block h-auto w-full bg-white' />
      <figcaption className='bg-slate-900 px-3 py-1.5 text-center text-[10px] text-slate-400'>
        {pageNumber} / {pdfDocument.numPages}
      </figcaption>
    </figure>
  )
}

export function PdfSlideDeck({ presentationId, fileName, lang }: PdfSlideDeckProps) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null
    let documentToCleanUp: PDFDocumentProxy | null = null

    async function loadPresentation() {
      setPdfDocument(null)
      setCurrentPage(1)
      setError('')
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        loadingTask = pdfjs.getDocument({ url: `/api/presentations/${presentationId}/preview` })
        const loadedDocument = await loadingTask.promise
        documentToCleanUp = loadedDocument
        if (!cancelled) setPdfDocument(loadedDocument)
      } catch {
        if (!cancelled) setError(t9('classroom.previewFailed', lang))
      }
    }

    void loadPresentation()
    return () => {
      cancelled = true
      void documentToCleanUp?.cleanup()
      void loadingTask?.destroy()
    }
  }, [lang, presentationId])

  if (error) {
    return (
      <div role='alert' className='flex items-start gap-3 rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200'>
        <AlertCircle className='mt-0.5 size-4 shrink-0' />
        <div><p className='font-medium'>{error}</p><p className='mt-1 text-xs text-red-300/80'>{fileName}</p></div>
      </div>
    )
  }

  if (!pdfDocument) {
    return <div className='flex min-h-40 items-center justify-center gap-2 text-sm text-slate-400'><Loader2 className='size-4 animate-spin' />{t9('classroom.preparingSlides', lang)}</div>
  }

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <div className='mb-3 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2'>
        <button
          type='button'
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={currentPage === 1}
          aria-label='Previous slide'
          className='flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'
        >
          <ChevronLeft className='size-4' />
          <span className='hidden sm:inline'>{t9('classroom.previousSlide', lang)}</span>
        </button>
        <span className='text-xs tabular-nums text-slate-400'>
          {currentPage} / {pdfDocument.numPages}
        </span>
        <button
          type='button'
          onClick={() => setCurrentPage((page) => Math.min(pdfDocument.numPages, page + 1))}
          disabled={currentPage === pdfDocument.numPages}
          aria-label='Next slide'
          className='flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'
        >
          <span className='hidden sm:inline'>{t9('classroom.nextSlide', lang)}</span>
          <ChevronRight className='size-4' />
        </button>
      </div>

      <div className='overflow-hidden rounded-lg' aria-live='polite'>
        <div
          className='flex items-start transition-transform duration-300 ease-out'
          style={{ transform: `translateX(-${(currentPage - 1) * 100}%)` }}
        >
          {Array.from({ length: pdfDocument.numPages }, (_, index) => (
            <div key={index + 1} className='min-w-full' aria-hidden={currentPage !== index + 1}>
              <PdfSlidePage pdfDocument={pdfDocument} pageNumber={index + 1} fileName={fileName} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
