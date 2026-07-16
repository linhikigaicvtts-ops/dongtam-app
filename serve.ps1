$root = Split-Path $MyInvocation.MyCommand.Path
$port = if ($env:PORT) { [int]$env:PORT } else { 3456 }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Output "Serving on http://localhost:$port"
$mimeTypes = @{
  '.html'=  'text/html; charset=utf-8'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.json' = 'application/json'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $path = $req.Url.LocalPath -replace '/','\'
  if ($path -eq '\') { $path = '\index.html' }
  $file = Join-Path $root $path.TrimStart('\')
  if (Test-Path $file -PathType Leaf) {
    $ext = [IO.Path]::GetExtension($file)
    $mime = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
    $res.ContentType = $mime
    $bytes = [IO.File]::ReadAllBytes($file)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
  }
  $res.Close()
}
