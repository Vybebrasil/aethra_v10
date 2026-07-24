$sourceDir = "C:\Users\pichau\Desktop\aethra\Assets Novos Para Teste"
$targetDir = "C:\Users\pichau\Desktop\aethra\aethra_v10\assets\craftpix"

if (!(Test-Path -Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
}

$zipFiles = Get-ChildItem -Path $sourceDir -Filter *.zip

foreach ($zip in $zipFiles) {
    $zipName = [System.IO.Path]::GetFileNameWithoutExtension($zip.Name)
    $destination = Join-Path -Path $targetDir -ChildPath $zipName
    
    if (!(Test-Path -Path $destination)) {
        New-Item -ItemType Directory -Path $destination | Out-Null
        Write-Host "Extracting $($zip.Name) to $destination..."
        Expand-Archive -Path $zip.FullName -DestinationPath $destination -Force
    } else {
        Write-Host "Skipping $($zip.Name), already extracted."
    }
}

Write-Host "All assets extracted successfully."
