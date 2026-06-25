@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Hotfix Painel - imagens e gpt-image-2

echo.
echo ==========================================================
echo   HOTFIX PAINEL - remove erro gpt-image-2 e imagem vazia
echo ==========================================================
echo.
echo IMPORTANTE:
echo Coloque este .bat DENTRO da pasta principal do projeto
echo e execute com duplo clique.
echo.
echo Ele vai:
echo - criar backup dos arquivos alterados;
echo - procurar gpt-image-2 e strings relacionadas;
echo - trocar gpt-image-2 por gpt-image-1 para parar o erro 400;
echo - criar assets/no-image.png;
echo - injetar fallback de imagem no painel.html;
echo - criar log da correcao.
echo.

set "ROOT=%~dp0"
set "PS1=%TEMP%\hotfix_painel_imagens_%RANDOM%.ps1"

> "%PS1%" (
echo $ErrorActionPreference = 'Stop'
echo $root = [System.IO.Path]::GetFullPath('%ROOT%')
echo $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
echo $log = Join-Path $root "hotfix_painel_imagens_$timestamp.log"
echo $backupDir = Join-Path $root "backup_hotfix_painel_$timestamp"
echo New-Item -ItemType Directory -Force -Path $backupDir ^| Out-Null
echo function Log($msg^) { $line = "[" + (Get-Date -Format "HH:mm:ss"^) + "] " + $msg; Write-Host $line; Add-Content -LiteralPath $log -Value $line -Encoding UTF8 }
echo Log "Pasta do projeto: $root"
echo $excludeDirs = @('\node_modules\', '\.git\', '\dist\', '\build\', '\.next\', '\out\', '\coverage\', '\backup_hotfix_painel_')
echo $allowedExt = @('.js','.jsx','.ts','.tsx','.mjs','.cjs','.html','.css','.json','.env','.py','.php','.vue','.svelte')
echo function IsExcluded($path^) {
echo   foreach($ex in $excludeDirs^) { if($path -like "*$ex*"^) { return $true } }
echo   return $false
echo }
echo function BackupFile($file^) {
echo   $rel = $file.Substring($root.Length^).TrimStart('\','/'^)
echo   $dest = Join-Path $backupDir $rel
echo   $destDir = Split-Path $dest -Parent
echo   New-Item -ItemType Directory -Force -Path $destDir ^| Out-Null
echo   Copy-Item -LiteralPath $file -Destination $dest -Force
echo }
echo $files = Get-ChildItem -LiteralPath $root -Recurse -File ^| Where-Object { -not (IsExcluded $_.FullName^) -and ($allowedExt -contains $_.Extension.ToLower(^)^) }
echo Log ("Arquivos analisados: " + $files.Count^)
echo $changed = New-Object System.Collections.Generic.List[string]
echo $patterns = @('gpt-image-2','image_generation','generateImage','openai.images')
echo foreach($file in $files^) {
echo   try {
echo     $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
echo   } catch { continue }
echo   $original = $content
echo   if($content -match 'gpt-image-2'^) {
echo     $content = $content -replace 'gpt-image-2','gpt-image-1'
echo   }
echo   # Nao tenta apagar codigo desconhecido de IA automaticamente para nao quebrar o projeto.
echo   # Apenas para o erro fatal do modelo inexistente.
echo   if($content -ne $original^) {
echo     BackupFile $file.FullName
echo     Set-Content -LiteralPath $file.FullName -Value $content -Encoding UTF8
echo     $changed.Add($file.FullName^) ^| Out-Null
echo     Log ("Alterado: " + $file.FullName^)
echo   }
echo }
echo # Criar imagem padrao no-image.png em locais comuns
echo $pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAASwAAADICAIAAADdvUsCAAAB/UlEQVR4nO3TMQ0AIADAMEA5f2mTMA0lHHR3w5kzswCQf5wB4G8JQIGwAqBAWAFQIKwAKBBWABQIKwAKhBUABcIKgAJhBUCBsAKgQFgBUCCsACgQVgAUCCsACoQVAAWCV6Yx2ztn7PMOgNfCAgqEFQAFwgqAAmEFQIGwAqBAWAFQIKwAKBBWABQIKwAKhBUABcIKgAJhBUCBsAKgQFgBUCCsACgQVgAUCCsACoQVAAXCCoACCV6Zxmxv2PMOgNfCAgqEFQAFwgqAAmEFQIGwAqBAWAFQIKwAKBBWABQIKwAKhBUABcIKgAJhBUCBsAKgQFgBUCCsACgQVgAUCCsACoQVAAUSeGUas71hzjsAXgsLKBBWABQIKwAKhBUABcIKgAJhBUCBsAKgQFgBUCCsACgQVgAUCCsACoQVAAWCV6Yx25v2fAfAa2EBBcIKgAJhBUCBsAKgQFgBUCCsACgQVgAUCCsACoQVAAXCCoACYQVAgbACoEBYAVAgrAAoEFYAFMgrAAqEFQAFwk8x2ztn7PMOgNfCAgqEFQAFwgqAAmEFQIGwAqBAWAFQIKwAKBBWABQIKwAKhBUABcIKgAJhBUCBsAKgQFgBUCCsACgQVgAUCCsACoQVAAWCV6Yx25v2fAfAa2EBBcIKgAJhBUCBsAKgQFgBUCCsACgQVgAUCCsACoQVAAXCCoACYQVAgbACoEBYAVAgrAAoEFYAFMgrAAqEFQAFwgqAAmEFQIGwAqBAWAFQIKwAKBBWABQIKwAKhBUABcIKgAJhBUCBsALwA5C8BzH9A0S6AAAAAElFTkSuQmCC'
echo $assetDirs = @((Join-Path $root 'assets'^), (Join-Path $root 'public\assets'^), (Join-Path $root 'src\assets'^)^)
echo foreach($dir in $assetDirs^) {
echo   New-Item -ItemType Directory -Force -Path $dir ^| Out-Null
echo   $imgPath = Join-Path $dir 'no-image.png'
echo   if(-not (Test-Path -LiteralPath $imgPath^)^) {
echo     [IO.File]::WriteAllBytes($imgPath, [Convert]::FromBase64String($pngB64^)^)
echo     Log ("Criado: " + $imgPath^)
echo   }
echo }
echo # Criar JS de fallback
echo $hotfixDir = Join-Path $root 'assets'
echo New-Item -ItemType Directory -Force -Path $hotfixDir ^| Out-Null
echo $hotfixJs = Join-Path $hotfixDir 'painel-hotfix.js'
echo $js = @'
echo (function () {
echo   const FALLBACKS = ['assets/no-image.png', '/assets/no-image.png', './assets/no-image.png'];
echo   const fallback = FALLBACKS[0];
echo.
echo   function applyFallback(img) {
echo     if (!img || img.dataset.hotfixFallback === '1') return;
echo     img.dataset.hotfixFallback = '1';
echo     img.onerror = function () {
echo       if (this.src.indexOf('no-image.png') === -1) this.src = fallback;
echo     };
echo     const src = (img.getAttribute('src') || '').trim();
echo     if (!src || src === 'null' || src === 'undefined') img.src = fallback;
echo   }
echo.
echo   function scanImages() {
echo     document.querySelectorAll('img').forEach(applyFallback);
echo   }
echo.
echo   function showError(message) {
echo     let box = document.getElementById('hotfix-panel-error');
echo     if (!box) {
echo       box = document.createElement('div');
echo       box.id = 'hotfix-panel-error';
echo       box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:999999;padding:14px 16px;border-radius:10px;background:#2b1111;color:#fff;border:1px solid #ff4d4d;font:14px Arial,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)';
echo       document.body.appendChild(box);
echo     }
echo     box.textContent = 'Erro no painel: ' + message;
echo   }
echo.
echo   window.addEventListener('error', function (event) {
echo     const msg = event && (event.message || (event.error && event.error.message));
echo     if (msg) showError(msg);
echo   });
echo.
echo   window.addEventListener('unhandledrejection', function (event) {
echo     const reason = event && event.reason;
echo     const msg = reason && (reason.message || reason.toString ? reason.toString() : reason);
echo     if (msg) showError(msg);
echo   });
echo.
echo   document.addEventListener('DOMContentLoaded', function () {
echo     scanImages();
echo     new MutationObserver(scanImages).observe(document.body, { childList: true, subtree: true });
echo   });
echo })();
echo '@
echo Set-Content -LiteralPath $hotfixJs -Value $js -Encoding UTF8
echo Log ("Criado/atualizado: " + $hotfixJs^)
echo # Injetar JS em painel.html se existir
echo $painelFiles = Get-ChildItem -LiteralPath $root -Recurse -File -Filter 'painel.html' ^| Where-Object { -not (IsExcluded $_.FullName^) }
echo foreach($pf in $painelFiles^) {
echo   $html = Get-Content -LiteralPath $pf.FullName -Raw
echo   if($html -notmatch 'painel-hotfix\.js'^) {
echo     BackupFile $pf.FullName
echo     $scriptTag = '<script src="assets/painel-hotfix.js"></script>'
echo     if($html -match '</body>'^) {
echo       $html = $html -replace '</body>', ($scriptTag + "`r`n</body>"^)
echo     } else {
echo       $html = $html + "`r`n" + $scriptTag
echo     }
echo     Set-Content -LiteralPath $pf.FullName -Value $html -Encoding UTF8
echo     $changed.Add($pf.FullName^) ^| Out-Null
echo     Log ("Hotfix injetado em: " + $pf.FullName^)
echo   }
echo }
echo # Relatorio de strings restantes
echo Log "Verificando strings restantes..."
echo foreach($p in $patterns^) {
echo   $hits = Select-String -Path ($files.FullName^) -Pattern $p -SimpleMatch -ErrorAction SilentlyContinue
echo   if($hits^) { Log ("Ainda encontrado: " + $p + " em " + (($hits ^| Select-Object -ExpandProperty Path -Unique^) -join ', '^)^) }
echo   else { Log ("OK, nao encontrado: " + $p^) }
echo }
echo Log "Finalizado."
echo Log ("Backup salvo em: " + $backupDir^)
echo Log ("Log salvo em: " + $log^)
echo Write-Host ''
echo Write-Host '==========================================================' -ForegroundColor Green
echo Write-Host 'Hotfix aplicado. Agora reinicie o servidor do projeto.' -ForegroundColor Green
echo Write-Host 'Exemplo: pare com CTRL+C e rode npm run dev ou npm start.' -ForegroundColor Green
echo Write-Host 'Backup salvo em:' $backupDir -ForegroundColor Yellow
echo Write-Host '==========================================================' -ForegroundColor Green
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
del "%PS1%" >nul 2>nul

echo.
echo Pressione qualquer tecla para fechar...
pause >nul
endlocal
