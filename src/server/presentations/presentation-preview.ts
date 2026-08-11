import { spawn } from 'node:child_process'
import { access, rename } from 'node:fs/promises'
import { dirname, extname, join, parse, resolve, sep } from 'node:path'

const UPLOAD_ROUTE_PREFIX = '/uploads/'
const CONVERSION_TIMEOUT_MS = 120_000

function resolveUploadFile(publicFilePath: string) {
  if (!publicFilePath.startsWith(UPLOAD_ROUTE_PREFIX)) {
    throw new Error('Presentation path is outside the uploads directory.')
  }

  const uploadDirectory = resolve(process.cwd(), 'uploads')
  const absoluteFilePath = resolve(uploadDirectory, publicFilePath.slice(UPLOAD_ROUTE_PREFIX.length))
  if (!absoluteFilePath.startsWith(`${uploadDirectory}${sep}`)) {
    throw new Error('Presentation path is outside the uploads directory.')
  }
  return absoluteFilePath
}

function runProcess(executable: string, args: string[]) {
  return new Promise<void>((resolveProcess, rejectProcess) => {
    const childProcess = spawn(executable, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let errorOutput = ''
    const timeout = setTimeout(() => {
      childProcess.kill()
      rejectProcess(new Error('Presentation conversion timed out.'))
    }, CONVERSION_TIMEOUT_MS)

    childProcess.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString()
    })
    childProcess.on('error', (error) => {
      clearTimeout(timeout)
      rejectProcess(error)
    })
    childProcess.on('close', (exitCode) => {
      clearTimeout(timeout)
      if (exitCode === 0) resolveProcess()
      else rejectProcess(new Error(errorOutput.trim() || `Converter exited with code ${exitCode}.`))
    })
  })
}

async function firstAccessiblePath(paths: string[]) {
  for (const candidatePath of paths) {
    try {
      await access(candidatePath)
      return candidatePath
    } catch {
      // Try the next configured installation path.
    }
  }
  return null
}

async function convertWithLibreOffice(sourcePath: string, destinationPath: string) {
  const libreOfficePath = await firstAccessiblePath([
    process.env.LIBREOFFICE_PATH ?? '',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ].filter(Boolean))
  if (!libreOfficePath) return false

  const sourceDetails = parse(sourcePath)
  const temporaryPdfPath = join(dirname(sourcePath), `${sourceDetails.name}.pdf`)
  await runProcess(libreOfficePath, [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    dirname(sourcePath),
    sourcePath,
  ])
  if (temporaryPdfPath !== destinationPath) {
    await rename(temporaryPdfPath, destinationPath)
  }
  return true
}

async function convertWithPowerPoint(sourcePath: string, destinationPath: string) {
  if (process.platform !== 'win32') return false
  const powerPointPath = await firstAccessiblePath([
    'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
    'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
  ])
  if (!powerPointPath) return false

  const conversionScriptPath = resolve(process.cwd(), 'scripts', 'convert-presentation.ps1')
  await runProcess('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    conversionScriptPath,
    '-SourcePath',
    sourcePath,
    '-DestinationPath',
    destinationPath,
  ])
  return true
}

export function getExpectedPresentationPreviewPath(filePath: string) {
  if (extname(filePath).toLowerCase() === '.pdf') return filePath
  return filePath.replace(/\.(ppt|pptx)$/i, '.preview.pdf')
}

let conversionQueue: Promise<unknown> = Promise.resolve()

/** Converts one uploaded PPT/PPTX at a time because desktop converters are not concurrency-safe. */
export async function ensurePresentationPreview(filePath: string, previewPath?: string | null) {
  const sourceExtension = extname(filePath).toLowerCase()
  if (sourceExtension === '.pdf') return filePath
  if (!['.ppt', '.pptx'].includes(sourceExtension)) {
    throw new Error('Unsupported presentation format.')
  }

  const resolvedPreviewPath = previewPath || getExpectedPresentationPreviewPath(filePath)
  const destinationPath = resolveUploadFile(resolvedPreviewPath)
  try {
    await access(destinationPath)
    return resolvedPreviewPath
  } catch {
    // Convert the original presentation below.
  }

  const conversionTask = conversionQueue.then(async () => {
    try {
      await access(destinationPath)
      return
    } catch {
      // Another request has not generated the preview yet.
    }

    const sourcePath = resolveUploadFile(filePath)
    const convertedByLibreOffice = await convertWithLibreOffice(sourcePath, destinationPath)
    if (!convertedByLibreOffice) {
      const convertedByPowerPoint = await convertWithPowerPoint(sourcePath, destinationPath)
      if (!convertedByPowerPoint) {
        throw new Error('Install LibreOffice or Microsoft PowerPoint to convert PPT/PPTX previews.')
      }
    }
    await access(destinationPath)
  })
  conversionQueue = conversionTask.catch(() => undefined)
  await conversionTask
  return resolvedPreviewPath
}

export function getAbsoluteUploadPath(publicFilePath: string) {
  return resolveUploadFile(publicFilePath)
}
