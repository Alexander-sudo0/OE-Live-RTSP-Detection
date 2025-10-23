# Optimized GPU Face Recognition App Startup Script
# This script launches the app with maximum performance settings

Write-Host "Starting Optimized GPU Face Recognition App..." -ForegroundColor Green
Write-Host "Performance Optimizations:" -ForegroundColor Yellow
Write-Host "- Face Recognition: 15 FPS (5x faster than before)" -ForegroundColor Cyan
Write-Host "- Stream Display: 30 FPS (smoother live view)" -ForegroundColor Cyan  
Write-Host "- GPU Video Decode: CUDA accelerated" -ForegroundColor Cyan
Write-Host "- Buffer Optimization: Real-time performance" -ForegroundColor Cyan

# Kill any existing Python processes to ensure clean start
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Set working directory
Set-Location "c:\Users\HP\Desktop\new_frm\mizva"

# Add NVIDIA GPU libraries to PATH for maximum performance
$env:PATH += ";c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cublas\bin"
$env:PATH += ";c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cufft\bin"
$env:PATH += ";c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cudnn\bin"
$env:PATH += ";c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cuda_runtime\bin"
$env:PATH += ";c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\curand\bin"
$env:PATH += ";c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cusolver\bin"
$env:PATH += ";c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cusparse\bin"

# Performance environment variables
$env:OMP_NUM_THREADS = [Environment]::ProcessorCount
$env:CUDA_LAUNCH_BLOCKING = "0"
$env:CUDA_CACHE_DISABLE = "0"

Write-Host "Testing optimized CUDA availability..." -ForegroundColor Yellow
c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\Scripts\python.exe -c "import onnxruntime as ort; print('Available providers:', ort.get_available_providers())"

Write-Host "Launching Optimized Face Recognition App with GPU acceleration..." -ForegroundColor Green
Write-Host "Expected performance: 15 FPS face recognition, 30 FPS streaming" -ForegroundColor Cyan
Write-Host "Access URLs:" -ForegroundColor Yellow
Write-Host "- Local: http://127.0.0.1:5001" -ForegroundColor White
Write-Host "- Network: http://192.168.0.156:5001" -ForegroundColor White

c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\Scripts\python.exe c:\Users\HP\Desktop\new_frm\mizva\app_gpu_fixed.py