param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,
  [Parameter(Mandatory = $true)]
  [string]$DestinationPath
)

$resolvedSourcePath = [System.IO.Path]::GetFullPath($SourcePath)
$resolvedDestinationPath = [System.IO.Path]::GetFullPath($DestinationPath)
$powerPoint = $null
$presentation = $null

try {
  # Disable macros before opening an instructor-provided presentation.
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $powerPoint.AutomationSecurity = 3
  try {
    $presentation = $powerPoint.Presentations.Open(
      $resolvedSourcePath,
      $true,
      $true,
      $false
    )
  } catch {
    # Open XML files that need PowerPoint's safe repair pass.
    $presentation = $powerPoint.Presentations.Open2007(
      $resolvedSourcePath,
      -1,
      -1,
      0,
      -1
    )
  }
  # 32 is PowerPoint's ppSaveAsPDF format.
  $presentation.SaveAs($resolvedDestinationPath, 32)
} finally {
  if ($presentation) {
    $presentation.Close()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
  }
  if ($powerPoint) {
    $powerPoint.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
  }
}
