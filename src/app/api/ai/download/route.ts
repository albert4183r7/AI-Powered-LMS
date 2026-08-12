import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }

    // Ensure the AI_SERVICE_BASE_URL is available
    const baseUrl = process.env.AI_SERVICE_BASE_URL
    if (!baseUrl) {
      return NextResponse.json({ error: 'AI_SERVICE_BASE_URL is not configured' }, { status: 500 })
    }

    // Construct the absolute URL to the AI service
    // filePath is expected to be something like "/uploads/filename.pptx"
    const targetUrl = `${baseUrl.replace(/\/$/, '')}${filePath.startsWith('/') ? '' : '/'}${filePath}`

    // Fetch the file from the AI service
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        // Pass any necessary headers if authentication is required between services
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch file from AI service: ${response.status} ${response.statusText}`)
      return NextResponse.json({ error: 'File not found or unavailable' }, { status: response.status })
    }

    // Forward the file stream to the client
    const headers = new Headers(response.headers)
    
    // Ensure we suggest a filename for download if one isn't provided
    if (!headers.has('Content-Disposition')) {
      const fileName = filePath.split('/').pop() || 'downloaded-file'
      headers.set('Content-Disposition', `attachment; filename="${fileName}"`)
    }

    return new NextResponse(response.body, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Error proxying AI download:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
