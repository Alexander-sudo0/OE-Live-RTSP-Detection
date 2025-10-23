# Kill any existing Python processes
Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force

# Navigate to the correct directory
cd c:\Users\HP\Desktop\new_frm\mizva

# Set up the NVIDIA CUDA DLL paths
$env:PATH += ";c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cublas\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cufft\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cudnn\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cuda_runtime\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\curand\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cusolver\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cusparse\bin"

# Test CUDA availability
Write-Host "Testing CUDA availability..."
c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\Scripts\python.exe -c "import onnxruntime as ort; print('Available providers:', ort.get_available_providers())"

# Start the app with GPU acceleration
Write-Host "Starting Face Recognition App with GPU acceleration..."
c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\Scripts\python.exe app_gpu_fixed.py