param(
  [int]$Port = 4173,
  [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$rootPath = [System.IO.Path]::GetFullPath($Root)
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")

$mimeTypes = @{
  ".css"  = "text/css; charset=utf-8"
  ".gif"  = "image/gif"
  ".html" = "text/html; charset=utf-8"
  ".ico"  = "image/x-icon"
  ".jpeg" = "image/jpeg"
  ".jpg"  = "image/jpeg"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".mjs"  = "application/javascript; charset=utf-8"
  ".png"  = "image/png"
  ".svg"  = "image/svg+xml"
  ".txt"  = "text/plain; charset=utf-8"
  ".webp" = "image/webp"
}

function Send-TextResponse {
  param(
    [Parameter(Mandatory = $true)]$Response,
    [int]$StatusCode,
    [string]$Body
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = "text/plain; charset=utf-8"
  $Response.ContentLength64 = $bytes.LongLength
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

$listener.Start()

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response

    try {
      $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $relativePath = "index.html"
      }

      $relativePath = $relativePath -replace "/", "\"
      $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $rootPath $relativePath))

      if (-not $candidatePath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-TextResponse -Response $response -StatusCode 403 -Body "Forbidden"
        continue
      }

      if ((Test-Path $candidatePath) -and (Get-Item $candidatePath).PSIsContainer) {
        $candidatePath = Join-Path $candidatePath "index.html"
      }

      if (-not (Test-Path $candidatePath -PathType Leaf)) {
        Send-TextResponse -Response $response -StatusCode 404 -Body "Not Found"
        continue
      }

      $extension = [System.IO.Path]::GetExtension($candidatePath).ToLowerInvariant()
      $contentType = $mimeTypes[$extension]
      if (-not $contentType) {
        $contentType = "application/octet-stream"
      }

      $bytes = [System.IO.File]::ReadAllBytes($candidatePath)
      $response.StatusCode = 200
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.LongLength
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      Send-TextResponse -Response $response -StatusCode 500 -Body $_.Exception.Message
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
