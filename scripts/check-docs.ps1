$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Read-Utf8([string]$Path) {
    return [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
}

function Get-MarkdownSlugs([string]$Path) {
    $Slugs = New-Object 'System.Collections.Generic.HashSet[string]'
    $Counts = @{}
    $InFence = $false
    foreach ($Line in ((Read-Utf8 $Path) -split "`r?`n")) {
        if ($Line -match '^\s*(```|~~~)') {
            $InFence = -not $InFence
            continue
        }
        if ($InFence) { continue }
        if ($Line -match '^#{1,6}\s+(.+?)\s*#*\s*$') {
            $Heading = $Matches[1]
            $Heading = [regex]::Replace($Heading, '\[([^\]]+)\]\([^)]+\)', '$1')
            $Heading = $Heading -replace '[`*_~]', ''
            $Heading = $Heading.Trim().ToLowerInvariant()
            $Slug = [regex]::Replace($Heading, '[^\p{L}\p{N} _-]', '')
            $Slug = $Slug -replace ' ', '-'
            if (-not $Slug) { continue }
            if ($Counts.ContainsKey($Slug)) {
                $Counts[$Slug]++
                $FinalSlug = "$Slug-$($Counts[$Slug])"
            } else {
                $Counts[$Slug] = 0
                $FinalSlug = $Slug
            }
            [void]$Slugs.Add($FinalSlug)
        }
    }
    return $Slugs
}

# 1. Verify no AI instructions, skills, or docs folders live inside backend/ or frontend/
$ForbiddenNames = @('AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.agents', 'skills-lock.json', 'docs')
$SeparationErrors = New-Object System.Collections.Generic.List[string]

foreach ($AppName in @('backend', 'frontend')) {
    $AppPath = Join-Path $Root $AppName
    foreach ($Name in $ForbiddenNames) {
        $Candidate = Join-Path $AppPath $Name
        if (Test-Path $Candidate) {
            $SeparationErrors.Add("$AppName/$Name should live outside $AppName/ so it is not pushed to Git.")
        }
    }
}

if ($SeparationErrors.Count -gt 0) {
    Write-Host "Found $($SeparationErrors.Count) AI/doc item(s) inside app repos:" -ForegroundColor Red
    $SeparationErrors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

# 2. Validate all Markdown links and anchors across root, docs/, skills, and app READMEs
$FilesToCheck = New-Object System.Collections.Generic.List[string]
foreach ($Rel in @('AGENTS.md', 'CLAUDE.md', 'README.md', 'backend\README.md', 'frontend\README.md')) {
    $Full = Join-Path $Root $Rel
    if (Test-Path $Full) { $FilesToCheck.Add($Full) }
}
$DocsDir = Join-Path $Root 'docs'
if (Test-Path $DocsDir) {
    Get-ChildItem -Path $DocsDir -Recurse -File -Filter '*.md' | ForEach-Object { $FilesToCheck.Add($_.FullName) }
}
$SkillsDir = Join-Path $Root '.agents\skills'
if (Test-Path $SkillsDir) {
    Get-ChildItem -Path $SkillsDir -Directory -Filter 'kff-*' | ForEach-Object {
        Get-ChildItem -Path $_.FullName -Recurse -File -Filter '*.md' | ForEach-Object { $FilesToCheck.Add($_.FullName) }
    }
}

$SlugCache = @{}
$LinkErrors = New-Object System.Collections.Generic.List[string]
$LinkRx = [regex]'\[[^\]]+\]\((?:<([^>\n]+)>|([^)\s]+))\)'

foreach ($FilePath in ($FilesToCheck | Sort-Object -Unique)) {
    $FileDir = Split-Path -Parent $FilePath
    $RelFile = $FilePath.Replace($Root + '\', '')
    $InFence = $false
    $Lines = (Read-Utf8 $FilePath) -split "`r?`n"

    for ($i = 0; $i -lt $Lines.Length; $i++) {
        $Line = $Lines[$i]
        if ($Line -match '^\s*(```|~~~)') {
            $InFence = -not $InFence
            continue
        }
        if ($InFence) { continue }
        $CleanLine = [regex]::Replace($Line, '`[^`]+`', '')
        foreach ($Match in $LinkRx.Matches($CleanLine)) {
            $RawTarget = if ($Match.Groups[1].Success) { $Match.Groups[1].Value } else { $Match.Groups[2].Value }
            if ($RawTarget -match '^(https?://|mailto:|<)') { continue }

            $Parts = $RawTarget.Split('#', 2)
            $PathPart = $Parts[0]
            $AnchorPart = if ($Parts.Length -gt 1) { $Parts[1] } else { $null }

            $TargetFile = if ([string]::IsNullOrEmpty($PathPart)) {
                $FilePath
            } else {
                try {
                    [IO.Path]::GetFullPath((Join-Path $FileDir $PathPart))
                } catch {
                    $null
                }
            }

            if (-not $TargetFile -or -not (Test-Path $TargetFile)) {
                $LinkErrors.Add("$RelFile`:$($i + 1) -> missing target '$RawTarget'")
                continue
            }

            if ($AnchorPart -and $TargetFile.EndsWith('.md', [StringComparison]::OrdinalIgnoreCase)) {
                if (-not $SlugCache.ContainsKey($TargetFile)) {
                    $SlugCache[$TargetFile] = Get-MarkdownSlugs $TargetFile
                }
                if (-not $SlugCache[$TargetFile].Contains($AnchorPart.ToLowerInvariant())) {
                    $LinkErrors.Add("$RelFile`:$($i + 1) -> missing heading anchor '#$AnchorPart' in '$PathPart'")
                }
            }
        }
    }
}

if ($LinkErrors.Count -gt 0) {
    Write-Host "Found $($LinkErrors.Count) broken Markdown link(s):" -ForegroundColor Red
    $LinkErrors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Docs check passed: 0 AI/doc files inside backend/ or frontend/; verified $($FilesToCheck.Count) Markdown files with 0 broken links." -ForegroundColor Green
