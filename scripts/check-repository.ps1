[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$requiredFiles = @(
    '.gitattributes'
    'AGENTS.md'
    'README.md'
    'docs/architecture/README.md'
    'principles/README.md'
)

$missingFiles = $requiredFiles | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) }
if ($missingFiles) {
    throw "Missing required repository files: $($missingFiles -join ', ')"
}

$lineEndings = & git ls-files --eol
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to inspect tracked file line endings.'
}

$nonLfText = $lineEndings | Where-Object { $_ -match '^i/(crlf|mixed)' }
if ($nonLfText) {
    throw "Tracked text is not LF-normalized:`n$($nonLfText -join "`n")"
}

Write-Host 'Repository invariants passed.'
