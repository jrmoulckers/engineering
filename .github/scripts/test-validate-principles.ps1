$ErrorActionPreference = "Stop"
$validator = Join-Path $PSScriptRoot "validate-principles.ps1"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([Guid]::NewGuid())
$defaultOwner = (
    "Engineering owns this Draft's fixture mechanism; " +
    "only the repository owner may change it to Ratified."
)
$defaultHandoff = "Product owns outcome obligations."

function New-FixturePath {
    param(
        [string]$Name,
        [string]$RelativePath = "assurance/testing.md"
    )

    $root = Join-Path $fixtureRoot $Name
    $path = Join-Path $root $RelativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $path) -Force |
        Out-Null
    return @{
        Root = $root
        Path = $path
    }
}

function Write-PrincipleFixture {
    param(
        [hashtable]$Fixture,
        [string]$Id = "ENG-TEST-001",
        [string]$Status = "Draft",
        [string]$Statement = "Require valid principle metadata.",
        [string]$Owner = $defaultOwner,
        [string]$Handoff = $defaultHandoff,
        [string]$LegacyInputs = "none",
        [switch]$OmitEvidence
    )

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("# Validator fixture")
    $lines.Add("- ID: $Id")
    $lines.Add("- Status: $Status")
    $lines.Add("- Statement: $Statement")
    $lines.Add("- Rationale: Invalid metadata must fail for one known reason.")
    if (-not $OmitEvidence) {
        $lines.Add("- Evidence: The validator emits the expected diagnostic.")
    }
    $lines.Add("- Owner and ratification: $Owner")
    $lines.Add("- Handoff: $Handoff")
    $lines.Add("- Legacy inputs: $LegacyInputs")
    $lines | Set-Content -LiteralPath $Fixture.Path -Encoding utf8
}

function Assert-ValidationFailure {
    param(
        [string]$Root,
        [string[]]$ExpectedDiagnostics,
        [switch]$RequireCatalog
    )

    $arguments = @("-NoProfile", "-File", $validator, "-Root", $Root)
    if ($RequireCatalog) {
        $arguments += "-RequireCatalog"
    }
    $output = @(& pwsh @arguments 2>&1 | ForEach-Object { "$_" })
    $exitCode = $LASTEXITCODE
    $output | Write-Output

    if ($exitCode -eq 0) {
        throw "Validator accepted invalid fixture root: $Root"
    }
    if ($output.Count -ne $ExpectedDiagnostics.Count) {
        throw (
            "Validator emitted $($output.Count) diagnostics for $Root; " +
            "expected $($ExpectedDiagnostics.Count)"
        )
    }
    foreach ($expected in $ExpectedDiagnostics) {
        if (-not ($output | Where-Object { $_.Contains($expected) })) {
            throw "Validator did not emit expected diagnostic '$expected' for $Root"
        }
    }
}

function Copy-PrincipleCatalog {
    param([string]$Name)

    $root = Join-Path $fixtureRoot $Name
    New-Item -ItemType Directory -Path $root | Out-Null
    Copy-Item -Path (Join-Path $repositoryRoot "principles/*") `
        -Destination $root -Recurse
    return $root
}

try {
    $missing = New-FixturePath "missing"
    Write-PrincipleFixture -Fixture $missing -OmitEvidence
    Assert-ValidationFailure -Root $missing.Root -ExpectedDiagnostics @(
        "missing or empty 'Evidence'"
    )

    $duplicate = New-FixturePath "duplicate"
    @(
        "# Duplicate fixture"
        "## First"
        "- ID: ENG-TEST-001"
        "- Status: Draft"
        "- Statement: Keep IDs unique."
        "- Rationale: Stable references require unique identifiers."
        "- Evidence: The validator emits the expected diagnostic."
        "- Owner and ratification: $defaultOwner"
        "- Handoff: $defaultHandoff"
        "- Legacy inputs: none"
        "## Second"
        "- ID: ENG-TEST-001"
        "- Status: Draft"
        "- Statement: Keep IDs unique."
        "- Rationale: Stable references require unique identifiers."
        "- Evidence: The validator emits the expected diagnostic."
        "- Owner and ratification: $defaultOwner"
        "- Handoff: $defaultHandoff"
        "- Legacy inputs: none"
    ) | Set-Content -LiteralPath $duplicate.Path -Encoding utf8
    Assert-ValidationFailure -Root $duplicate.Root -ExpectedDiagnostics @(
        "duplicate ID 'ENG-TEST-001'"
    )

    $nonDraft = New-FixturePath "non-draft"
    Write-PrincipleFixture -Fixture $nonDraft -Status "Ratified"
    Assert-ValidationFailure -Root $nonDraft.Root -ExpectedDiagnostics @(
        "status must be 'Draft'"
    )

    $nestedLegacy = New-FixturePath "nested-legacy"
    Write-PrincipleFixture -Fixture $nestedLegacy `
        -LegacyInputs "``studio-legacy:security:7.1``"
    Assert-ValidationFailure -Root $nestedLegacy.Root -ExpectedDiagnostics @(
        "legacy inputs must use exact top-level baseline IDs"
    )

    $malformedLegacy = New-FixturePath "malformed-legacy"
    Write-PrincipleFixture -Fixture $malformedLegacy `
        -LegacyInputs "``studio-legacy-security-7``"
    Assert-ValidationFailure -Root $malformedLegacy.Root -ExpectedDiagnostics @(
        "legacy inputs must use exact top-level baseline IDs"
    )

    $outOfRangeLegacy = New-FixturePath "out-of-range-legacy"
    Write-PrincipleFixture -Fixture $outOfRangeLegacy `
        -LegacyInputs "``studio-legacy:process:8``"
    Assert-ValidationFailure -Root $outOfRangeLegacy.Root -ExpectedDiagnostics @(
        "legacy inputs must use exact top-level baseline IDs"
    )

    $declarative = New-FixturePath "declarative"
    Write-PrincipleFixture -Fixture $declarative `
        -Statement "Tests are required."
    Assert-ValidationFailure -Root $declarative.Root -ExpectedDiagnostics @(
        "statement must begin with an imperative verb"
    )

    $invalidOwner = New-FixturePath "invalid-owner"
    Write-PrincipleFixture -Fixture $invalidOwner `
        -Owner "Engineering may ratify this Draft."
    Assert-ValidationFailure -Root $invalidOwner.Root -ExpectedDiagnostics @(
        "owner and ratification must reserve Ratification to the repository owner"
    )

    $mixedRatification = New-FixturePath "mixed-ratification"
    Write-PrincipleFixture -Fixture $mixedRatification -Owner (
        "Engineering owns this Draft's mechanism and may ratify it; " +
        "only the repository owner may change it to Ratified."
    )
    Assert-ValidationFailure -Root $mixedRatification.Root -ExpectedDiagnostics @(
        "owner and ratification must reserve Ratification to the repository owner"
    )

    $missingHandoff = New-FixturePath "missing-handoff"
    Write-PrincipleFixture -Fixture $missingHandoff -Handoff "none"
    Assert-ValidationFailure -Root $missingHandoff.Root -ExpectedDiagnostics @(
        "handoff must assign or reference external authority"
    )

    $invalidNamespace = New-FixturePath "invalid-namespace" `
        "assurance/security-and-privacy.md"
    Write-PrincipleFixture -Fixture $invalidNamespace
    Assert-ValidationFailure -Root $invalidNamespace.Root -ExpectedDiagnostics @(
        "does not match the file's ENG-SEC namespace"
    )

    $invalidCase = New-FixturePath "invalid-case"
    Write-PrincipleFixture -Fixture $invalidCase -Id "eng-TEST-001"
    Assert-ValidationFailure -Root $invalidCase.Root -ExpectedDiagnostics @(
        "invalid ID 'eng-TEST-001'"
    )

    $unrecognizedPath = New-FixturePath "unrecognized-path" "unmapped.md"
    Write-PrincipleFixture -Fixture $unrecognizedPath
    Assert-ValidationFailure -Root $unrecognizedPath.Root -ExpectedDiagnostics @(
        "unrecognized principle path 'unmapped.md'"
    )

    $productCollision = New-FixturePath "product-collision"
    Write-PrincipleFixture -Fixture $productCollision -Handoff (
        "Engineering owns Product metrics; Product owns outcome obligations."
    )
    Assert-ValidationFailure -Root $productCollision.Root -ExpectedDiagnostics @(
        "handoff assigns reserved external authority to Engineering"
    )

    $actionsCollision = New-FixturePath "actions-collision"
    Write-PrincipleFixture -Fixture $actionsCollision -Handoff (
        "Engineering implements GitHub Actions; Product owns outcome obligations."
    )
    Assert-ValidationFailure -Root $actionsCollision.Root -ExpectedDiagnostics @(
        "handoff assigns reserved external authority to Engineering"
    )

    $permissionsCollision = New-FixturePath "permissions-collision"
    Write-PrincipleFixture -Fixture $permissionsCollision -Handoff (
        "Engineering owns workflow permissions; Product owns outcome obligations."
    )
    Assert-ValidationFailure -Root $permissionsCollision.Root -ExpectedDiagnostics @(
        "handoff assigns reserved external authority to Engineering"
    )

    $scannerCollision = New-FixturePath "scanner-collision"
    Write-PrincipleFixture -Fixture $scannerCollision -Handoff (
        "Engineering runs platform scanners; Product owns outcome obligations."
    )
    Assert-ValidationFailure -Root $scannerCollision.Root -ExpectedDiagnostics @(
        "handoff assigns reserved external authority to Engineering"
    )

    $deletedCatalog = Copy-PrincipleCatalog "deleted-catalog"
    $deletedFile = Join-Path $deletedCatalog "assurance/testing.md"
    $deletedContent = Get-Content -LiteralPath $deletedFile -Raw
    $marker = $deletedContent.IndexOf("## Executable procedures")
    if ($marker -lt 0) {
        throw "Catalog deletion marker was not found"
    }
    $deletedContent.Substring(0, $marker).TrimEnd() |
        Set-Content -LiteralPath $deletedFile -Encoding utf8
    Assert-ValidationFailure -Root $deletedCatalog -RequireCatalog `
        -ExpectedDiagnostics @("missing expected principle ID 'ENG-TEST-010'")

    $renumberedCatalog = Copy-PrincipleCatalog "renumbered-catalog"
    $renumberedFile = Join-Path $renumberedCatalog "assurance/testing.md"
    $renumberedContent = Get-Content -LiteralPath $renumberedFile -Raw
    $renumberedContent.Replace("ENG-TEST-010", "ENG-TEST-999") |
        Set-Content -LiteralPath $renumberedFile -Encoding utf8 -NoNewline
    Assert-ValidationFailure -Root $renumberedCatalog -RequireCatalog `
        -ExpectedDiagnostics @(
            "missing expected principle ID 'ENG-TEST-010'"
            "unexpected principle ID 'ENG-TEST-999'"
        )
}
finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}

$global:LASTEXITCODE = 0
Write-Output "Validated principle metadata negative fixtures"
