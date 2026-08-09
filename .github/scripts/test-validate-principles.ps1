$ErrorActionPreference = "Stop"
$validator = Join-Path $PSScriptRoot "validate-principles.ps1"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$canonicalDecisionRecord = Join-Path $repositoryRoot (
    "docs/ratification/2026-08-09-engineering-principles.md"
)
$fixtureBaselineRef = if ($env:BASELINE_REF) {
    $env:BASELINE_REF
}
else {
    "main"
}
$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([Guid]::NewGuid())
$temporaryValidators = [System.Collections.Generic.List[string]]::new()
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
        [switch]$RequireCatalog,
        [string]$DecisionRecord,
        [string]$BaselineRef,
        [string]$ValidatorPath = $validator
    )

    $arguments = @("-NoProfile", "-File", $ValidatorPath, "-Root", $Root)
    if ($RequireCatalog) {
        $arguments += "-RequireCatalog"
    }
    if ($DecisionRecord) {
        $arguments += @("-DecisionRecord", $DecisionRecord)
    }
    if ($BaselineRef) {
        $arguments += @("-BaselineRef", $BaselineRef)
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

function Get-StatusExcludedHash {
    param([string]$Path)

    $lines = @(
        Get-Content -LiteralPath $Path -Encoding utf8 |
            Where-Object { $_ -cnotmatch "^- Status:" }
    )
    $content = [string]::Join("`n", $lines) + "`n"
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        return (
            [System.BitConverter]::ToString(
                $sha256.ComputeHash($bytes)
            ).Replace("-", "").ToLowerInvariant()
        )
    }
    finally {
        $sha256.Dispose()
    }
}

function Copy-PrincipleCatalog {
    param([string]$Name)

    $root = Join-Path $fixtureRoot $Name
    $principles = Join-Path $root "principles"
    $decision = Join-Path $root (
        "docs/ratification/2026-08-09-engineering-principles.md"
    )
    New-Item -ItemType Directory -Path $principles -Force | Out-Null
    New-Item -ItemType Directory -Path (Split-Path -Parent $decision) -Force |
        Out-Null
    Copy-Item -Path (Join-Path $repositoryRoot "principles/*") `
        -Destination $principles -Recurse
    Copy-Item -LiteralPath $canonicalDecisionRecord -Destination $decision
    return @{
        Root = $root
        Principles = $principles
        Decision = $decision
    }
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

    $unauthorizedStatus = New-FixturePath "unauthorized-status"
    Write-PrincipleFixture -Fixture $unauthorizedStatus -Status "Proposed"
    Assert-ValidationFailure -Root $unauthorizedStatus.Root -ExpectedDiagnostics @(
        "status must be 'Draft' or 'Ratified'"
    )

    $statusOnly = New-FixturePath "status-only"
    Write-PrincipleFixture -Fixture $statusOnly -Status "Ratified"
    Assert-ValidationFailure -Root $statusOnly.Root -ExpectedDiagnostics @(
        "Ratified status requires a matching Ratification decision record"
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

    $mixedCatalog = Copy-PrincipleCatalog "mixed-catalog"
    $mixedFile = Join-Path $mixedCatalog.Principles (
        "architecture/boundaries-and-contracts.md"
    )
    $mixedContent = Get-Content -LiteralPath $mixedFile -Raw
    ([regex]::new("- Status: Ratified")).Replace(
        $mixedContent,
        "- Status: Draft",
        1
    ) | Set-Content -LiteralPath $mixedFile -Encoding utf8 -NoNewline
    Assert-ValidationFailure -Root $mixedCatalog.Principles -RequireCatalog `
        -DecisionRecord $mixedCatalog.Decision -ExpectedDiagnostics @(
            "catalog status must be 'Ratified'"
        )

    $missingDecision = Copy-PrincipleCatalog "missing-decision"
    Assert-ValidationFailure -Root $missingDecision.Principles -RequireCatalog `
        -ExpectedDiagnostics @(
            "Ratified catalog requires matching Ratification decision record"
        )

    $wordingDrift = Copy-PrincipleCatalog "wording-drift"
    $wordingFile = Join-Path $wordingDrift.Principles "assurance/testing.md"
    $wordingContent = Get-Content -LiteralPath $wordingFile -Raw
    $wordingContent.Replace(
        "Require changed behavior, defect causes, and shared contracts",
        "Require changed behavior, defect origins, and shared contracts"
    ) | Set-Content -LiteralPath $wordingFile -Encoding utf8 -NoNewline
    Assert-ValidationFailure -Root $wordingDrift.Principles -RequireCatalog `
        -DecisionRecord $wordingDrift.Decision `
        -BaselineRef $fixtureBaselineRef `
        -ExpectedDiagnostics @(
            "semantic content hash mismatch for 'assurance/testing.md'"
            "semantic content drift from baseline '$fixtureBaselineRef' for 'assurance/testing.md'"
        )

    $legacyDrift = Copy-PrincipleCatalog "legacy-drift"
    $legacyFile = Join-Path $legacyDrift.Principles "assurance/testing.md"
    $legacyContent = Get-Content -LiteralPath $legacyFile -Raw
    $legacyContent.Replace(
        "- Legacy inputs: ``studio-legacy:testing:1``",
        "- Legacy inputs: ``studio-legacy:testing:2``"
    ) | Set-Content -LiteralPath $legacyFile -Encoding utf8 -NoNewline
    Assert-ValidationFailure -Root $legacyDrift.Principles -RequireCatalog `
        -DecisionRecord $legacyDrift.Decision `
        -BaselineRef $fixtureBaselineRef `
        -ExpectedDiagnostics @(
            "semantic content hash mismatch for 'assurance/testing.md'"
            "semantic content drift from baseline '$fixtureBaselineRef' for 'assurance/testing.md'"
        )

    $selfBaseline = Copy-PrincipleCatalog "self-baseline"
    $selfBaselineFile = Join-Path $selfBaseline.Principles (
        "assurance/testing.md"
    )
    $selfBaselineContent = Get-Content -LiteralPath $selfBaselineFile -Raw
    $selfBaselineContent.Replace(
        "Require changed behavior, defect causes, and shared contracts",
        "Require changed behavior, defect origins, and shared contracts"
    ) | Set-Content -LiteralPath $selfBaselineFile -Encoding utf8 -NoNewline
    $mutatedHash = Get-StatusExcludedHash -Path $selfBaselineFile
    $selfValidator = Join-Path $PSScriptRoot (
        "validate-principles-$([Guid]::NewGuid()).ps1"
    )
    $temporaryValidators.Add($selfValidator)
    $selfValidatorContent = Get-Content -LiteralPath $validator -Raw
    $selfValidatorContent.Replace(
        "23efc72776ee4a4b4ae34848b2308673e05318744eec7a0dfcedc19c8d44cb46",
        $mutatedHash
    ) | Set-Content -LiteralPath $selfValidator -Encoding utf8 -NoNewline
    Assert-ValidationFailure -Root $selfBaseline.Principles -RequireCatalog `
        -DecisionRecord $selfBaseline.Decision `
        -BaselineRef $fixtureBaselineRef `
        -ValidatorPath $selfValidator -ExpectedDiagnostics @(
            "semantic content drift from baseline '$fixtureBaselineRef' for 'assurance/testing.md'"
            "semantic hash manifest does not match baseline '$fixtureBaselineRef' for 'assurance/testing.md'"
        )

    $ambiguousApproval = Copy-PrincipleCatalog "ambiguous-approval"
    $ambiguousContent = Get-Content -LiteralPath $ambiguousApproval.Decision -Raw
    $ambiguousContent.Replace(
        "- Approval: Repository-owner merge of this pull request is the effective approval; opening or reviewing it does not approve or Ratify the catalog.",
        "- Approval: Approval may be inferred from review or merge."
    ) | Set-Content -LiteralPath $ambiguousApproval.Decision -Encoding utf8 `
        -NoNewline
    Assert-ValidationFailure -Root $ambiguousApproval.Principles -RequireCatalog `
        -DecisionRecord $ambiguousApproval.Decision -ExpectedDiagnostics @(
            "must reserve effective approval to repository-owner merge"
        )

    $nonOwnerApproval = Copy-PrincipleCatalog "non-owner-approval"
    $nonOwnerContent = Get-Content -LiteralPath $nonOwnerApproval.Decision -Raw
    $nonOwnerContent.Replace(
        "- Approval: Repository-owner merge of this pull request is the effective approval; opening or reviewing it does not approve or Ratify the catalog.",
        "- Approval: Maintainer merge of this pull request is the effective approval."
    ) | Set-Content -LiteralPath $nonOwnerApproval.Decision -Encoding utf8 `
        -NoNewline
    Assert-ValidationFailure -Root $nonOwnerApproval.Principles -RequireCatalog `
        -DecisionRecord $nonOwnerApproval.Decision -ExpectedDiagnostics @(
            "must reserve effective approval to repository-owner merge"
        )

    $scopeMismatch = Copy-PrincipleCatalog "scope-mismatch"
    $scopeContent = Get-Content -LiteralPath $scopeMismatch.Decision -Raw
    $scopeContent.Replace(
        "(66 total: 24 architecture/platform and 42 assurance/operations).",
        "(65 total: 24 architecture/platform and 41 assurance/operations)."
    ) | Set-Content -LiteralPath $scopeMismatch.Decision -Encoding utf8 `
        -NoNewline
    Assert-ValidationFailure -Root $scopeMismatch.Principles -RequireCatalog `
        -DecisionRecord $scopeMismatch.Decision -ExpectedDiagnostics @(
            "Ratification decision field 'Catalog' does not match the exact catalog manifest"
        )

    $evidenceMismatch = Copy-PrincipleCatalog "evidence-mismatch"
    $evidenceContent = Get-Content -LiteralPath $evidenceMismatch.Decision -Raw
    $evidenceContent.Replace(
        "PR #4 final head ``b3ea073e461f666387cc5df449151055526c6bfc``",
        "PR #4 final head ``0000000000000000000000000000000000000000``"
    ) | Set-Content -LiteralPath $evidenceMismatch.Decision -Encoding utf8 `
        -NoNewline
    Assert-ValidationFailure -Root $evidenceMismatch.Principles -RequireCatalog `
        -DecisionRecord $evidenceMismatch.Decision -ExpectedDiagnostics @(
            "Ratification decision field 'Final review evidence' does not match the exact catalog manifest"
        )

    $addedApproval = Copy-PrincipleCatalog "added-approval"
    Add-Content -LiteralPath $addedApproval.Decision -Encoding utf8 -Value (
        "A maintainer approved this catalog before merge."
    )
    Assert-ValidationFailure -Root $addedApproval.Principles -RequireCatalog `
        -DecisionRecord $addedApproval.Decision -ExpectedDiagnostics @(
            "Ratification decision record does not match the exact Ratification manifest"
        )

    $deletedCatalog = Copy-PrincipleCatalog "deleted-catalog"
    $deletedFile = Join-Path $deletedCatalog.Principles "assurance/testing.md"
    $deletedContent = Get-Content -LiteralPath $deletedFile -Raw
    $marker = $deletedContent.IndexOf("## Executable procedures")
    if ($marker -lt 0) {
        throw "Catalog deletion marker was not found"
    }
    $deletedContent.Substring(0, $marker).TrimEnd() |
        Set-Content -LiteralPath $deletedFile -Encoding utf8
    Assert-ValidationFailure -Root $deletedCatalog.Principles -RequireCatalog `
        -DecisionRecord $deletedCatalog.Decision -ExpectedDiagnostics @(
            "semantic content hash mismatch for 'assurance/testing.md'"
            "missing expected principle ID 'ENG-TEST-010'"
        )

    $renumberedCatalog = Copy-PrincipleCatalog "renumbered-catalog"
    $renumberedFile = Join-Path $renumberedCatalog.Principles (
        "assurance/testing.md"
    )
    $renumberedContent = Get-Content -LiteralPath $renumberedFile -Raw
    $renumberedContent.Replace("ENG-TEST-010", "ENG-TEST-999") |
        Set-Content -LiteralPath $renumberedFile -Encoding utf8 -NoNewline
    Assert-ValidationFailure -Root $renumberedCatalog.Principles -RequireCatalog `
        -DecisionRecord $renumberedCatalog.Decision `
        -ExpectedDiagnostics @(
            "semantic content hash mismatch for 'assurance/testing.md'"
            "missing expected principle ID 'ENG-TEST-010'"
            "unexpected principle ID 'ENG-TEST-999'"
        )
}
finally {
    foreach ($temporaryValidator in $temporaryValidators) {
        if (Test-Path -LiteralPath $temporaryValidator) {
            Remove-Item -LiteralPath $temporaryValidator -Force
        }
    }
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}

$global:LASTEXITCODE = 0
Write-Output "Validated principle metadata negative fixtures"
