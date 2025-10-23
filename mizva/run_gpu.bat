@echo off
cd /d "c:\Users\HP\Desktop\new_frm\mizva"
set "PATH=%PATH%;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cublas\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cufft\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cudnn\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cuda_runtime\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\curand\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cusolver\bin;c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\lib\site-packages\nvidia\cusparse\bin"

rem Check if the venv Python exists and works
c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\Scripts\python.exe --version
if errorlevel 1 (
    echo Virtual environment Python not working, trying to fix...
    rem Use system Python instead
    C:\Users\HP\AppData\Local\Programs\Python\Python313\python.exe app_gpu_fixed.py
) else (
    echo Using virtual environment Python
    c:\Users\HP\Desktop\new_frm\mizva\.venv_gpu\Scripts\python.exe app_gpu_fixed.py
)
pause