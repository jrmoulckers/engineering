param(
    [string]$Root = "principles",
    [switch]$RequireCatalog,
    [string]$DecisionRecord,
    [string]$BaselineRef
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
    "^Engineering owns this Draft's " +
    "(?![^;]*(?i:ratif|change it to Ratified))[^;]+; " +
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
$expectedSemanticHashes = @{
    "architecture/boundaries-and-contracts.md" = "af80268d92e1428eb29ff7b2406cb5d79074164c6d0b45a5be19e0b21c12801b"
    "assurance/performance.md" = "592a709d22ae4ddf96464ad41521fd83dc807c930029aa36dd6210a24edbdef0"
    "assurance/security-and-privacy.md" = "b3cc12e545edf2227baa3d01c3050d82a07b480475dd8df5ee4bcfc0f5743318"
    "assurance/testing.md" = "23efc72776ee4a4b4ae34848b2308673e05318744eec7a0dfcedc19c8d44cb46"
    "operations/build-and-release.md" = "ce4ac5f3798639e10f11c833a6b2a5bad1edc1ce9e1eda9bd2ec63e42bd2a6a6"
    "operations/observability.md" = "bc2b165d1d98234066d007cdb6921891327a4e88695e2836d8e2745ea24cd584"
    "platforms/api-backend.md" = "42696bb9bc2e2d173123f0523962b665d75c10569cab5cad3f42a6e24b1dce4f"
    "platforms/browser-frontend.md" = "778e6aa8f32ab4b6b835be156b10aeca180712805a66f0c47ae947cc1581f241"
    "platforms/data-systems.md" = "520ed02504ef4964fe66633337c086670065da0c1e75d7e9c493b182ae4f305a"
    "platforms/integration-boundaries.md" = "e3cf7f69f6fc63d0c710f916663526314999af7502d2aeac077d9250920f93eb"
    "platforms/local-first.md" = "c952227365d0b02fbc970194d7c7c2d0eba037374a4f1aafdf7a04c700c92a96"
}
$expectedDecisionFields = @{
    "Decision state" = "Effective only when this pull request is merged by the repository owner."
    "Catalog" = '`ENG-ARCH-001` through `ENG-ARCH-004`; `ENG-WEB-001` through `ENG-WEB-004`; `ENG-API-001` through `ENG-API-004`; `ENG-DATA-001` through `ENG-DATA-003`; `ENG-INT-001` through `ENG-INT-005`; `ENG-LOCAL-001` through `ENG-LOCAL-004`; `ENG-SEC-001` through `ENG-SEC-008`; `ENG-TEST-001` through `ENG-TEST-010`; `ENG-PERF-001` through `ENG-PERF-009`; `ENG-OBS-001` through `ENG-OBS-007`; `ENG-BUILD-001` through `ENG-BUILD-008` (66 total: 24 architecture/platform and 42 assurance/operations).'
    "Source proposals" = '[PR #3](https://github.com/jrmoulckers/engineering/pull/3) and [PR #4](https://github.com/jrmoulckers/engineering/pull/4).'
    "Final review evidence" = 'PR #3 final head `580e0e23e145ae06167b64b3a318c1526b1856ed` passed [hosted validation](https://github.com/jrmoulckers/engineering/actions/runs/31234605193/job/93044720509); PR #4 final head `b3ea073e461f666387cc5df449151055526c6bfc` passed [hosted validation](https://github.com/jrmoulckers/engineering/actions/runs/31278101246/job/93154865512).'
    "Content changes" = "None; only the 66 Status fields change from Draft to Ratified."
    "Ownership changes" = "None; owner and Ratification wording, authority handoffs, and Legacy inputs remain unchanged."
    "Approval" = "Repository-owner merge of this pull request is the effective approval; opening or reviewing it does not approve or Ratify the catalog."
}
$expectedDecisionHash = "9b542dbb36f771d9ea5da38d8a42e685683492dbdafb9556f3e75c002ff90552"
$authorityCollisionPattern = (
    "Engineering (?:owns|defines|sets|accepts|decides|implements|runs|" +
    "executes|governs|approves|controls|configures) [^.;]*" +
    "(?:outcomes?|obligations?|risk acceptance|release (?:approval|decision|" +
    "timing|readiness)|ship decision|go/no-go|metrics?|analytics|" +
    "compliance policy|legal basis|" +
    "retention policy|residency policy|UI|accessibility|visual|" +
    "design tokens?|GitHub Actions|repository governance|" +
    "scanners?|workflow permissions?|(?:GitHub|repository|workflow) automation|" +
    "provenance generation|distribution)"
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
    "process:[1-7]|" +
    "compliance:[1-8]"
)
$legacyListPattern = (
    '^`studio-legacy:(?:' + $legacyIdPattern + ')`' +
    '(?:, `studio-legacy:(?:' + $legacyIdPattern + ')`)*$'
)
$seenIds = @{}
$errors = [System.Collections.Generic.List[string]]::new()
$ratifiedCount = 0

function Get-NormalizedHash {
    param([string[]]$Lines)

    $content = [string]::Join("`n", $Lines) + "`n"
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        $hashBytes = $sha256.ComputeHash($bytes)
        return (
            [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
        )
    }
    finally {
        $sha256.Dispose()
    }
}

function Get-SemanticHash {
    param([System.IO.FileInfo]$File)

    $semanticLines = @(
        Get-Content -LiteralPath $File.FullName -Encoding UTF8 |
            Where-Object { $_ -cnotmatch "^- Status:" }
    )
    return Get-NormalizedHash -Lines $semanticLines
}

function Test-RatificationDecision {
    param([string]$Path)

    if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        $errors.Add(
            "${resolvedRoot}: Ratified catalog requires matching Ratification decision record"
        )
        return $false
    }

    $fields = @{}
    $lineNumber = 0
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $lineNumber++
        if ($line -match "^- ([^:]+):\s*(.*)$") {
            $field = $Matches[1]
            if ($fields.ContainsKey($field)) {
                $errors.Add("${Path}:$lineNumber`: duplicate decision field '$field'")
            }
            else {
                $fields[$field] = $Matches[2].Trim()
            }
        }
    }

    $valid = $true
    foreach ($field in $expectedDecisionFields.Keys) {
        if (-not $fields.ContainsKey($field)) {
            $errors.Add("${Path}: missing Ratification decision field '$field'")
            $valid = $false
        }
        elseif ($fields[$field] -cne $expectedDecisionFields[$field]) {
            if ($field -ceq "Decision state") {
                $errors.Add(
                    "${Path}: Ratification decision must remain conditional on repository-owner merge"
                )
            }
            elseif ($field -ceq "Approval") {
                $errors.Add(
                    "${Path}: Ratification decision must reserve effective approval to repository-owner merge"
                )
            }
            else {
                $errors.Add(
                    "${Path}: Ratification decision field '$field' does not match the exact catalog manifest"
                )
            }
            $valid = $false
        }
    }
    foreach ($field in $fields.Keys) {
        if (-not $expectedDecisionFields.ContainsKey($field)) {
            $errors.Add("${Path}: unexpected Ratification decision field '$field'")
            $valid = $false
        }
    }
    if ($valid) {
        $decisionHash = Get-NormalizedHash -Lines @(
            Get-Content -LiteralPath $Path -Encoding UTF8
        )
        if ($decisionHash -cne $expectedDecisionHash) {
            $errors.Add(
                "${Path}: Ratification decision record does not match the exact Ratification manifest"
            )
            $valid = $false
        }
    }
    return $valid
}

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
        $validId = $principleId -cmatch "^ENG-[A-Z]+-\d{3}$"
        if (-not $validId) {
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
            $validId -and
            $ExpectedPrefix -and
            $principleId -cnotmatch "^ENG-$ExpectedPrefix-\d{3}$"
        ) {
            $errors.Add(
                "${location}: ID '$principleId' does not match " +
                "the file's ENG-$ExpectedPrefix namespace"
            )
        }
    }

    $status = $Values["Status"]
    if ($status -ceq "Ratified") {
        $script:ratifiedCount++
    }
    if ($status -and $validateCatalog -and $status -cne "Ratified") {
        $errors.Add("${location}: catalog status must be 'Ratified'")
    }
    elseif (
        $status -and
        -not $validateCatalog -and
        $status -cne "Draft" -and
        $status -cne "Ratified"
    ) {
        $errors.Add("${location}: status must be 'Draft' or 'Ratified'")
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
$canonicalDecisionRecord = Join-Path (
    Split-Path -Parent $canonicalRoot
) "docs/ratification/2026-08-09-engineering-principles.md"
if (-not $DecisionRecord -and $resolvedRoot -ceq $canonicalRoot) {
    $DecisionRecord = $canonicalDecisionRecord
}
$decisionValidated = $false
if ($validateCatalog) {
    $decisionValidated = Test-RatificationDecision -Path $DecisionRecord
}

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
        if ($validateCatalog) {
            $actualHash = Get-SemanticHash -File $file
            if ($actualHash -cne $expectedSemanticHashes[$relativePath]) {
                $errors.Add(
                    "$($file.FullName): semantic content hash mismatch for '$relativePath'"
                )
            }
            if ($BaselineRef) {
                $baselineLines = @(
                    & git show "${BaselineRef}:principles/$relativePath" 2>$null
                )
                if ($LASTEXITCODE -ne 0) {
                    $errors.Add(
                        "$($file.FullName): principle is absent from baseline '$BaselineRef'"
                    )
                }
                else {
                    $baselineHash = Get-NormalizedHash -Lines @(
                        $baselineLines |
                            Where-Object { $_ -cnotmatch "^- Status:" }
                    )
                    if ($actualHash -cne $baselineHash) {
                        $errors.Add(
                            "$($file.FullName): semantic content drift from baseline '$BaselineRef' for '$relativePath'"
                        )
                    }
                    if (
                        $expectedSemanticHashes[$relativePath] -cne
                        $baselineHash
                    ) {
                        $errors.Add(
                            "$($file.FullName): semantic hash manifest does not match baseline '$BaselineRef' for '$relativePath'"
                        )
                    }
                }
            }
        }
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

if (-not $validateCatalog -and $ratifiedCount -gt 0) {
    if (-not $DecisionRecord) {
        $errors.Add(
            "${resolvedRoot}: Ratified status requires a matching Ratification decision record"
        )
    }
    else {
        [void](Test-RatificationDecision -Path $DecisionRecord)
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

$validatedStatus = if ($validateCatalog) { "Ratified" } else { "principle" }
Write-Output "Validated $($seenIds.Count) $validatedStatus IDs in $Root"
