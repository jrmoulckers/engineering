param(
    [string]$Root = "principles"
)

$ErrorActionPreference = "Stop"
$requiredFields = @(
    "ID",
    "Status",
    "Statement",
    "Rationale",
    "Evidence",
    "Owner and ratification",
    "Handoff",
    "Legacy inputs"
)
$legacyIdPattern = (
    "architecture:(?:[1-9]|1[0-5])|" +
    "frontend:[1-9]|" +
    "backend:[1-7]|" +
    "middleware:[1-7]|" +
    "data-analytics:[1-7]|" +
    "local-first:[1-4]|" +
    "security:[1-8]|" +
    "performance:[1-9]|" +
    "testing:(?:[1-9]|10)"
)
$legacyListPattern = (
    '^`studio-legacy:(?:' + $legacyIdPattern + ')`' +
    '(?:, `studio-legacy:(?:' + $legacyIdPattern + ')`)*$'
)
$seenIds = @{}
$errors = [System.Collections.Generic.List[string]]::new()

function Test-Principle {
    param(
        [System.IO.FileInfo]$File,
        [int]$LineNumber,
        [hashtable]$Values
    )

    $location = "$($File.FullName):$LineNumber"
    foreach ($field in $requiredFields) {
        if (-not $Values.ContainsKey($field) -or -not $Values[$field]) {
            $errors.Add("${location}: missing or empty '$field'")
        }
    }

    $principleId = $Values["ID"]
    if ($principleId) {
        if ($principleId -notmatch "^ENG-[A-Z]+-\d{3}$") {
            $errors.Add("${location}: invalid ID '$principleId'")
        }
        elseif ($seenIds.ContainsKey($principleId)) {
            $errors.Add(
                "${location}: duplicate ID '$principleId' " +
                "(also in $($seenIds[$principleId]))"
            )
        }
        else {
            $seenIds[$principleId] = $location
        }
    }

    if ($Values["Status"] -and $Values["Status"] -ne "Draft") {
        $errors.Add("${location}: status must be 'Draft'")
    }

    $legacyInputs = $Values["Legacy inputs"]
    if (
        $legacyInputs -and
        $legacyInputs -ne "none" -and
        $legacyInputs -notmatch $legacyListPattern
    ) {
        $errors.Add("${location}: legacy inputs must use exact top-level baseline IDs")
    }
}

if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    [Console]::Error.WriteLine("Principle root does not exist: $Root")
    exit 1
}

$files = Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "*.md" |
    Where-Object Name -ne "README.md" |
    Sort-Object FullName

foreach ($file in $files) {
    $values = $null
    $startLine = 0
    $lineNumber = 0
    $principleCount = 0

    foreach ($line in Get-Content -LiteralPath $file.FullName -Encoding UTF8) {
        $lineNumber++
        if ($line -match "^- ID:\s*(.*)$") {
            if ($null -ne $values) {
                Test-Principle -File $file -LineNumber $startLine -Values $values
            }
            $values = @{ "ID" = $Matches[1].Trim() }
            $startLine = $lineNumber
            $principleCount++
        }
        elseif ($null -ne $values -and $line -match "^- ([^:]+):\s*(.*)$") {
            $field = $Matches[1]
            if ($values.ContainsKey($field)) {
                $errors.Add(
                    "$($file.FullName):$lineNumber`: duplicate metadata field '$field'"
                )
            }
            else {
                $values[$field] = $Matches[2].Trim()
            }
        }
    }

    if ($null -ne $values) {
        Test-Principle -File $file -LineNumber $startLine -Values $values
    }
    if ($principleCount -eq 0) {
        $errors.Add("$($file.FullName): contains no principle metadata")
    }
}

if ($errors.Count -gt 0) {
    foreach ($message in $errors) {
        [Console]::Error.WriteLine($message)
    }
    exit 1
}

Write-Output "Validated $($seenIds.Count) Draft principle IDs in $Root"
