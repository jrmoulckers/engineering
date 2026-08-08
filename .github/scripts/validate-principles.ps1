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
$seenIds = @{}
$errors = [System.Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    [Console]::Error.WriteLine("Principle root does not exist: $Root")
    exit 1
}

$files = Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "*.md" |
    Where-Object Name -ne "README.md" |
    Sort-Object FullName

foreach ($file in $files) {
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $file.FullName -Encoding UTF8) {
        if ($line -match "^- ([^:]+):\s*(.*)$") {
            $values[$Matches[1]] = $Matches[2].Trim()
        }
    }

    foreach ($field in $requiredFields) {
        if (-not $values.ContainsKey($field) -or -not $values[$field]) {
            $errors.Add("$($file.FullName): missing or empty '$field'")
        }
    }

    $principleId = $values["ID"]
    if ($principleId) {
        if ($principleId -notmatch "^ENG-[A-Z]+-\d{3}$") {
            $errors.Add("$($file.FullName): invalid ID '$principleId'")
        }
        elseif ($seenIds.ContainsKey($principleId)) {
            $errors.Add(
                "$($file.FullName): duplicate ID '$principleId' " +
                "(also in $($seenIds[$principleId]))"
            )
        }
        else {
            $seenIds[$principleId] = $file.FullName
        }
    }

    if ($values["Status"] -and $values["Status"] -ne "Draft") {
        $errors.Add("$($file.FullName): status must be 'Draft'")
    }
}

if ($errors.Count -gt 0) {
    foreach ($message in $errors) {
        [Console]::Error.WriteLine($message)
    }
    exit 1
}

Write-Output "Validated Draft principle metadata in $Root"
