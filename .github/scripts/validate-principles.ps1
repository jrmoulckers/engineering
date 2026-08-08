param(
    [string]$Root = "principles",
    [switch]$RequireCatalog
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
$imperativeVerbPattern = (
    "Access|Add|Bind|Bound|Budget|Build|Choose|Classify|Convert|Correlate|" +
    "Declare|Define|Derive|Detect|Distinguish|Document|Emit|Encode|Enforce|" +
    "Expose|Fail|Give|Identify|" +
    "Keep|Make|Measure|Minimize|Observe|Parse|Prefer|Profile|Propagate|Publish|" +
    "Preserve|Produce|Put|Record|Redact|Reject|Reproduce|Require|Resolve|Run|" +
    "Separate|Source|Start|Test|Treat|Use|Validate|Version|Verify"
)
$ratificationPattern = (
    "^Engineering owns this Draft's .+; " +
    "only the repository owner may change it to Ratified\.$"
)
$handoffPattern = (
    "(?:" +
    "(?:Product|Studio|[\x60]?jrmoulckers/\.github[\x60]?)(?: alone)? " +
    "(?:owns|defines|sets|selects|decides|supplies|prioritizes|names|" +
    "identifies|accepts|retains|implements|runs|executes)|" +
    "(?:Reference|reference) " +
    "(?:Product|Studio|[\x60]?jrmoulckers/\.github[\x60]?)" +
    ")"
)
$expectedPrefixes = @{
    "architecture/boundaries-and-contracts.md" = "ARCH"
    "platforms/api-backend.md" = "API"
    "platforms/browser-frontend.md" = "WEB"
    "platforms/data-systems.md" = "DATA"
    "platforms/integration-boundaries.md" = "INT"
    "platforms/local-first.md" = "LOCAL"
    "assurance/security-and-privacy.md" = "SEC"
    "assurance/testing.md" = "TEST"
    "assurance/performance.md" = "PERF"
    "operations/observability.md" = "OBS"
    "operations/build-and-release.md" = "BUILD"
}
$expectedCounts = @{
    "architecture/boundaries-and-contracts.md" = 4
    "platforms/api-backend.md" = 4
    "platforms/browser-frontend.md" = 4
    "platforms/data-systems.md" = 3
    "platforms/integration-boundaries.md" = 5
    "platforms/local-first.md" = 4
    "assurance/security-and-privacy.md" = 8
    "assurance/testing.md" = 10
    "assurance/performance.md" = 9
    "operations/observability.md" = 7
    "operations/build-and-release.md" = 8
}
$authorityCollisionPattern = (
    "Engineering (?:owns|defines|sets|accepts|decides) [^.;]*" +
    "(?:outcomes?|obligations?|risk acceptance|release (?:approval|decision|" +
    "timing|readiness)|go/no-go|metrics?|compliance policy|legal basis|" +
    "retention policy|residency policy|UI|accessibility|visual|" +
    "design tokens?|GitHub Actions|repository governance|" +
    "workflow automation|distribution)"
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
    "testing:(?:[1-9]|10)|" +
    "devops:(?:[1-9]|1[0-5])|" +
    "process:[1-6]|" +
    "compliance:[1-8]"
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
        [string]$ExpectedPrefix,
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
        if ($principleId -cnotmatch "^ENG-[A-Z]+-\d{3}$") {
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
        if (
            $ExpectedPrefix -and
            $principleId -cnotmatch "^ENG-$ExpectedPrefix-\d{3}$"
        ) {
            $errors.Add(
                "${location}: ID '$principleId' does not match " +
                "the file's ENG-$ExpectedPrefix namespace"
            )
        }
    }

    if ($Values["Status"] -and $Values["Status"] -cne "Draft") {
        $errors.Add("${location}: status must be 'Draft'")
    }

    $statement = $Values["Statement"]
    if ($statement -and $statement -cnotmatch "^(?:$imperativeVerbPattern)\b") {
        $errors.Add("${location}: statement must begin with an imperative verb")
    }

    $owner = $Values["Owner and ratification"]
    if ($owner -and $owner -cnotmatch $ratificationPattern) {
        $errors.Add("${location}: owner and ratification must reserve Ratification to the repository owner")
    }

    $handoff = $Values["Handoff"]
    if ($handoff -and $handoff -cnotmatch $handoffPattern) {
        $errors.Add("${location}: handoff must assign or reference external authority")
    }
    if ($handoff -and $handoff -cmatch $authorityCollisionPattern) {
        $errors.Add("${location}: handoff assigns reserved external authority to Engineering")
    }

    $legacyInputs = $Values["Legacy inputs"]
    if (
        $legacyInputs -and
        $legacyInputs -cne "none" -and
        $legacyInputs -cnotmatch $legacyListPattern
    ) {
        $errors.Add("${location}: legacy inputs must use exact top-level baseline IDs")
    }
}

if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    [Console]::Error.WriteLine("Principle root does not exist: $Root")
    exit 1
}

$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
$canonicalRoot = (Resolve-Path -LiteralPath (
    Join-Path $PSScriptRoot "../../principles"
)).Path
$validateCatalog = $RequireCatalog -or $resolvedRoot -ceq $canonicalRoot

$files = Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "*.md" |
    Where-Object Name -ne "README.md" |
    Sort-Object FullName

foreach ($file in $files) {
    $relativePath = [System.IO.Path]::GetRelativePath(
        $resolvedRoot,
        $file.FullName
    ).Replace("\", "/")
    $knownPath = @(
        $expectedPrefixes.Keys | Where-Object { $_ -ceq $relativePath }
    )
    if ($knownPath.Count -eq 0) {
        $errors.Add("$($file.FullName): unrecognized principle path '$relativePath'")
        $expectedPrefix = $null
    }
    else {
        $expectedPrefix = $expectedPrefixes[$knownPath[0]]
    }
    $values = $null
    $startLine = 0
    $lineNumber = 0
    $principleCount = 0

    foreach ($line in Get-Content -LiteralPath $file.FullName -Encoding UTF8) {
        $lineNumber++
        if ($line -match "^- ID:\s*(.*)$") {
            if ($null -ne $values) {
                Test-Principle -File $file -ExpectedPrefix $expectedPrefix -LineNumber $startLine -Values $values
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
        Test-Principle -File $file -ExpectedPrefix $expectedPrefix -LineNumber $startLine -Values $values
    }
    if ($principleCount -eq 0) {
        $errors.Add("$($file.FullName): contains no principle metadata")
    }
}

if ($validateCatalog) {
    $expectedIds = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::Ordinal
    )
    foreach ($path in $expectedPrefixes.Keys) {
        $prefix = $expectedPrefixes[$path]
        foreach ($number in 1..$expectedCounts[$path]) {
            [void]$expectedIds.Add("ENG-$prefix-$($number.ToString('000'))")
        }
    }
    foreach ($expectedId in $expectedIds) {
        if (-not $seenIds.ContainsKey($expectedId)) {
            $errors.Add("${resolvedRoot}: missing expected principle ID '$expectedId'")
        }
    }
    foreach ($actualId in $seenIds.Keys) {
        if (-not $expectedIds.Contains($actualId)) {
            $errors.Add("${resolvedRoot}: unexpected principle ID '$actualId'")
        }
    }
}

if ($errors.Count -gt 0) {
    foreach ($message in $errors) {
        [Console]::Error.WriteLine($message)
    }
    exit 1
}

Write-Output "Validated $($seenIds.Count) Draft principle IDs in $Root"
