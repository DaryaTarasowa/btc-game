param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$terraformDirectory = Join-Path $repositoryRoot 'terraform'
$frontendDirectory = Join-Path $repositoryRoot 'frontend'
$distDirectory = Join-Path $frontendDirectory 'dist'
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("btc-game-frontend-" + [guid]::NewGuid().ToString('N'))
$artifactPath = Join-Path $temporaryDirectory 'frontend.zip'

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Command,
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

$appId = (& terraform "-chdir=$terraformDirectory" output -raw amplify_app_id).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not read amplify_app_id from Terraform state.' }

$createPlayerUrl = (& terraform "-chdir=$terraformDirectory" output -raw create_player_url).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not read create_player_url from Terraform state.' }

$previousCreatePlayerUrl = $env:VITE_CREATE_PLAYER_URL

try {
    Push-Location $frontendDirectory
    try {
        $env:VITE_CREATE_PLAYER_URL = $createPlayerUrl
        if (-not $SkipInstall) {
            Invoke-CheckedCommand pnpm install --frozen-lockfile
        }
        Invoke-CheckedCommand pnpm run build
    }
    finally {
        Pop-Location
        $env:VITE_CREATE_PLAYER_URL = $previousCreatePlayerUrl
    }

    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    Compress-Archive -Path (Join-Path $distDirectory '*') -DestinationPath $artifactPath

    $deploymentJson = & aws amplify create-deployment --app-id $appId --branch-name main --output json
    if ($LASTEXITCODE -ne 0) { throw 'Amplify create-deployment failed.' }
    $deployment = $deploymentJson | ConvertFrom-Json

    Invoke-WebRequest -Uri $deployment.zipUploadUrl -Method Put -InFile $artifactPath -ContentType 'application/zip' | Out-Null
    Invoke-CheckedCommand aws amplify start-deployment --app-id $appId --branch-name main --job-id $deployment.jobId

    Write-Host "Started Amplify deployment job $($deployment.jobId) for app $appId."
}
finally {
    if (Test-Path -LiteralPath $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}
